-- ============================================================
--  Migration 025 — MARCHÉ : statistiques publiques et historique complet
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Aucune nouvelle table : `trades` est déjà l'historique immuable du marché.
--  Deux lectures agrégées, réservées aux joueurs connectés :
--    • `market_overview()` — volume, ventes, commission détruite, annonces et
--      ordres actifs, cartes les plus échangées sur 7 jours ;
--    • `card_sales_history(carte, limite, décalage)` — toutes les ventes d'une
--      carte, du plus récent au plus ancien, avec le total pour la pagination.
--
--  Aucune identité n'est exposée : ni pseudo, ni identifiant de joueur.
-- ============================================================

-- ————— Les ventes directes rejoignent `trades` —————
-- `match_card_orders()` écrit lui-même l'historique, mais `buy_listing()`
-- (achat immédiat) ne le faisait pas : les ventes directes manquaient à la
-- cote, aux statistiques et au journal d'audit. Un trigger **différé** comble
-- le trou sans toucher aux fonctions : il s'exécute à la fin de la transaction,
-- quand l'appariement a déjà écrit sa ligne, et n'insère que s'il n'en existe
-- aucune pour cette annonce.
create or replace function public.record_direct_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' and new.buyer_id is not null then
    insert into public.trades
      (card_id, holo, listing_id, buyer_id, seller_id, price, fee, seller_payout)
    select
      new.card_id, new.holo, new.id, new.buyer_id, new.seller_id,
      new.price_pixels,
      coalesce(new.fee_pixels, 0),
      coalesce(new.seller_payout, new.price_pixels)
    where not exists (
      select 1 from public.trades t where t.listing_id = new.id
    );
  end if;

  return null;
end;
$$;

revoke all on function public.record_direct_sale() from public;
revoke all on function public.record_direct_sale() from anon;
revoke all on function public.record_direct_sale() from authenticated;

drop trigger if exists record_direct_sale on public.market_listings;
create constraint trigger record_direct_sale
  after update on public.market_listings
  deferrable initially deferred
  for each row execute function public.record_direct_sale();

-- Reprise des ventes directes déjà passées : l'historique est reconstitué
-- depuis l'annonce vendue, avec sa date réelle. L'audit de ces lignes est
-- coupé le temps de l'insertion — ce sont des ventes anciennes, pas des
-- événements du jour.
alter table public.trades disable trigger market_audit_trades;

alter table public.trades disable trigger notify_trade_orders;

insert into public.trades
  (card_id, holo, listing_id, buyer_id, seller_id, price, fee, seller_payout, created_at)
select
  l.card_id, l.holo, l.id, l.buyer_id, l.seller_id,
  l.price_pixels, coalesce(l.fee_pixels, 0),
  coalesce(l.seller_payout, l.price_pixels - coalesce(l.fee_pixels, 0)),
  coalesce(l.sold_at, l.created_at)
from public.market_listings l
where l.status = 'sold'
  and l.buyer_id is not null
  and l.fee_pixels is not null
  and not exists (select 1 from public.trades t where t.listing_id = l.id);

alter table public.trades enable trigger notify_trade_orders;
alter table public.trades enable trigger market_audit_trades;

-- ————— Vue d'ensemble du marché —————
create or replace function public.market_overview()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'trades_24h',
      (select count(*)::int from public.trades where created_at >= now() - interval '24 hours'),
    'volume_24h',
      (select coalesce(sum(price), 0)::int from public.trades where created_at >= now() - interval '24 hours'),
    'fees_24h',
      (select coalesce(sum(fee), 0)::int from public.trades where created_at >= now() - interval '24 hours'),
    'trades_7d',
      (select count(*)::int from public.trades where created_at >= now() - interval '7 days'),
    'volume_7d',
      (select coalesce(sum(price), 0)::int from public.trades where created_at >= now() - interval '7 days'),
    'listings',
      (select count(*)::int
         from public.market_listings
        where status = 'active'
          and (expires_at is null or expires_at > now())),
    'orders',
      (select count(*)::int from public.buy_orders where status = 'active'),
    'top_cards',
      coalesce(
        (
          select jsonb_agg(entry order by entry ->> 'volume' desc)
            from (
              select jsonb_build_object(
                       'card_id', card_id,
                       'count', count(*)::int,
                       'volume', sum(price)::int,
                       'lowest', min(price)::int,
                       'highest', max(price)::int
                     ) as entry
                from public.trades
               where created_at >= now() - interval '7 days'
               group by card_id
               order by sum(price) desc
               limit 5
            ) as ranked
        ),
        '[]'::jsonb
      )
  );
$$;

revoke all on function public.market_overview() from public;
revoke all on function public.market_overview() from anon;
grant execute on function public.market_overview() to authenticated;

-- ————— Historique complet d'une carte —————
-- `total` est répété sur chaque ligne : une seule requête suffit au client
-- pour savoir s'il reste des ventes à charger.
create or replace function public.card_sales_history(
  p_card_id text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  total bigint,
  price integer,
  holo boolean,
  sold_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  with scoped as (
    select t.price, t.holo, t.created_at
      from public.trades t
     where t.card_id = p_card_id
  )
  select
    (select count(*) from scoped) as total,
    s.price,
    s.holo,
    s.created_at as sold_at
  from scoped s
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.card_sales_history(text, integer, integer) from public;
revoke all on function public.card_sales_history(text, integer, integer) from anon;
grant execute on function public.card_sales_history(text, integer, integer) to authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'market_overview')
     or not exists (select 1 from pg_proc where proname = 'card_sales_history') then
    raise exception 'fonctions de statistiques absentes';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'record_direct_sale') then
    raise exception 'trigger de reprise des ventes directes absent';
  end if;

  if exists (
    select 1 from public.market_listings l
     where l.status = 'sold'
       and l.buyer_id is not null
       and l.fee_pixels is not null
       and not exists (select 1 from public.trades t where t.listing_id = l.id)
  ) then
    raise exception 'des ventes vendues restent absentes de trades';
  end if;

  if (select count(*) from public.trades) > 0 then
    raise notice 'Statistiques en place : % ventes, % Pixels échangés.',
      (select count(*) from public.trades),
      (select coalesce(sum(price), 0) from public.trades);
  else
    raise notice 'Statistiques en place : aucune vente pour le moment.';
  end if;
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop trigger if exists record_direct_sale on public.market_listings;
--  drop function if exists public.record_direct_sale();
--  drop function if exists public.card_sales_history(text, integer, integer);
--  drop function if exists public.market_overview();
--  -- Les ventes directes reprises dans `trades` restent : les supprimer
--  -- fausserait la cote. Pour revenir en arrière :
--  -- delete from public.trades where order_id is null and listing_id is not null;
-- ============================================================
