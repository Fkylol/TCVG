-- ============================================================
--  Migration 015 — Packs gratuits, disponibilité, chances
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Plus de boutique : tous les packs s'ouvrent avec le stock de boosters
--  (recharge toutes les 10 minutes, plafond 10). Les Pixels restent pour le
--  recyclage et l'historique ; aucun achat de booster n'est possible.
-- ============================================================

-- ————— 1. Réglages —————
-- Seuil de cartes actives en dessous duquel un pack est « bientôt disponible ».
-- Miroir de MIN_POOL_SIZE dans src/lib/packs.ts.
insert into public.game_config (key, value) values
  ('pack_min_pool_size', '15'::jsonb)
on conflict (key) do nothing;

-- ————— 2. Fin de la boutique —————
drop function if exists public.buy_booster(text);

-- Le prix n'a plus de sens : tous les packs sont gratuits.
alter table public.booster_types drop column if exists price_pixels;

-- ————— 3. Disponibilité et chances —————
-- Une seule source : le pool réellement utilisé par open_pack(), le seuil de
-- game_config et les poids de rareté. Rien n'est codé en dur dans l'interface.
create or replace function public.pack_stats()
returns table (
  slug text,
  name text,
  genre_id uuid,
  cards_count integer,
  pool_size integer,
  min_pool_size integer,
  available boolean,
  chances jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_min integer := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'pack_min_pool_size'),
    15
  );
  v_global text[];
  v_rates jsonb;
  v_total numeric := 0;
  v_available_rarities text[] := '{}';
  v_row record;
  v_row2 record;
  v_pool integer;
  v_chances jsonb;
  v_p numeric;
begin
  select array_agg(id) into v_global from public.playable_cards;

  if v_global is null then
    v_global := '{}'::text[];
  end if;

  -- Raretés réellement présentes dans le catalogue actif.
  select coalesce(array_agg(distinct c.rarity), '{}'::text[])
    into v_available_rarities
    from public.playable_cards c;

  v_rates := coalesce(
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  for v_row in
    select e.key as rarity, e.value::numeric as weight
      from jsonb_each_text(v_rates) as e(key, value)
     where e.key = any (v_available_rarities)
  loop
    v_total := v_total + v_row.weight;
  end loop;

  for v_row in
    select pt.slug, pt.name, pt.genre_id, pt.cards_count
      from public.booster_types pt
     where pt.active
  loop
    if v_row.genre_id is null then
      v_pool := array_length(v_global, 1);
    else
      select count(*)::int into v_pool
        from public.playable_cards c
        join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_row.genre_id;
    end if;

    v_pool := coalesce(v_pool, 0);
    v_chances := '{}'::jsonb;

    -- Chance d'obtenir au moins une carte de la rareté dans le booster :
    -- 1 - (1 - p)^n, p = poids de la rareté parmi celles du catalogue actif.
    -- Le repli du tirage ramène à la même rareté via le pool global, donc la
    -- distribution effective par carte est celle des poids.
    for v_row2 in
      select e.key as rarity, e.value::numeric as weight
        from jsonb_each_text(v_rates) as e(key, value)
       where e.key = any (v_available_rarities)
    loop
      v_p := case when v_total > 0 then v_row2.weight / v_total else 0 end;
      v_chances := v_chances || jsonb_build_object(
        v_row2.rarity,
        round((1 - power(1 - v_p, v_row.cards_count))::numeric, 4)
      );
    end loop;

    slug := v_row.slug;
    name := v_row.name;
    genre_id := v_row.genre_id;
    cards_count := v_row.cards_count;
    pool_size := v_pool;
    min_pool_size := v_min;
    available := v_pool >= v_min;
    chances := v_chances;
    return next;
  end loop;
end;
$$;

revoke all on function public.pack_stats() from public;
grant execute on function public.pack_stats() to anon, authenticated;

-- ————— 4. open_pack refuse un pack indisponible —————
create or replace function public.open_pack(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pack public.booster_types%rowtype;
  v_pool text[];
  v_rates jsonb;
  v_min integer;
  v_stock integer;
  v_anchor timestamptz;
  v_accrued integer;
  v_after integer;
  v_new_stock integer;
  v_new_anchor timestamptz;
  v_cards jsonb;
  v_server_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_pack
    from public.booster_types
   where slug = p_slug and active = true;

  if not found then
    raise exception 'unknown_pack' using errcode = 'P0002';
  end if;

  if v_pack.genre_id is null then
    select array_agg(id) into v_pool from public.playable_cards;
  else
    select array_agg(c.id) into v_pool
      from public.playable_cards c
      join public.card_genres cg on cg.card_id = c.id
     where cg.genre_id = v_pack.genre_id;
  end if;

  -- Le serveur applique le même seuil que l'interface : un pack grisé ne
  -- s'ouvre pas, même en appelant la fonction directement.
  v_min := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'pack_min_pool_size'),
    15
  );

  if v_pool is null or array_length(v_pool, 1) < v_min then
    raise exception 'pack_unavailable' using errcode = '22023';
  end if;

  v_rates := coalesce(
    v_pack.drop_rates,
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  select booster_stock, last_booster_at
    into v_stock, v_anchor
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  v_accrued := floor(
    extract(epoch from (v_server_now - coalesce(v_anchor, v_server_now))) / 600
  )::int;
  v_after := least(10, v_stock + v_accrued);

  if v_after < 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'no_stock',
      'stock', v_after,
      'anchor', v_anchor,
      'server_now', v_server_now
    );
  end if;

  update public.profiles
     set booster_stock = v_after - 1,
         last_booster_at = case
           when v_after >= 10 then v_server_now
           else coalesce(v_anchor, v_server_now) + make_interval(secs => v_accrued * 600)
         end,
         boosters_opened = boosters_opened + 1
   where id = v_uid
     and booster_stock = v_stock
     and last_booster_at is not distinct from v_anchor
  returning booster_stock, last_booster_at into v_new_stock, v_new_anchor;

  if not found then
    raise exception 'concurrent_open' using errcode = '40001';
  end if;

  v_cards := public._draw_cards(v_pool, v_pack.cards_count, v_rates);
  v_cards := public._store_cards(v_uid, v_cards);

  return jsonb_build_object(
    'ok', true,
    'pack', v_pack.slug,
    'cards', v_cards,
    'stock', v_new_stock,
    'anchor', v_new_anchor,
    'server_now', v_server_now
  );
