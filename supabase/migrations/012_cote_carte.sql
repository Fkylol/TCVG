-- ============================================================
--  Migration 012 — FICHE WIKI : liste d'envies et cote de marché
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Aucune table d'historique supplémentaire : `market_listings` conserve
--  déjà chaque vente (prix, date, carte, holo). Les fonctions ci-dessous
--  agrègent ces lignes sans les modifier.
-- ============================================================

-- ————— Liste d'envies —————
-- Une ligne par couple (joueur, carte). Chaque joueur ne voit et ne modifie
-- que ses propres envies ; la fiche carte lit simplement la sienne.
create table if not exists public.wishlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists wishlist_user_idx
  on public.wishlist (user_id, created_at desc);

alter table public.wishlist enable row level security;

drop policy if exists "wishlist: lecture de ses envies" on public.wishlist;
create policy "wishlist: lecture de ses envies"
  on public.wishlist for select
  using (auth.uid() = user_id);

drop policy if exists "wishlist: ajout de ses envies" on public.wishlist;
create policy "wishlist: ajout de ses envies"
  on public.wishlist for insert
  with check (auth.uid() = user_id);

drop policy if exists "wishlist: retrait de ses envies" on public.wishlist;
create policy "wishlist: retrait de ses envies"
  on public.wishlist for delete
  using (auth.uid() = user_id);

revoke all on public.wishlist from anon, authenticated;
grant select, insert, delete on public.wishlist to authenticated;

-- ————— Cote d'une carte —————
-- Médianes 7 j / 30 j, volume de ventes, annonces actives et meilleur prix,
-- plus deux séries : le prix médian par jour (30 j) et les dernières ventes.
-- Les ventes prises en compte sont les copies normales, comme la référence
-- de `market_quote()` ; les annonces comptent normales et holos.
create or replace function public.card_market_stats(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_median_7 double precision;
  v_median_30 double precision;
  v_sales_30 integer := 0;
  v_offers integer := 0;
  v_best_id bigint;
  v_best_price integer;
  v_best_holo boolean;
  v_points jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.cards where id = p_card_id) then
    raise exception 'unknown_card' using errcode = 'P0002';
  end if;

  select percentile_cont(0.5) within group (order by l.price_pixels)
    into v_median_7
    from public.market_listings l
   where l.card_id = p_card_id
     and l.holo = false
     and l.status = 'sold'
     and l.sold_at >= now() - interval '7 days';

  select
    percentile_cont(0.5) within group (order by l.price_pixels),
    count(*)::int
    into v_median_30, v_sales_30
    from public.market_listings l
   where l.card_id = p_card_id
     and l.holo = false
     and l.status = 'sold'
     and l.sold_at >= now() - interval '30 days';

  -- Les annonces du joueur sont exclues : « offres » et « ordre d'achat »
  -- désignent les copies qu'il peut réellement acheter.
  select count(*)::int into v_offers
    from public.market_listings l
   where l.card_id = p_card_id
     and l.status = 'active'
     and l.seller_id <> v_uid;

  select l.id, l.price_pixels, l.holo
    into v_best_id, v_best_price, v_best_holo
    from public.market_listings l
   where l.card_id = p_card_id
     and l.status = 'active'
     and l.seller_id <> v_uid
   order by l.price_pixels asc, l.created_at asc
   limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', d.day,
        'median', round(d.median)::int,
        'volume', d.volume
      )
      order by d.day
    ),
    '[]'::jsonb
  )
    into v_points
    from (
      select
        date_trunc('day', l.sold_at)::date as day,
        percentile_cont(0.5) within group (order by l.price_pixels) as median,
        count(*)::int as volume
        from public.market_listings l
       where l.card_id = p_card_id
         and l.holo = false
         and l.status = 'sold'
         and l.sold_at >= now() - interval '30 days'
       group by 1
    ) d;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('price', s.price_pixels, 'sold_at', s.sold_at)
      order by s.sold_at desc
    ),
    '[]'::jsonb
  )
    into v_recent
    from (
      select l.price_pixels, l.sold_at
        from public.market_listings l
       where l.card_id = p_card_id
         and l.holo = false
         and l.status = 'sold'
       order by l.sold_at desc
       limit 8
    ) s;

  return jsonb_build_object(
    'card_id', p_card_id,
    'median_7', round(v_median_7)::int,
    'median_30', round(v_median_30)::int,
    'sales_30', v_sales_30,
    'offers', v_offers,
    'lowest', v_best_price,
    'best_listing', case
      when v_best_id is null then null
      else jsonb_build_object(
        'id', v_best_id,
        'price', v_best_price,
        'holo', v_best_holo
      )
    end,
    'points', v_points,
    'recent', v_recent
  );
