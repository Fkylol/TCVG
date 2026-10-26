-- ============================================================
--  Migration 021 — MARCHÉ : carnet d'ordres d'achat
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Principe :
--    • un ordre d'achat réserve le prix maximum sur le solde de l'acheteur
--      (séquestre en Pixels), comme une annonce met une carte sous séquestre ;
--    • dès qu'une annonce entre dans la limite d'un ordre (nouvel ordre ou
--      nouvelle annonce), le moteur d'appariement exécute la vente dans la
--      même transaction : carte transférée, acheteur débité du prix réel,
--      vendeur crédité prix − commission, surplus réservé rendu ;
--    • chaque exécution produit une ligne immuable dans `trades` et des lignes
--      dans `pixel_transactions` (`ref_kind` / `ref_id` pour la traçabilité).
--
--  Aucune identité n'est exposée : `market_orders()` ne renvoie qu'un nombre
--  d'ordres et un meilleur prix par carte.
-- ============================================================

-- ————— Réglages —————
insert into public.game_config (key, value) values
  ('market_max_orders', '20'::jsonb)
on conflict (key) do nothing;

-- ————— Ordres d'achat —————
-- `reserved_pixels` est la somme réellement prélevée au joueur : elle vaut
-- `max_price` tant que l'ordre est actif, puis 0 après exécution ou annulation.
create table if not exists public.buy_orders (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.cards (id) on delete cascade,
  holo boolean not null default false,
  max_price integer not null check (max_price > 0),
  reserved_pixels integer not null default 0 check (reserved_pixels >= 0),
  status text not null default 'active'
    check (status in ('active', 'filled', 'cancelled')),
  filled_listing_id bigint references public.market_listings (id) on delete set null,
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  cancelled_at timestamptz,
  constraint buy_orders_status_fields check (
    (status = 'active' and filled_at is null and cancelled_at is null) or
    (status = 'filled' and filled_at is not null and cancelled_at is null) or
    (status = 'cancelled' and filled_at is null and cancelled_at is not null)
  )
);

create index if not exists buy_orders_book_idx
  on public.buy_orders (card_id, holo, status, max_price desc, created_at);

create index if not exists buy_orders_buyer_idx
  on public.buy_orders (buyer_id, status, created_at desc);

alter table public.buy_orders enable row level security;

drop policy if exists "buy_orders: lecture de ses ordres" on public.buy_orders;
create policy "buy_orders: lecture de ses ordres"
  on public.buy_orders for select
  using (buyer_id = auth.uid());

revoke all on public.buy_orders from anon, authenticated;
grant select on public.buy_orders to authenticated;

-- ————— Historique des exécutions —————
-- Une ligne par vente, figée au moment de l'exécution : c'est la source de
-- vérité des cotes. Aucune mise à jour ni suppression n'est prévue.
create table if not exists public.trades (
  id bigint generated always as identity primary key,
  card_id text not null references public.cards (id) on delete cascade,
  holo boolean not null default false,
  listing_id bigint references public.market_listings (id) on delete set null,
  order_id bigint references public.buy_orders (id) on delete set null,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  price integer not null check (price > 0),
  fee integer not null check (fee >= 0),
  seller_payout integer not null check (seller_payout >= 0),
  created_at timestamptz not null default now(),
  constraint trades_split_check check (price = fee + seller_payout)
);

create index if not exists trades_card_idx
  on public.trades (card_id, holo, created_at desc);

create index if not exists trades_users_idx
  on public.trades (buyer_id, created_at desc);

alter table public.trades enable row level security;

drop policy if exists "trades: lecture de ses ventes et achats" on public.trades;
create policy "trades: lecture de ses ventes et achats"
  on public.trades for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

revoke all on public.trades from anon, authenticated;
grant select on public.trades to authenticated;

-- ————— Traçabilité des mouvements de Pixels —————
alter table public.pixel_transactions
  add column if not exists ref_kind text,
  add column if not exists ref_id bigint;

