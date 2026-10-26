-- ============================================================
--  Migration 022 — MARCHÉ : garde-fous et journal d'audit
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Trois protections, toutes en base (le client ne peut pas les contourner) :
--    • journal d'audit immuable de tout ce qui bouge au marché ;
--    • limite de débit à la création d'annonces et d'ordres ;
--    • cartes retirées : plus d'annonce possible, et purge des annonces et
--      ordres existants avec restitution des cartes et des Pixels.
--
--  Les triggers évitent de réécrire les fonctions de la migration 011 et 021 :
--  ils s'appliquent à tous les chemins d'écriture, présents et futurs.
-- ============================================================

-- ————— Réglages —————
insert into public.game_config (key, value) values
  ('market_rate_window_minutes', '10'::jsonb),
  ('market_rate_max_actions', '15'::jsonb)
on conflict (key) do nothing;

-- ————— Journal d'audit —————
-- Une ligne par action : qui, quoi, quand, combien. Aucune lecture côté joueur :
-- le journal sert aux administrateurs (SQL Editor / service_role).
create table if not exists public.market_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  card_id text,
  listing_id bigint,
  order_id bigint,
  amount integer,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_audit_recent_idx
  on public.market_audit (created_at desc);

create index if not exists market_audit_actor_idx
  on public.market_audit (actor_id, created_at desc);

alter table public.market_audit enable row level security;

-- Aucune policy : personne ne lit le journal via l'API publique.
revoke all on public.market_audit from anon, authenticated;

-- ————— Audit des annonces —————
create or replace function public.market_audit_listings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.market_audit
      (actor_id, action, card_id, listing_id, amount, details)
    values (
      new.seller_id, 'listing_created', new.card_id, new.id, new.price_pixels,
      jsonb_build_object('holo', new.holo)
    );
    return null;
  end if;

  -- Seuls les changements de statut méritent une ligne : une mise à jour de
  -- prix ou de date ne raconte rien de nouveau.
  if new.status is distinct from old.status then
    insert into public.market_audit
      (actor_id, action, card_id, listing_id, amount, details)
    values (
      case when new.status = 'sold' then new.buyer_id else new.seller_id end,
      'listing_' || new.status,
      new.card_id,
      new.id,
      new.price_pixels,
      jsonb_build_object(
        'holo', new.holo,
        'fee', new.fee_pixels,
        'payout', new.seller_payout,
        'seller_id', new.seller_id
      )
    );
  end if;

  return null;
end;
$$;

drop trigger if exists market_audit_listings on public.market_listings;
create trigger market_audit_listings
  after insert or update on public.market_listings
  for each row execute function public.market_audit_listings();

-- ————— Audit des ordres —————
create or replace function public.market_audit_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.market_audit
      (actor_id, action, card_id, order_id, amount, details)
    values (
      new.buyer_id, 'order_created', new.card_id, new.id, new.max_price,
      jsonb_build_object('holo', new.holo)
    );
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.market_audit
      (actor_id, action, card_id, order_id, amount, details)
    values (
      new.buyer_id,
      'order_' || new.status,
      new.card_id,
      new.id,
      new.max_price,
      jsonb_build_object(
        'holo', new.holo,
        'listing_id', new.filled_listing_id,
        'reserved', old.reserved_pixels
      )
    );
  end if;

  return null;
end;
$$;

drop trigger if exists market_audit_orders on public.buy_orders;
create trigger market_audit_orders
  after insert or update on public.buy_orders
  for each row execute function public.market_audit_orders();

-- ————— Audit des exécutions —————
create or replace function public.market_audit_trades()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.market_audit
    (actor_id, action, card_id, listing_id, order_id, amount, details)
  values (
    new.buyer_id, 'trade', new.card_id, new.listing_id, new.order_id, new.price,
    jsonb_build_object(
      'holo', new.holo,
      'fee', new.fee,
      'seller_payout', new.seller_payout,
      'seller_id', new.seller_id
    )
  );
  return null;
end;
$$;

drop trigger if exists market_audit_trades on public.trades;
create trigger market_audit_trades
  after insert on public.trades
  for each row execute function public.market_audit_trades();

-- ————— Limite de débit —————
-- Compte les annonces et les ordres créés par le joueur sur la fenêtre
-- glissante : au-delà du plafond, l'insertion échoue et toute la transaction
-- est annulée (aucune annonce fantôme, aucune réservation perdue).
create or replace function public.market_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_minutes integer;
  v_max integer;
  v_recent integer;
begin
  -- Lecture générique du record via `to_jsonb` : PL/pgSQL résout les champs
  -- d'une table à la compilation du bloc, et un champ absent de l'autre table
  -- (le vendeur d'une annonce, l'acheteur d'un ordre) fait échouer le trigger
  -- avant même d'atteindre la branche concernée.
  v_actor := coalesce(
    (to_jsonb(new) ->> 'buyer_id')::uuid,
    (to_jsonb(new) ->> 'seller_id')::uuid
  );

  v_minutes := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'market_rate_window_minutes'), 10
  );
  v_max := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'market_rate_max_actions'), 15
  );

  select
    (select count(*)::int from public.market_listings
      where seller_id = v_actor and created_at >= now() - make_interval(mins => v_minutes))
    + (select count(*)::int from public.buy_orders
      where buyer_id = v_actor and created_at >= now() - make_interval(mins => v_minutes))
    into v_recent;

  if v_recent >= v_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists market_rate_limit_listings on public.market_listings;