end;
$$;

revoke all on function public.card_market_stats(text) from public;
revoke all on function public.card_market_stats(text) from anon;
grant execute on function public.card_market_stats(text) to authenticated;

-- ————— Chance réelle par booster —————
-- Pour chaque booster actif dont le pool contient la carte : probabilité
-- d'obtenir CETTE carte dans un paquet, à partir des taux de rareté du
-- booster (filtrés sur les raretés présentes dans son pool) et du nombre de
-- cartes de chaque rareté. Même calcul que le tirage de `buy_booster()`,
-- sans le pity qui ne s'applique qu'à la première carte d'un paquet forcé.
create or replace function public.card_booster_chances(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_type public.booster_types%rowtype;
  v_rates jsonb;
  v_pool text[];
  v_total numeric;
  v_rarity text;
  v_slot numeric;
  v_count integer;
  v_chance numeric;
  v_out jsonb := '[]'::jsonb;
  v_row record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select rarity into v_rarity from public.cards where id = p_card_id;
  if not found then
    raise exception 'unknown_card' using errcode = 'P0002';
  end if;

  for v_type in
    select * from public.booster_types where active = true order by slug
  loop
    if v_type.genre_id is null then
      select array_agg(id) into v_pool from public.cards;
    else
      select array_agg(cg.card_id) into v_pool
        from public.card_genres cg
       where cg.genre_id = v_type.genre_id;
    end if;

    if v_pool is null or not (p_card_id = any (v_pool)) then
      continue;
    end if;

    v_rates := coalesce(
      v_type.drop_rates,
      (select value from public.game_config where key = 'booster_drop_rates'),
      '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
    );

    -- Une rareté absente du pool n'est jamais tirée (même filtre que l'achat).
    select coalesce(jsonb_object_agg(r.key, r.value), '{}'::jsonb)
      into v_rates
      from jsonb_each(v_rates) as r(key, value)
     where exists (
       select 1 from public.cards c
        where c.id = any (v_pool) and c.rarity = r.key
     );

    select coalesce(sum((r.value #>> '{}')::numeric), 0)
      into v_total
      from jsonb_each(v_rates) as r(key, value);

    if v_total <= 0 then
      continue;
    end if;

    v_slot := 0;
    for v_row in
      select r.key as rarity, (r.value #>> '{}')::numeric as weight
        from jsonb_each(v_rates) as r(key, value)
    loop
      select count(*)::int into v_count
        from public.cards c
       where c.id = any (v_pool)
         and c.rarity = v_row.rarity;

      -- Seule la rareté de la carte compte : les autres raretés du pool ne
      -- peuvent pas la faire sortir.
      if v_count > 0 and v_row.rarity = v_rarity then
        v_slot := v_slot + (v_row.weight / v_total) / v_count;
      end if;
    end loop;

    if v_slot <= 0 then
      continue;
    end if;

    -- Probabilité qu'au moins une des `cards_count` cartes du paquet soit
    -- la carte visée.
    v_chance := 1 - power(1 - v_slot, v_type.cards_count);

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'slug', v_type.slug,
        'name', v_type.name,
        'price', v_type.price_pixels,
        'cards', v_type.cards_count,
        'chance', v_chance
      )
    );
  end loop;

  return v_out;
end;
$$;

revoke all on function public.card_booster_chances(text) from public;
revoke all on function public.card_booster_chances(text) from anon;
grant execute on function public.card_booster_chances(text) to authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'wishlist'
  ) then
    raise exception 'table wishlist absente';
  end if;

  if not exists (select 1 from pg_proc where proname = 'card_market_stats')
     or not exists (select 1 from pg_proc where proname = 'card_booster_chances') then
    raise exception 'fonctions de la fiche carte absentes';
  end if;

  raise notice 'Fiche wiki : wishlist, cote et chances par booster en place.';
end;
$$;
