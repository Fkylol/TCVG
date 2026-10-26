-- ============================================================
--  Migration 024 — NOTIFICATIONS IN-APP
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Trois événements du marché préviennent le joueur concerné, sans email :
--    • sa carte est vendue (`listing_sold`, net encaissé) ;
--    • son ordre d'achat est servi (`order_filled`, prix payé) ;
--    • son annonce a expiré (`listing_expired`, copie revenue).
--
--  Les notifications sont écrites par des triggers `security definer` : le
--  client ne peut ni les créer, ni les modifier, ni les supprimer. Il lit les
--  siennes et les marque comme lues via une fonction dédiée.
-- ============================================================

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('listing_sold', 'order_filled', 'listing_expired')),
  card_id text references public.cards (id) on delete set null,
  listing_id bigint references public.market_listings (id) on delete set null,
  order_id bigint references public.buy_orders (id) on delete set null,
  /** Net pour une vente, prix payé pour un ordre, ancien prix pour une expiration. */
  amount integer,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Lecture de ses propres notifications uniquement.
drop policy if exists "notifications: lecture de ses notifications" on public.notifications;
create policy "notifications: lecture de ses notifications"
  on public.notifications for select
  using (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- ————— Événements d'annonce : vente et expiration —————
create or replace function public.notify_listing_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    insert into public.notifications (user_id, kind, card_id, listing_id, amount)
    values (new.seller_id, 'listing_sold', new.card_id, new.id, new.seller_payout);
    return null;
  end if;

  -- Une annulation volontaire n'a rien à annoncer : seul l'expiration prévient.
  if new.status = 'cancelled'
     and old.status = 'active'
     and new.cancel_reason = 'expired' then
    insert into public.notifications (user_id, kind, card_id, listing_id, amount)
    values (new.seller_id, 'listing_expired', new.card_id, new.id, new.price_pixels);
  end if;

  return null;
end;
$$;

drop trigger if exists notify_listing_events on public.market_listings;
create trigger notify_listing_events
  after update on public.market_listings
  for each row execute function public.notify_listing_events();

-- ————— Ordre servi —————
-- Branché sur `trades`, pas sur `buy_orders` : l'appariement marque l'ordre
-- « filled » **avant** d'écrire l'historique, donc le prix payé n'existe pas
-- encore à cet instant. `trades` porte à la fois le prix et le numéro d'ordre.
create or replace function public.notify_trade_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Une vente directe n'a pas d'ordre : seul l'acheteur d'un ordre est prévenu ici.
  if new.order_id is null then
    return null;
  end if;

  insert into public.notifications (user_id, kind, card_id, listing_id, order_id, amount)
  values (new.buyer_id, 'order_filled', new.card_id, new.listing_id, new.order_id, new.price);

  return null;
end;
$$;

-- Ancienne version (sur `buy_orders`) : on la retire proprement.
drop trigger if exists notify_order_filled on public.buy_orders;
drop function if exists public.notify_order_filled();

drop trigger if exists notify_trade_orders on public.trades;
create trigger notify_trade_orders
  after insert on public.trades
  for each row execute function public.notify_trade_orders();

-- ————— Marquer comme lu —————
-- Sans identifiant : toutes les notifications du joueur. Avec une liste :
-- seulement les siennes (aucune ligne des autres n'est touchée).
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.notifications
     set read_at = now()
   where user_id = v_uid
     and read_at is null
     and (p_ids is null or id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notifications_read(bigint[]) from public;
revoke all on function public.mark_notifications_read(bigint[]) from anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notify_listing_events')
     or not exists (select 1 from pg_trigger where tgname = 'notify_trade_orders') then
    raise exception 'triggers de notification absents';
  end if;

  if not exists (select 1 from pg_proc where proname = 'mark_notifications_read') then
    raise exception 'fonction mark_notifications_read absente';
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'notifications') then
    raise exception 'policy de lecture des notifications absente';
  end if;

  raise notice 'Notifications en place (% lignes).', (select count(*) from public.notifications);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop trigger if exists notify_trade_orders on public.trades;
--  drop trigger if exists notify_listing_events on public.market_listings;
--  drop function if exists public.notify_trade_orders();
--  drop function if exists public.notify_listing_events();
--  drop function if exists public.mark_notifications_read(bigint[]);
--  drop table if exists public.notifications;
-- ============================================================
