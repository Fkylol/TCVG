-- ============================================================
-- 036 — Les nouveautés pèsent plus lourd dans les boosters
--
-- Constat : à 571 cartes, les dix dernières ajoutées sortaient dans ~12 % des
-- boosters Mix. Un joueur qui ouvre deux ou trois paquets ne les voit donc
-- jamais, et croit qu'elles ne sont pas dans le pool.
--
-- Correctif : chaque carte entrée au catalogue depuis moins de sept jours voit
-- son poids multiplié par cinq au tirage. Le tirage par rareté est conservé —
-- seules les cartes récentes d'une rareté donnée sont favorisées entre elles.
--
-- `added_at` n'est jamais touché par `npm run db:cards` (qui ne fait que
-- recopier les autres colonnes) : la date d'entrée est stable.
-- ============================================================

-- ————— 1. Date d'entrée au catalogue —————
alter table public.cards
  add column if not exists added_at timestamptz;

comment on column public.cards.added_at is
  'Date d''entrée au catalogue. Jamais réécrite par db:cards : sert à pondérer les nouveautés.';

-- Le catalogue existant a déjà plusieurs semaines : on le date « ancien », puis
-- on remet à maintenant les cartes réellement ajoutées aujourd'hui.
update public.cards
   set added_at = now() - interval '30 days'
 where added_at is null;

update public.cards
   set added_at = now()
 where id in (
   -- Elden Ring, Bloodborne, Cyberpunk 2077
   'tarnished', 'ranni', 'hunter-bloodborne', 'v',
   -- Skyrim, Fallout, Mass Effect, Borderlands
   'lydia', 'maiq', 'dogmeat', 'vendeur-vault-tec', 'conrad-verner',
   'claptrap', 'face-mcshooty', 'jackie-welles', 'johnny-sasaki', 'villageois',
   -- Seconds rôles indés
   'louis', 'spy', 'heavy', 'm-qi', 'cornifer', 'hypnos', 'diable', 'pda',
   'prisonnier', 'zombie-cone', 'zero', 'oie',
   -- Délirants
   'jacket', 'wilson', 'tournesol', 'imposteur', 'fall-guy', 'pilgor',
   'shovel-knight', 'meat-boy', 'petit-garcon', 'inspecteur'
 );

alter table public.cards
  alter column added_at set default now(),
  alter column added_at set not null;

create index if not exists cards_added_at_idx on public.cards (added_at desc);

-- ————— 2. Réglages —————
insert into public.game_config (key, value) values
  ('new_card_boost', '5'::jsonb),
  ('new_card_window_days', '7'::jsonb)
on conflict (key) do nothing;

-- ————— 3. La vue expose la date d'entrée —————
create or replace view public.playable_cards
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.rarity,
  c.number,
  c.franchise_id,
  c.added_at
  from public.cards c
  join public.franchises f on f.id = c.franchise_id
 where c.active
   and f.active;

-- ————— 4. Tirage pondéré —————
-- Poids 1 par défaut : sans réglage, le comportement reste uniforme.
create or replace function public._pick_card(
  p_pool text[],
  p_rarity text,
  p_exclude text[],
  p_boost numeric default 1,
  p_window interval default '0 days'
)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_ids text[];
  v_weights numeric[];
  v_total numeric;
  v_roll numeric;
  v_cum numeric := 0;
  v_position integer;
