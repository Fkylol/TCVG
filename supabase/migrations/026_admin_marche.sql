-- ============================================================
--  Migration 026 — ADMINISTRATION DU MARCHÉ
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  • `profiles.is_admin` — drapeau d'administration, jamais modifiable par le
--    client (`update` est restreint à la colonne `username` depuis le schéma) ;
--  • `is_admin()` — vrai si le joueur connecté porte le drapeau ;
--  • `admin_market_report(days)` — rapport réservé à l'administration :
--    volumes, vendeurs, cartes, paires d'échange croisées, rafales d'actions
--    et fin du journal d'audit.
--
--  Aucune donnée n'est exposée aux joueurs : la fonction vérifie elle-même le
--  drapeau et lève `not_admin` sinon. La promotion se fait par script
--  (`npm run db:admin -- <pseudo>`) ou depuis le SQL Editor.
-- ============================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ————— Vérification du drapeau —————
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ————— Rapport d'administration —————
-- `p_days` est borné à 90 jours : au-delà, l'agrégat perd son intérêt et
-- coûte cher. Les « paires croisées » sont des couples qui se revendent des
-- cartes dans les deux sens : le schéma typique d'un compte lié.
create or replace function public.admin_market_report(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_days, 7), 1), 90);
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', v_days,
    'trades', (
      select count(*)::int from public.trades where created_at >= v_since
    ),
    'volume', (
      select coalesce(sum(price), 0)::int from public.trades where created_at >= v_since
    ),
    'fees', (
      select coalesce(sum(fee), 0)::int from public.trades where created_at >= v_since
    ),
    'buyers', (
      select count(distinct buyer_id)::int from public.trades where created_at >= v_since
    ),
    'listings', (
      select count(*)::int from public.market_listings
       where status = 'active' and (expires_at is null or expires_at > now())
    ),
    'orders', (
      select count(*)::int from public.buy_orders where status = 'active'
    ),
    'top_sellers', coalesce(
      (
        select jsonb_agg(entry order by entry ->> 'trades' desc)
          from (
            select jsonb_build_object(
                     'username', p.username,
                     'trades', count(*)::int,
                     'volume', coalesce(sum(t.price), 0)::int,
                     'net', coalesce(sum(t.seller_payout), 0)::int
                   ) as entry
              from public.trades t
              join public.profiles p on p.id = t.seller_id
             where t.created_at >= v_since
             group by p.username
             order by count(*) desc
             limit 5
          ) as ranked
      ),
      '[]'::jsonb
    ),
    'top_cards', coalesce(
      (
        select jsonb_agg(entry order by entry ->> 'volume' desc)
          from (
            select jsonb_build_object(
                     'card_id', card_id,
                     'trades', count(*)::int,
                     'volume', coalesce(sum(price), 0)::int,
                     'lowest', min(price)::int,
                     'highest', max(price)::int
                   ) as entry
              from public.trades
             where created_at >= v_since
             group by card_id
             order by sum(price) desc
             limit 5
          ) as ranked
      ),
      '[]'::jsonb
    ),
    'pairs', coalesce(
      (
        select jsonb_agg(entry order by entry ->> 'total' desc)
          from (
            select jsonb_build_object(
                     'a', pa.username,
                     'b', pb.username,
                     'ab', x.ab,
                     'ba', x.ba,
                     'total', x.ab + x.ba
                   ) as entry
              from (
                select
                  least(t.buyer_id, t.seller_id) as a_id,
                  greatest(t.buyer_id, t.seller_id) as b_id,
                  count(*) filter (where t.buyer_id = least(t.buyer_id, t.seller_id))::int as ab,
                  count(*) filter (where t.seller_id = least(t.buyer_id, t.seller_id))::int as ba
                  from public.trades t
                 where t.created_at >= v_since
                   and t.buyer_id <> t.seller_id
                 group by 1, 2
                having count(*) filter (where t.buyer_id = least(t.buyer_id, t.seller_id)) >= 2
                   and count(*) filter (where t.seller_id = least(t.buyer_id, t.seller_id)) >= 2
              ) as x
              join public.profiles pa on pa.id = x.a_id
              join public.profiles pb on pb.id = x.b_id
             order by x.ab + x.ba desc
             limit 10
          ) as ranked
      ),
      '[]'::jsonb
    ),
    'bursts', coalesce(
      (
        select jsonb_agg(entry order by entry ->> 'actions' desc)
          from (
            select jsonb_build_object(
                     'username', p.username,
                     'actions', count(*)::int
                   ) as entry
              from public.market_audit ma
              join public.profiles p on p.id = ma.actor_id
             where ma.created_at >= v_since
             group by p.username
            having count(*) >= 20
             order by count(*) desc
             limit 5
          ) as ranked
      ),
      '[]'::jsonb
    ),
    'audit', coalesce(
      (
        select jsonb_agg(entry order by entry ->> 'at' desc)
          from (
            select jsonb_build_object(
                     'at', ma.created_at,
                     'actor', coalesce(p.username, '—'),
                     'action', ma.action,
                     'card_id', ma.card_id,
                     'amount', ma.amount,
                     'details', ma.details
                   ) as entry
              from public.market_audit ma
              left join public.profiles p on p.id = ma.actor_id
             order by ma.created_at desc
             limit 50
          ) as recent
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.admin_market_report(integer) from public;
revoke all on function public.admin_market_report(integer) from anon;
grant execute on function public.admin_market_report(integer) to authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name = 'is_admin') then
    raise exception 'colonne is_admin absente';
  end if;

  if not has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'update') then
    raise notice 'is_admin non modifiable par les joueurs : correct.';
  else
    raise exception 'les joueurs peuvent modifier is_admin';
  end if;

  if not exists (select 1 from pg_proc where proname = 'admin_market_report') then
    raise exception 'rapport d''administration absent';
  end if;

  raise notice 'Administration du marché en place (% administrateur(s)).',
    (select count(*) from public.profiles where is_admin);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop function if exists public.admin_market_report(integer);
--  drop function if exists public.is_admin();
--  alter table public.profiles drop column if exists is_admin;
-- ============================================================