create trigger market_rate_limit_listings
  before insert on public.market_listings
  for each row execute function public.market_rate_limit();

drop trigger if exists market_rate_limit_orders on public.buy_orders;
create trigger market_rate_limit_orders
  before insert on public.buy_orders
  for each row execute function public.market_rate_limit();

-- ————— Cartes retirées : aucune nouvelle annonce —————
-- `create_buy_order()` vérifie déjà `cards.active` ; on couvre aussi les
-- annonces, quel que soit le chemin d'écriture.
create or replace function public.market_listing_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.cards where id = new.card_id and active) then
    raise exception 'card_retired' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists market_listing_guard on public.market_listings;
create trigger market_listing_guard
  before insert on public.market_listings
  for each row execute function public.market_listing_guard();

-- ————— Purge d'une carte retirée —————
-- À lancer après avoir désactivé une carte ou une franchise (script, SQL
-- Editor). Rend les cartes aux vendeurs et les Pixels réservés aux acheteurs,
-- puis laisse une trace dans le journal d'audit.
create or replace function public.market_purge_retired()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing record;
  v_order record;
  v_listings integer := 0;
  v_orders integer := 0;
  v_refunded integer := 0;
begin
  for v_listing in
    select l.id, l.seller_id, l.card_id, l.holo
      from public.market_listings l
      join public.cards c on c.id = l.card_id
     where l.status = 'active' and c.active = false
       for update
  loop
    update public.market_listings
       set status = 'cancelled', cancelled_at = now()
     where id = v_listing.id;

    insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
    values (v_listing.seller_id, v_listing.card_id, 1, case when v_listing.holo then 1 else 0 end)
    on conflict (user_id, card_id) do update
      set quantity = col.quantity + 1,
          holo_quantity = col.holo_quantity + case when v_listing.holo then 1 else 0 end;

    v_listings := v_listings + 1;
  end loop;

  for v_order in
    select o.id, o.buyer_id, o.reserved_pixels
      from public.buy_orders o
      join public.cards c on c.id = o.card_id
     where o.status = 'active' and c.active = false
       for update
  loop
    update public.buy_orders
       set status = 'cancelled', cancelled_at = now(), reserved_pixels = 0
     where id = v_order.id;

    if v_order.reserved_pixels > 0 then
      update public.profiles
         set pixels = pixels + v_order.reserved_pixels
       where id = v_order.buyer_id;

      insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
      values (v_order.buyer_id, v_order.reserved_pixels, 'annulation_ordre', 'buy_order', v_order.id);

      v_refunded := v_refunded + v_order.reserved_pixels;
    end if;

    v_orders := v_orders + 1;
  end loop;

  return jsonb_build_object(
    'listings', v_listings,
    'orders', v_orders,
    'refunded', v_refunded
  );
end;
$$;

revoke all on function public.market_purge_retired() from public;
revoke all on function public.market_purge_retired() from anon;
revoke all on function public.market_purge_retired() from authenticated;

-- ————— Contrôles finaux —————
do $$
declare
  v_config integer;
begin
  select count(*)::int into v_config
    from public.game_config
   where key in ('market_rate_window_minutes', 'market_rate_max_actions');

  if v_config < 2 then
    raise exception 'réglages de limite absents (% trouvés)', v_config;
  end if;

  if not exists (select 1 from pg_proc where proname = 'market_rate_limit')
     or not exists (select 1 from pg_proc where proname = 'market_purge_retired')
     or not exists (select 1 from pg_proc where proname = 'market_listing_guard') then
    raise exception 'fonctions de garde-fous absentes';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'market_audit_trades') then
    raise exception 'journal d''audit non branché';
  end if;

  raise notice 'Garde-fous du marché en place (% lignes au journal).', (
    select count(*) from public.market_audit
  );
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop trigger if exists market_listing_guard on public.market_listings;
--  drop trigger if exists market_rate_limit_orders on public.buy_orders;
--  drop trigger if exists market_rate_limit_listings on public.market_listings;
--  drop trigger if exists market_audit_trades on public.trades;
--  drop trigger if exists market_audit_orders on public.buy_orders;
--  drop trigger if exists market_audit_listings on public.market_listings;
--  drop function if exists public.market_listing_guard();
--  drop function if exists public.market_rate_limit();
--  drop function if exists public.market_audit_trades();
--  drop function if exists public.market_audit_orders();
--  drop function if exists public.market_audit_listings();
--  drop function if exists public.market_purge_retired();
--  drop table if exists public.market_audit;
--  delete from public.game_config
--   where key in ('market_rate_window_minutes', 'market_rate_max_actions');
-- ============================================================
