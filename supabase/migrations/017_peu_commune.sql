-- ============================================================
--  Migration 017 — Six paliers de rareté (ajout de « Peu commune »)
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Paliers, du plus courant au plus rare :
--      C  Commune      62 %     des cartes tirées
--      UC Peu commune  25 %
--      R  Rare         11,4 %
--      SR Épique        1,4 %
--      UR Légendaire    0,15 %
--      L  Mythique      0,025 %
--
--  Les clés historiques (C/R/SR/UR/L) sont conservées : seule `UC` s'ajoute.
--  Les collections ne bougent pas, mais 12 cartes changent de palier pour que
--  la Peu commune existe réellement dans le pool.
-- ============================================================

-- ————— 1. Contraintes : autoriser UC —————
alter table public.cards drop constraint if exists cards_rarity_check;
alter table public.cards
  add constraint cards_rarity_check
  check (rarity in ('C', 'UC', 'R', 'SR', 'UR', 'L'));

alter table public.market_prices drop constraint if exists market_prices_rarity_check;
alter table public.market_prices
  add constraint market_prices_rarity_check
  check (rarity in ('C', 'UC', 'R', 'SR', 'UR', 'L'));

-- ————— 2. Libellés —————
insert into public.rarity_labels (key, name, letter, token) values
  ('UC', 'Peu commune', 'U', 'rarity-U')
on conflict (key) do update
  set name = excluded.name,
      letter = excluded.letter,
      token = excluded.token;

-- « Une carte » : le palier de base s'accorde au féminin, comme les autres.
update public.rarity_labels set name = 'Commune' where key = 'C';

-- ————— 3. Valeurs de recyclage et prix de marché —————
insert into public.recycle_values (rarity, pixels) values
  ('UC', 2)
on conflict (rarity) do update set pixels = excluded.pixels;

insert into public.market_prices (rarity, base_pixels, holo_multiplier, min_pixels, max_pixels) values
  ('UC', 14, 3, 3, 45)
on conflict (rarity) do update
  set base_pixels = excluded.base_pixels,
      holo_multiplier = excluded.holo_multiplier,
      min_pixels = excluded.min_pixels,
      max_pixels = excluded.max_pixels;

-- ————— 4. Taux de tirage (pour mille, somme = 1000) —————
update public.game_config
   set value = '{"C":620.25,"UC":250,"R":114,"SR":14,"UR":1.5,"L":0.25}'::jsonb
 where key = 'booster_drop_rates';

-- ————— 5. Reclassement des 12 cartes —————
-- Sept Rares secondaires descendent, cinq Communes notables montent : la
-- Peu commune devient un vrai palier intermédiaire, sans toucher aux Épiques,
-- Légendaires et Mythiques déjà obtenues par les joueurs.
update public.cards
   set rarity = 'UC',
       updated_at = now()
 where id in (
   'arbiter', 'knuckles', 'eggman', 'king-dice', 'madeline', 'tracer', 'chun-li',
   'atreus', 'yennefer', 'pikachu', 'mercy', 'cuphead'
 );

-- ————— 6. Repli du tirage : l'ordre doit inclure UC —————
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
  v_order text[] := array['L', 'UR', 'SR', 'R', 'UC', 'C'];
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
begin
  select array_agg(id) into v_global from public.playable_cards;

  if v_global is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  if p_pool is null or array_length(p_pool, 1) is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_rates
    from jsonb_each_text(v_rates) as e(key, value)
   where exists (
     select 1 from public.playable_cards c where c.id = any (v_global) and c.rarity = e.key
   );

  if v_rates = '{}'::jsonb then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  select
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'booster_holo_chance'), 0.02),
    coalesce((select (value #>> '{}')::boolean from public.game_config where key = 'misprint_enabled'), false),
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'misprint_chance'), 0.008)
    into v_holo_chance, v_misprint, v_misprint_chance;

  for v_index in 1..p_count loop
    v_rarity := public.roll_rarity(v_rates, null, public.random_unit());

    if v_rarity is null then
      v_rarity := 'C';
    end if;

    v_card := public._pick_card(p_pool, v_rarity, v_exclude);

    if v_card is null then
      v_card := public._pick_card(v_global, v_rarity, v_exclude);
    end if;

    if v_card is null then
      v_start := array_position(v_order, v_rarity) + 1;
      if v_start is not null then
        for v_step in v_start..array_length(v_order, 1) loop
          v_card := public._pick_card(p_pool, v_order[v_step], v_exclude);
          if v_card is null then
            v_card := public._pick_card(v_global, v_order[v_step], v_exclude);
          end if;
          exit when v_card is not null;
        end loop;
      end if;
    end if;

    if v_card is null then
      v_card := public._pick_card(v_global, null, v_exclude);
    end if;

    if v_card is null then
      v_card := public._pick_card(p_pool, null, '{}');
      if v_card is null then
        v_card := public._pick_card(v_global, null, '{}');
      end if;
    end if;

    if v_card is null then
      raise exception 'booster_empty' using errcode = '22023';
    end if;

    v_exclude := v_exclude || v_card;

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

revoke all on function public._draw_cards(text[], integer, jsonb) from public;

-- ————— 7. Contrôles finaux —————
do $$
declare
  v_counts text;
  v_uc integer;
  v_chances jsonb;
begin
  select string_agg(rarity || '=' || total, ' · ' order by rarity)
    into v_counts
    from (select rarity, count(*)::int as total from public.cards group by rarity) s;

  select count(*)::int into v_uc from public.cards where rarity = 'UC';

  if v_uc = 0 then
    raise exception 'aucune carte en Peu commune : le palier ne sortirait jamais';
  end if;

  select chances into v_chances from public.pack_stats() where slug = 'mix';

  if abs((v_chances ->> 'R')::double precision - 0.4546) > 0.01 then
    raise exception 'chance Rare inattendue : %', v_chances ->> 'R';
  end if;

  raise notice 'raretés : % · chances Mix : %', v_counts, v_chances;
end;
$$;

-- ============================================================
--  ROLLBACK
-- ============================================================
-- update public.cards set rarity = 'R'
--  where id in ('arbiter','knuckles','eggman','king-dice','madeline','tracer','chun-li');
-- update public.cards set rarity = 'C'
--  where id in ('atreus','yennefer','pikachu','mercy','cuphead');
--
-- delete from public.recycle_values where rarity = 'UC';
-- delete from public.market_prices where rarity = 'UC';
-- update public.rarity_labels set name = 'Commun' where key = 'C';
-- delete from public.rarity_labels where key = 'UC';
--
-- update public.game_config
--    set value = '{"C":525.2,"R":432.1,"SR":38,"UR":4.04,"L":0.66}'::jsonb
--  where key = 'booster_drop_rates';
--
-- alter table public.cards drop constraint if exists cards_rarity_check;
-- alter table public.cards
--   add constraint cards_rarity_check check (rarity in ('C', 'R', 'SR', 'UR', 'L'));
-- alter table public.market_prices drop constraint if exists market_prices_rarity_check;
-- alter table public.market_prices
--   add constraint market_prices_rarity_check check (rarity in ('C', 'R', 'SR', 'UR', 'L'));