end;
$$;

revoke all on function public.open_pack(text) from public;
revoke all on function public.open_pack(text) from anon;
grant execute on function public.open_pack(text) to authenticated;

-- ————— 4 bis. Personnages d'un pack (liste de la modale) —————
-- Uniquement des cartes jouables : une carte ou une franchise retirée
-- n'apparaît pas dans la liste et ne compte pas dans le total.
create or replace function public.pack_cards(p_slug text)
returns table (id text, rarity text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.rarity
    from public.playable_cards c
   where exists (
     select 1
       from public.booster_types bt
      where bt.slug = p_slug
        and bt.active
        and (
          bt.genre_id is null
          or exists (
            select 1 from public.card_genres cg
             where cg.card_id = c.id and cg.genre_id = bt.genre_id
          )
        )
   )
$$;

revoke all on function public.pack_cards(text) from public;
grant execute on function public.pack_cards(text) to anon, authenticated;

-- ————— 5. Contrôles finaux —————
do $$
declare
  v_packs integer;
  v_price boolean;
  v_buy boolean;
begin
  select count(*) into v_packs from public.booster_types where active;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'booster_types' and column_name = 'price_pixels'
  ) into v_price;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'buy_booster'
  ) into v_buy;

  if v_price then
    raise exception 'price_pixels existe encore sur booster_types';
  end if;

  if v_buy then
    raise exception 'buy_booster() existe encore';
  end if;

  raise notice 'packs gratuits : % actifs, plus aucun achat', v_packs;
end;
$$;

-- ============================================================
--  ROLLBACK
-- ============================================================
-- alter table public.booster_types add column if not exists price_pixels integer not null default 30;
-- drop function if exists public.pack_cards(text);
-- drop function if exists public.pack_stats();
-- delete from public.game_config where key = 'pack_min_pool_size';
-- -- buy_booster(text) est à recréer depuis la migration 014 si besoin.