-- ————— Appariement —————
-- Boucle tant qu'un ordre peut payer une annonce :
--   • meilleur ordre = prix max le plus élevé, puis le plus ancien ;
--   • meilleure annonce = la moins chère que cet ordre peut payer, puis la
--     plus ancienne, et jamais une annonce du même joueur ;
--   • `skip locked` : deux exécutions concurrentes ne se bloquent pas et une
--     même annonce ne peut pas être vendue deux fois.
create or replace function public.match_card_orders(p_card_id text, p_holo boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.buy_orders%rowtype;
  v_listing public.market_listings%rowtype;
  v_commission numeric;
  v_fee integer;
  v_payout integer;
  v_surplus integer;
  v_pixels integer;
  v_matched integer := 0;
begin
  v_commission := coalesce(
    (select (value #>> '{}')::numeric from public.game_config where key = 'market_commission'), 0.05
  );

  loop
    select * into v_order
      from public.buy_orders
     where card_id = p_card_id
       and holo = p_holo
       and status = 'active'
       and reserved_pixels > 0
     order by max_price desc, created_at asc
     limit 1
       for update skip locked;

    -- Plus aucun ordre libre : le reste attendra la prochaine annonce.
    if not found then
      exit;
    end if;

    select * into v_listing
      from public.market_listings
     where card_id = p_card_id
       and holo = p_holo
       and status = 'active'
       and price_pixels <= v_order.max_price
       and seller_id <> v_order.buyer_id
     order by price_pixels asc, created_at asc
     limit 1
       for update skip locked;

    -- L'ordre le plus généreux ne trouve rien : aucun ordre moins élevé non plus.
    if not found then
      exit;
    end if;

    v_fee := ceil(v_listing.price_pixels * v_commission)::int;
    v_payout := v_listing.price_pixels - v_fee;
    v_surplus := v_order.reserved_pixels - v_listing.price_pixels;

    -- La carte rejoint l'acheteur.
    insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
    values (v_order.buyer_id, v_listing.card_id, 1, case when v_listing.holo then 1 else 0 end)
    on conflict (user_id, card_id) do update
      set quantity = col.quantity + 1,
          holo_quantity = col.holo_quantity + case when v_listing.holo then 1 else 0 end;

    -- L'annonce est vendue, aux conditions de l'annonce (pas du prix max).
    update public.market_listings
       set status = 'sold',
           buyer_id = v_order.buyer_id,
           sold_at = now(),
           fee_pixels = v_fee,
           seller_payout = v_payout
     where id = v_listing.id;

    -- L'ordre est exécuté : plus rien n'est réservé pour lui.
    update public.buy_orders
       set status = 'filled',
           filled_at = now(),
           filled_listing_id = v_listing.id,
           reserved_pixels = 0
     where id = v_order.id;

    -- Le surplus de la réservation repart chez l'acheteur.
    if v_surplus > 0 then
      update public.profiles
         set pixels = pixels + v_surplus
       where id = v_order.buyer_id;

      insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
      values (v_order.buyer_id, v_surplus, 'remboursement_ordre', 'buy_order', v_order.id);
    end if;

    -- Le vendeur encaisse le net ; la commission est détruite (puits à Pixels).
    update public.profiles
       set pixels = pixels + v_payout
     where id = v_listing.seller_id;

    insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
    values (v_listing.seller_id, v_payout, 'vente_marche', 'listing', v_listing.id);

    insert into public.trades
      (card_id, holo, listing_id, order_id, buyer_id, seller_id, price, fee, seller_payout)
    values
      (v_listing.card_id, v_listing.holo, v_listing.id, v_order.id,
       v_order.buyer_id, v_listing.seller_id, v_listing.price_pixels, v_fee, v_payout);

    select pixels into v_pixels from public.profiles where id = v_order.buyer_id;

    v_matched := v_matched + 1;
  end loop;

  return v_matched;
end;
$$;

revoke all on function public.match_card_orders(text, boolean) from public;
revoke all on function public.match_card_orders(text, boolean) from anon;
revoke all on function public.match_card_orders(text, boolean) from authenticated;

-- ————— Poser un ordre d'achat —————
-- Le prix maximum est encaissé immédiatement (réservation) : l'acheteur ne
-- peut pas promettre plus que son solde. Les bornes sont celles de
-- `market_quote()`, comme pour les annonces.
create or replace function public.create_buy_order(
  p_card_id text,
  p_holo boolean,
  p_max_price integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_holo boolean := coalesce(p_holo, false);
  v_active integer;
  v_max_active integer;
  v_quote jsonb;
  v_min integer;
  v_max integer;
  v_reference integer;
  v_pixels integer;
  v_id bigint;
  v_status text;
  v_price integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_max_price is null or p_max_price < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_price');
  end if;

  -- Une carte retirée du catalogue ne s'achète ni ne s'annonce.
  if not exists (select 1 from public.cards where id = p_card_id and active) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_card');
  end if;

  -- Le verrou de profil sérialise les ordres d'un même joueur : deux clics
  -- simultanés ne peuvent pas dépasser le plafond ni réserver deux fois.
  perform 1 from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  v_max_active := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'market_max_orders'), 20
  );

  select count(*)::int into v_active
    from public.buy_orders
   where buyer_id = v_uid and status = 'active';

  if v_active >= v_max_active then
    return jsonb_build_object('ok', false, 'reason', 'too_many_orders', 'max', v_max_active);
  end if;

  v_quote := public.market_quote(p_card_id, v_holo);
  v_min := coalesce((v_quote ->> 'min')::int, 0);
  v_max := coalesce((v_quote ->> 'max')::int, 0);
  v_reference := coalesce((v_quote ->> 'reference')::int, 0);

  if v_min <= 0 or v_max < v_min then
    raise exception 'market_quote_invalid' using errcode = 'P0001';
  end if;

  if p_max_price < v_min or p_max_price > v_max then
    return jsonb_build_object(
      'ok', false, 'reason', 'price_out_of_bounds',
      'min', v_min, 'max', v_max, 'reference', v_reference
    );
  end if;

  select pixels into v_pixels from public.profiles where id = v_uid;
  if v_pixels is null or v_pixels < p_max_price then
    return jsonb_build_object(
      'ok', false, 'reason', 'insufficient_pixels',
      'pixels', coalesce(v_pixels, 0), 'price', p_max_price
    );
  end if;

  update public.profiles set pixels = pixels - p_max_price where id = v_uid;

  insert into public.buy_orders (buyer_id, card_id, holo, max_price, reserved_pixels)
  values (v_uid, p_card_id, v_holo, p_max_price, p_max_price)
  returning id into v_id;

  insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
  values (v_uid, -p_max_price, 'reservation_ordre', 'buy_order', v_id);

  -- L'ordre peut être servi immédiatement par une annonce déjà en vente.
  perform public.match_card_orders(p_card_id, v_holo);

  select status into v_status from public.buy_orders where id = v_id;
  select price into v_price from public.trades where order_id = v_id limit 1;
  select pixels into v_pixels from public.profiles where id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'status', v_status,
    'max', p_max_price,
    'min', v_min,
    'reference', v_reference,
    'spent', v_price,
    'pixels', v_pixels
  );
end;
$$;

revoke all on function public.create_buy_order(text, boolean, integer) from public;
revoke all on function public.create_buy_order(text, boolean, integer) from anon;
grant execute on function public.create_buy_order(text, boolean, integer) to authenticated;

-- ————— Annuler un ordre —————
create or replace function public.cancel_buy_order(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.buy_orders%rowtype;
  v_refund integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_order
    from public.buy_orders
   where id = p_order_id
     for update;

  if not found or v_order.buyer_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  if v_order.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  perform 1 from public.profiles where id = v_uid for update;

  v_refund := v_order.reserved_pixels;

  update public.buy_orders
     set status = 'cancelled',
         cancelled_at = now(),
         reserved_pixels = 0
   where id = p_order_id;

  if v_refund > 0 then
    update public.profiles set pixels = pixels + v_refund where id = v_uid;

    insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
    values (v_uid, v_refund, 'annulation_ordre', 'buy_order', p_order_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'card_id', v_order.card_id,
    'refund', v_refund,
    'pixels', (select pixels from public.profiles where id = v_uid)
  );
end;
$$;

revoke all on function public.cancel_buy_order(bigint) from public;
revoke all on function public.cancel_buy_order(bigint) from anon;
grant execute on function public.cancel_buy_order(bigint) to authenticated;

-- ————— Carnet agrégé d'une carte —————
-- Chiffres publics : nombre d'ordres et meilleur prix, normales et holos
-- séparées. Aucun identifiant de joueur ne sort.
create or replace function public.market_orders(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_normal record;
  v_holo record;
  v_mine record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select count(*)::int as count, max(max_price) as best
    into v_normal
    from public.buy_orders
   where card_id = p_card_id and holo = false and status = 'active';

  select count(*)::int as count, max(max_price) as best
    into v_holo
    from public.buy_orders
   where card_id = p_card_id and holo = true and status = 'active';

  select count(*)::int as count, max(max_price) as best
    into v_mine
    from public.buy_orders
   where card_id = p_card_id and holo = false and status = 'active' and buyer_id = v_uid;

  return jsonb_build_object(
    'normal', jsonb_build_object('count', v_normal.count, 'best', v_normal.best),
    'holo', jsonb_build_object('count', v_holo.count, 'best', v_holo.best),
    'mine', jsonb_build_object('count', v_mine.count, 'best', v_mine.best)
  );
end;
$$;

revoke all on function public.market_orders(text) from public;
revoke all on function public.market_orders(text) from anon;
grant execute on function public.market_orders(text) to authenticated;

-- ————— Mes ordres —————
create or replace function public.my_buy_orders()
returns table (
  id bigint,
  card_id text,
  holo boolean,
  max_price integer,
  reserved_pixels integer,
  status text,
  created_at timestamptz,
  filled_at timestamptz,
  cancelled_at timestamptz,
  paid integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    o.id,
    o.card_id,
    o.holo,
    o.max_price,
    o.reserved_pixels,
    o.status,
    o.created_at,
    o.filled_at,
    o.cancelled_at,
    t.price as paid
  from public.buy_orders o
  left join public.trades t on t.order_id = o.id
  where o.buyer_id = auth.uid()
  order by o.created_at desc
  limit 100;
$$;

revoke all on function public.my_buy_orders() from public;
revoke all on function public.my_buy_orders() from anon;
grant execute on function public.my_buy_orders() to authenticated;

-- ————— Une annonce déposée sert aussitôt les ordres en attente —————
-- Trigger plutôt que réécriture de `create_listing()` : tout chemin d'insertion
-- d'annonce profite de l'appariement, et la fonction existante reste intacte.
create or replace function public.market_listings_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    perform public.match_card_orders(new.card_id, new.holo);
  end if;
  return null;
end;
$$;

revoke all on function public.market_listings_match() from public;
revoke all on function public.market_listings_match() from anon;
revoke all on function public.market_listings_match() from authenticated;

drop trigger if exists market_listings_match on public.market_listings;
create trigger market_listings_match
  after insert on public.market_listings
  for each row execute function public.market_listings_match();

-- ————— Contrôles finaux —————
do $$
declare
  v_orders integer;
begin
  select count(*)::int into v_orders
    from public.game_config
   where key = 'market_max_orders';

  if v_orders = 0 then
    raise exception 'réglage market_max_orders absent';
  end if;

  if not exists (select 1 from pg_proc where proname = 'match_card_orders')
     or not exists (select 1 from pg_proc where proname = 'create_buy_order')
     or not exists (select 1 from pg_proc where proname = 'cancel_buy_order')
     or not exists (select 1 from pg_proc where proname = 'market_orders')
     or not exists (select 1 from pg_proc where proname = 'my_buy_orders') then
    raise exception 'fonctions du carnet d''ordres absentes';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'pixel_transactions'
       and column_name = 'ref_kind'
  ) then
    raise exception 'traçabilité des Pixels absente';
  end if;

  raise notice 'Carnet d''ordres en place : % ordre(s) actif(s).', (
    select count(*) from public.buy_orders where status = 'active'
  );
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop trigger if exists market_listings_match on public.market_listings;
--  drop function if exists public.market_listings_match();
--  drop function if exists public.my_buy_orders();
--  drop function if exists public.market_orders(text);
--  drop function if exists public.cancel_buy_order(bigint);
--  drop function if exists public.create_buy_order(text, boolean, integer);
--  drop function if exists public.match_card_orders(text, boolean);
--  alter table public.pixel_transactions drop column if exists ref_id;
--  alter table public.pixel_transactions drop column if exists ref_kind;
--  drop table if exists public.trades;
--  drop table if exists public.buy_orders;
--  delete from public.game_config where key = 'market_max_orders';
--
--  ⚠️ Les ordres et trades disparaissent : rendre les Pixels réservés avant,
--  avec un update des profils, si des ordres sont encore actifs.
-- ============================================================
