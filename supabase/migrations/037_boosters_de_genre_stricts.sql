-- ============================================================
--  Migration 037 — Un booster de genre ne sort que des cartes du genre
--  Rejouable sans risque.
--
--  Constat : un paquet MMO rendait parfois des cartes Resident Evil, Witcher ou
--  Final Fantasy VII. Cause : `_draw_cards` tire la rareté, puis la carte dans
--  le pool du genre ; si cette rareté est épuisée, il se replie sur *tout* le
--  catalogue. Le pool MMO ne comptait qu'une Commune et deux Peu communes pour
--  cent cartes (héritage d'un import qui avait promu presque chaque univers en
--  Légendaire), donc le repli se déclenchait à chaque paquet.
--
--  Correctif : le pool d'un genre devient une frontière. Les raretés sont
--  d'abord filtrées sur celles réellement présentes dans le pool, les replis
--  restent à l'intérieur du genre, et le catalogue global ne sert plus que de
--  secours pour le pack Mix (qui EST le catalogue). Les chances affichées par
--  `pack_stats()` sont calculées de la même façon, pool par pool.
-- ============================================================

-- ————— 1. Tirage : plus de sortie du pool —————
create or replace function public._draw_cards(
  p_pool text[],
  p_count integer,
  p_rates jsonb
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_global text[];
  v_strict boolean;
  v_order text[] := array['L', 'UR', 'SR', 'R', 'C'];
  v_rates jsonb := p_rates;
  v_exclude text[] := '{}';
  v_cards jsonb := '[]'::jsonb;
  v_rarity text;
  v_card text;
  v_real text;
  v_start integer;
  v_index integer;
  v_step integer;
  v_holo boolean;
  v_variant text;
  v_holo_chance numeric;
  v_misprint boolean;
  v_misprint_chance numeric;
  v_boost numeric;
  v_window interval;
begin
  select array_agg(id) into v_global from public.playable_cards;

  if v_global is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  if p_pool is null or array_length(p_pool, 1) is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  -- Un pool qui ne contient pas tout le catalogue est un pool de genre : le
  -- tirage ne doit jamais en sortir.
  v_strict := exists (
    select 1 from public.playable_cards c where not (c.id = any (p_pool))
  );

  -- Une rareté absente du pool n'est jamais tirée : les poids se renormalisent
  -- sur celles qui restent (le pack Stratégie n'affiche donc pas de Mythique).
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_rates
    from jsonb_each_text(v_rates) as e(key, value)
   where exists (
     select 1 from public.playable_cards c
      where c.id = any (p_pool) and c.rarity = e.key
   );

  if v_rates = '{}'::jsonb then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  select
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'booster_holo_chance'), 0.02),
    coalesce((select (value #>> '{}')::boolean from public.game_config where key = 'misprint_enabled'), false),
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'misprint_chance'), 0.008),
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'new_card_boost'), 1),
    make_interval(days => coalesce(
      (select (value #>> '{}')::int from public.game_config where key = 'new_card_window_days'),
      0
    ))
    into v_holo_chance, v_misprint, v_misprint_chance, v_boost, v_window;

  for v_index in 1..p_count loop
    v_rarity := public.roll_rarity(v_rates, null, public.random_unit());

    if v_rarity is null then
      v_rarity := 'C';
    end if;

    -- 1. la rareté demandée dans le pool du paquet
    v_card := public._pick_card(p_pool, v_rarity, v_exclude, v_boost, v_window);

    -- 2. même rareté ailleurs : réservé au Mix, qui couvre déjà tout le catalogue
    if v_card is null and not v_strict then
      v_card := public._pick_card(v_global, v_rarity, v_exclude, v_boost, v_window);
    end if;

    -- 3. les raretés inférieures, dans le pool puis (Mix seulement) ailleurs
    if v_card is null then
      v_start := array_position(v_order, v_rarity) + 1;
      if v_start is not null then
        for v_step in v_start..array_length(v_order, 1) loop
          v_card := public._pick_card(p_pool, v_order[v_step], v_exclude, v_boost, v_window);
          if v_card is null and not v_strict then
            v_card := public._pick_card(v_global, v_order[v_step], v_exclude, v_boost, v_window);
          end if;
          exit when v_card is not null;
        end loop;
      end if;
    end if;

    -- 4. n'importe quelle carte du pool
    if v_card is null then
      v_card := public._pick_card(p_pool, null, v_exclude, v_boost, v_window);
    end if;

    if v_card is null and not v_strict then
      v_card := public._pick_card(v_global, null, v_exclude, v_boost, v_window);
    end if;

    -- 5. pool plus petit que le paquet : doublon interne toléré
    if v_card is null then
      v_card := public._pick_card(p_pool, null, '{}', v_boost, v_window);
    end if;

    if v_card is null and not v_strict then
      v_card := public._pick_card(v_global, null, '{}', v_boost, v_window);
    end if;

    if v_card is null then
      raise exception 'booster_empty' using errcode = '22023';
    end if;

    v_exclude := v_exclude || v_card;

    -- La rareté annoncée est celle de la carte réellement tirée (le repli peut
    -- descendre d'une rareté).
    select rarity into v_real from public.playable_cards where id = v_card;

    v_holo := public.random_unit() < v_holo_chance;
    v_variant := null;
    if v_misprint and public.random_unit() < v_misprint_chance then
      v_variant := (array['holo_bleed', 'off_center', 'ghosting'])[
        1 + floor(public.random_unit() * 3)::int
      ];
    end if;

    v_cards := v_cards || jsonb_build_object(
      'id', v_card,
      'rarity', v_real,
      'holo', v_holo,
      'variant', v_variant
    );
  end loop;

  return v_cards;
end;
$$;

-- ————— 2. Chances affichées : celles du pool, pas du catalogue —————
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
  v_rates jsonb;
  v_row record;
  v_row2 record;
  v_rarities text[];
  v_pool integer;
  v_total numeric;
  v_p numeric;
  v_chances jsonb;
begin
  v_rates := coalesce(
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  for v_row in
    select pt.slug, pt.name, pt.genre_id, pt.cards_count
      from public.booster_types pt
     where pt.active
  loop
    if v_row.genre_id is null then
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities
        from public.playable_cards c;
    else
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities
        from public.playable_cards c
        join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_row.genre_id;
    end if;

    v_pool := coalesce(v_pool, 0);

    -- Seules les raretés présentes dans le pool comptent : le tirage ne peut
    -- plus sortir du genre pour aller chercher celle qui manque.
    select coalesce(sum(e.value::numeric), 0)
      into v_total
      from jsonb_each_text(v_rates) as e(key, value)
     where e.key = any (v_rarities);

    v_chances := '{}'::jsonb;

    -- Chance d'obtenir au moins une carte de la rareté dans le booster :
    -- 1 - (1 - p)^n, p = poids de la rareté parmi celles du pool.
    for v_row2 in
      select e.key as rarity, e.value::numeric as weight
        from jsonb_each_text(v_rates) as e(key, value)
       where e.key = any (v_rarities)
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

revoke all on function public._draw_cards(text[], integer, jsonb) from public;
revoke all on function public._draw_cards(text[], integer, jsonb) from anon;
revoke all on function public._draw_cards(text[], integer, jsonb) from authenticated;

-- ————— 3. Contrôles —————
-- Un tirage de contrôle par pack de genre : aucune carte ne doit sortir du
-- pool. Chaque pack est tiré une fois ; sur trente paquets, une fuite se voit.
do $$
declare
  v_leak integer;
begin
  select count(*)::int into v_leak
    from (
      select bt.genre_id,
             public._draw_cards(
               (select array_agg(c.id)
                  from public.playable_cards c
                  join public.card_genres cg on cg.card_id = c.id
                 where cg.genre_id = bt.genre_id),
               bt.cards_count,
               (select value from public.game_config where key = 'booster_drop_rates')
             ) as drawn
        from public.booster_types bt
       where bt.active
         and bt.genre_id is not null
    ) as paquet
    cross join lateral jsonb_array_elements(paquet.drawn) as carte
   where not exists (
     select 1 from public.card_genres cg
      where cg.card_id = carte ->> 'id' and cg.genre_id = paquet.genre_id
   );

  if v_leak > 0 then
    raise exception 'fuite hors genre : % carte(s)', v_leak;
  end if;

  raise notice 'Tirage de genre : aucune carte hors pool.';
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  -- Réappliquer `_draw_cards` de la migration 036 et `pack_stats` de la 015.
-- ============================================================