begin
  if p_pool is null or array_length(p_pool, 1) is null then
    return null;
  end if;

  select array_agg(candidate.id), array_agg(candidate.weight)
    into v_ids, v_weights
    from (
      select c.id,
             case
               when p_boost > 1 and p_window > interval '0 days'
                    and c.added_at > now() - p_window
                 then p_boost
               else 1::numeric
             end as weight
        from public.playable_cards c
       where c.id = any (p_pool)
         and (p_rarity is null or c.rarity = p_rarity)
         and (
           p_exclude is null
           or array_length(p_exclude, 1) is null
           or not (c.id = any (p_exclude))
         )
    ) as candidate;

  if v_ids is null then
    return null;
  end if;

  select sum(weight) into v_total from unnest(v_weights) as weights(weight);
  v_roll := public.random_unit() * v_total;
  v_position := 1;

  -- `array_agg` garde l'ordre de la sous-requête : on parcourt les poids dans
  -- le même ordre que les identifiants.
  loop
    v_cum := v_cum + v_weights[v_position];
    exit when v_roll < v_cum or v_position >= array_length(v_ids, 1);
    v_position := v_position + 1;
  end loop;

  return v_ids[v_position];
end;
$$;

-- ————— 5. Le tirage lit les réglages une fois par paquet —————
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

  -- Une rareté absente du catalogue actif n'est jamais tirée.
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

    -- 1. la rareté demandée dans le genre du pack
    v_card := public._pick_card(p_pool, v_rarity, v_exclude, v_boost, v_window);

    -- 2. la même rareté, mais partout dans le catalogue actif
    if v_card is null then
      v_card := public._pick_card(v_global, v_rarity, v_exclude, v_boost, v_window);
    end if;

    -- 3. les raretés inférieures, genre puis global
    if v_card is null then
      v_start := array_position(v_order, v_rarity) + 1;
      if v_start is not null then
        for v_step in v_start..array_length(v_order, 1) loop
          v_card := public._pick_card(p_pool, v_order[v_step], v_exclude, v_boost, v_window);
          if v_card is null then
            v_card := public._pick_card(v_global, v_order[v_step], v_exclude, v_boost, v_window);
          end if;
          exit when v_card is not null;
        end loop;
      end if;
    end if;

    -- 4. n'importe quelle carte active
    if v_card is null then
      v_card := public._pick_card(v_global, null, v_exclude, v_boost, v_window);
    end if;

    -- 5. pool plus petit que le paquet : doublon interne toléré
    if v_card is null then
      v_card := public._pick_card(p_pool, null, '{}', v_boost, v_window);
      if v_card is null then
        v_card := public._pick_card(v_global, null, '{}', v_boost, v_window);
      end if;
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

-- ————— 6. Contrôles finaux —————
do $$
declare
  v_boost numeric;
  v_window integer;
  v_recent integer;
  v_drawn integer;
  v_column integer;
begin
  select count(*)::int into v_column
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cards' and column_name = 'added_at';

  if v_column = 0 then
    raise exception 'colonne cards.added_at absente';
  end if;

  select (value #>> '{}')::numeric into v_boost
    from public.game_config where key = 'new_card_boost';
  select (value #>> '{}')::int into v_window
    from public.game_config where key = 'new_card_window_days';

  if v_boost is null or v_window is null then
    raise exception 'réglages new_card_boost / new_card_window_days absents';
  end if;

  select count(*)::int into v_recent
    from public.playable_cards
   where added_at > now() - make_interval(days => v_window);

  if v_recent = 0 then
    raise exception 'aucune carte récente : le backfill a échoué';
  end if;

  -- Un tirage complet doit encore rendre exactement 5 cartes.
  v_drawn := jsonb_array_length(public._draw_cards(
    (select array_agg(id) from public.playable_cards),
    5,
    (select value from public.game_config where key = 'booster_drop_rates')
  ));

  if v_drawn <> 5 then
    raise exception 'tirage invalide : % cartes', v_drawn;
  end if;

  raise notice 'Nouveautés : % cartes à ×% pendant % jours.',
    v_recent, v_boost, v_window;
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  delete from public.game_config where key in ('new_card_boost','new_card_window_days');
--  drop index if exists public.cards_added_at_idx;
--  alter table public.cards drop column if exists added_at;
--  -- puis réappliquer la vue et _pick_card/_draw_cards de la migration 013/014.
-- ============================================================
