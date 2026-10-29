-- Garanties de rareté et boosters spéciaux pour les packs permanents.
-- Les règles sont réglables dans game_config et le tirage reste côté serveur.
-- Les packs saisonniers conservent leur tirage actuel et ne font pas avancer
-- les compteurs de cadence et de pity.

alter table public.profiles
  add column if not exists pity_mythic integer not null default 0,
  add column if not exists standard_boosters_opened integer not null default 0;

alter table public.profiles drop constraint if exists profiles_pity_mythic_check;
alter table public.profiles
  add constraint profiles_pity_mythic_check check (pity_mythic >= 0);

alter table public.profiles drop constraint if exists profiles_standard_boosters_opened_check;
alter table public.profiles
  add constraint profiles_standard_boosters_opened_check check (standard_boosters_opened >= 0);

insert into public.game_config (key, value) values
  ('booster_guarantee_mythic_every', '250'::jsonb),
  ('booster_golden_every', '10'::jsonb),
  ('booster_divine_chance', '0.0005'::jsonb)
on conflict (key) do nothing;

-- Reprendre la cadence dorée depuis le journal des ouvertures existant.
update public.profiles p
   set standard_boosters_opened = coalesce((
     select sum(o.count)::int
       from public.booster_openings o
       join public.booster_types bt on bt.slug = o.pack_slug
      where o.user_id = p.id and bt.season is null
   ), 0);

-- Le journal n'avait pas les cartes. L'ancienne progression de pity n'étant
-- pas reconstructible, elle repart de zéro, tandis que la cadence est exacte.

-- Planchers par emplacement : les trois premières cartes sans plancher,
-- la quatrième UC+, la cinquième Rare+. Les replis restent dans le pool du pack
-- (le Mix est déjà le catalogue entier) et tentent une carte éligible avant
-- de recourir au repli historique si le pool n'a réellement plus de choix.
do $$
declare
  v_definition text;
  v_old_roll text := 'v_rarity := public.roll_rarity(v_rates, null, public.random_unit());';
  v_new_roll text := $new_roll$
    v_minimum := (array['C', 'C', 'C', 'UC', 'R'])[least(v_index, 5)];
    v_minimum_rank := array_position(array['C', 'UC', 'R', 'SR', 'UR', 'L'], v_minimum);
    select coalesce(array_agg(e.key), '{}'::text[])
      into v_allowed
      from jsonb_each_text(v_rates) as e(key, value)
     where case e.key
             when 'C' then 1 when 'UC' then 2 when 'R' then 3
             when 'SR' then 4 when 'UR' then 5 when 'L' then 6 else 0
           end >= v_minimum_rank;
    v_rarity := public.roll_rarity(v_rates, v_allowed, public.random_unit());
    if v_rarity is null then
      select e.key into v_rarity
        from jsonb_each_text(v_rates) as e(key, value)
       where case e.key
               when 'C' then 1 when 'UC' then 2 when 'R' then 3
               when 'SR' then 4 when 'UR' then 5 when 'L' then 6 else 0
             end >= v_minimum_rank
       order by case e.key
                  when 'C' then 1 when 'UC' then 2 when 'R' then 3
                  when 'SR' then 4 when 'UR' then 5 when 'L' then 6 else 0
                end
       limit 1;
    end if;
$new_roll$;
  v_old_order text := 'v_entry record;';
  v_new_order text := $new_decl$v_entry record;
  v_minimum text;
  v_minimum_rank integer;
  v_allowed text[];$new_decl$;
  v_old_loop text := 'for v_step in v_start..array_length(v_order, 1) loop';
  v_new_loop text := $new_loop$for v_step in v_start..array_length(v_order, 1) loop
          if array_position(array['C', 'UC', 'R', 'SR', 'UR', 'L'], v_order[v_step]) < v_minimum_rank then
            continue;
          end if;$new_loop$;
  v_fallback_marker text := '    -- 4. n''importe quelle carte du pool';
  v_fallback text := $fallback$    -- Avant le repli historique, réutiliser si nécessaire une carte admissible :
    -- les garanties de rareté ne sont pas annulées par l'épuisement des copies.
    if v_card is null then
      for v_step in 1..array_length(v_order, 1) loop
        if array_position(array['C', 'UC', 'R', 'SR', 'UR', 'L'], v_order[v_step]) < v_minimum_rank then
          continue;
        end if;
        v_card := public._pick_card(p_pool, v_order[v_step], v_exclude, v_boost, v_window);
        if v_card is null and not v_strict then
          v_card := public._pick_card(v_global, v_order[v_step], v_exclude, v_boost, v_window);
        end if;
        if v_card is null then
          v_card := public._pick_card(p_pool, v_order[v_step], '{}', v_boost, v_window);
        end if;
        if v_card is null and not v_strict then
          v_card := public._pick_card(v_global, v_order[v_step], '{}', v_boost, v_window);
        end if;
        exit when v_card is not null;
      end loop;
    end if;

    -- 4. n''importe quelle carte du pool$fallback$;
  v_old_card text := $old_card$    v_cards := v_cards || jsonb_build_object(
      'id', v_card,
      'rarity', v_real,
      'holo', v_holo,
      'variant', v_variant
    );$old_card$;
  v_new_card text := $new_card$    v_cards := v_cards || (
      jsonb_build_object(
        'id', v_card,
        'rarity', v_real,
        'holo', v_holo,
        'variant', v_variant
      ) || case
        when v_index = 4 and array_position(array['C', 'UC', 'R', 'SR', 'UR', 'L'], v_real) >= 2
          then jsonb_build_object('guaranteed', true, 'guarantee_type', 'uncommon')
        when v_index >= 5 and array_position(array['C', 'UC', 'R', 'SR', 'UR', 'L'], v_real) >= 3
          then jsonb_build_object('guaranteed', true, 'guarantee_type', 'rare')
        else '{}'::jsonb
      end
    );$new_card$;
begin
  v_definition := replace(
    pg_get_functiondef('public._draw_cards(text[],integer,jsonb)'::regprocedure),
    E'\r\n', E'\n'
  );

  if position('v_minimum_rank integer;' in v_definition) = 0 then
    if position(v_old_order in v_definition) = 0
       or position(v_old_roll in v_definition) = 0
       or position(v_old_loop in v_definition) = 0
       or position(v_fallback_marker in v_definition) = 0
       or position(v_old_card in v_definition) = 0 then
      raise exception '_draw_cards() ne correspond pas à la définition attendue';
    end if;
    v_definition := replace(v_definition, v_old_order, v_new_order);
    v_definition := regexp_replace(v_definition, 'v_entry record;\s*begin', v_new_order || E'\\nbegin');
    v_definition := replace(v_definition, v_old_roll, v_new_roll);
    v_definition := replace(v_definition, v_old_loop, v_new_loop);
    v_definition := replace(v_definition, v_fallback_marker, v_fallback);
    v_definition := replace(v_definition, v_old_card, v_new_card);
    execute v_definition || ';';
  end if;
end;
$$;

-- Tirage commun aux ouvertures sur stock et aux boosters bonus du parrainage.
-- Le verrou de profil pris par les fonctions appelantes rend la mise à jour des
-- compteurs atomique avec consommation, tirage et enregistrement des cartes.
create or replace function public._draw_booster_kyara(
  p_uid uuid,
  p_pack_slug text,
  p_pool text[],
  p_rates jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pack public.booster_types%rowtype;
  v_cards jsonb;
  v_high_pool text[];
  v_mythic_pool text[];
  v_pity integer;
  v_opened integer;
  v_every_mythic integer := greatest(1, coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'booster_guarantee_mythic_every'), 250
  ));
  v_pool_mythic integer;
  v_every_golden integer := greatest(1, coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'booster_golden_every'), 10
  ));
  v_divine_chance numeric := least(1, greatest(0, coalesce(
    (select (value #>> '{}')::numeric from public.game_config where key = 'booster_divine_chance'), 0.0005
  )));
  v_is_divine boolean := false;
  v_is_golden boolean := false;
  v_force_mythic boolean := false;
  v_special text;
  v_replacement jsonb;
  v_index integer;
begin
  select * into v_pack from public.booster_types where slug = p_pack_slug and active;
  if not found then raise exception 'unknown_pack' using errcode = 'P0002'; end if;

  if v_pack.season is not null then
    return public._draw_cards(p_pool, v_pack.cards_count, p_rates);
  end if;

  select pity_mythic, standard_boosters_opened
    into v_pity, v_opened
    from public.profiles where id = p_uid for update;
  if not found then raise exception 'profile_missing' using errcode = 'P0002'; end if;

  -- Les boosters spéciaux ne changent jamais de genre : leurs pools sont des
  -- sous-ensembles du pool d'ouverture, et une garantie impossible est ignorée.
  select array_agg(c.id) filter (where c.rarity in ('SR', 'UR', 'L')),
         array_agg(c.id) filter (where c.rarity = 'L'),
         count(*) filter (where c.rarity = 'L')::int
    into v_high_pool, v_mythic_pool, v_pool_mythic
    from public.playable_cards c
   where c.id = any(p_pool) and c.season is null;

  v_is_divine := public.random_unit() < v_divine_chance and v_mythic_pool is not null;
  v_is_golden := not v_is_divine
    and mod(v_opened + 1, v_every_golden) = 0
    and exists (
      select 1
        from public.playable_cards c
       where c.id = any(p_pool) and c.season is null
         and c.rarity in ('SR', 'UR', 'L')
       group by c.rarity
      having count(*) >= 1
    );

  if v_is_divine or v_is_golden then
    v_cards := public._draw_cards(v_high_pool, v_pack.cards_count, '{"SR":1,"UR":1,"L":1}'::jsonb);
  else
    v_cards := public._draw_cards(p_pool, v_pack.cards_count, p_rates);
  end if;

  v_force_mythic := coalesce(v_pool_mythic, 0) > 0 and (
    v_is_divine or (
      v_pity + 1 >= v_every_mythic
      and not exists (
        select 1 from jsonb_array_elements(v_cards) as drawn(entry)
         where entry ->> 'rarity' = 'L'
      )
    )
  );

  if v_force_mythic then
    v_replacement := public._draw_cards(v_mythic_pool, 1, '{"L":1}'::jsonb) -> 0;
    v_replacement := v_replacement || jsonb_build_object(
      'guaranteed', true,
      'guarantee_type', case when v_is_divine then 'divine' else 'mythic' end
    );
    v_cards := jsonb_set(v_cards, array[(jsonb_array_length(v_cards) - 1)::text], v_replacement, false);
  end if;

  if v_is_divine then
    v_special := 'divine';
  elsif v_is_golden then
    v_special := 'golden';
  elsif v_force_mythic then
    v_special := 'mythic';
  end if;

  if v_special is not null then
    for v_index in 0..jsonb_array_length(v_cards) - 1 loop
      v_cards := jsonb_set(
        v_cards,
        array[v_index::text],
        (v_cards -> v_index) || jsonb_build_object(
          'booster_special', v_special,
          'guaranteed', v_special in ('golden', 'divine')
            or coalesce((v_cards -> v_index ->> 'guaranteed')::boolean, false),
          'guarantee_type', coalesce(
            v_cards -> v_index ->> 'guarantee_type',
            case when v_special in ('golden', 'divine') then v_special else null end
          )
        ),
        false
      );
    end loop;
  end if;

  update public.profiles
     set standard_boosters_opened = standard_boosters_opened + 1,
         pity_mythic = case
           when v_mythic_pool is null then pity_mythic
           when exists (
             select 1 from jsonb_array_elements(v_cards) as drawn(entry)
              where entry ->> 'rarity' = 'L'
           ) then 0
           else pity_mythic + 1
         end
   where id = p_uid;

  return v_cards;
end;
$$;
revoke all on function public._draw_booster_kyara(uuid,text,text[],jsonb) from public, anon, authenticated;

-- Les deux chemins historiques consomment le stock / bonus et appellent ensuite
-- le même tirage ; conserver ces transactions et ne remplacer que l'appel draw.
do $$
declare
  v_name text;
  v_definition text;
  v_old text := 'v_cards := public._draw_cards(v_pool, v_pack.cards_count, v_rates);';
  v_new text := 'v_cards := public._draw_booster_kyara(v_uid, v_pack.slug, v_pool, v_rates);';
begin
  foreach v_name in array array['_open_pack_stock', 'open_pack'] loop
    v_definition := replace(
      pg_get_functiondef(('public.' || v_name || '(text)')::regprocedure),
      E'\r\n', E'\n'
    );
    if position(v_new in v_definition) > 0 then continue; end if;
    if position(v_old in v_definition) = 0 then
      raise exception 'appel de _draw_cards() inconnu dans %()', v_name;
    end if;
    execute replace(v_definition, v_old, v_new);
  end loop;
end;
$$;

-- Chances de base calculées sur les poids réellement disponibles dans le pool.
-- Les garanties conditionnelles (pity) et événements spéciaux sont des repères
-- distincts, exposés dans les mêmes JSON chances mais hors probabilités brutes.
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
    (select (value #>> '{}')::int from public.game_config where key = 'pack_min_pool_size'), 15
  );
  v_rates jsonb;
  v_row record;
  v_pool integer;
  v_rarities text[];
  v_slot_total numeric;
  v_weight numeric;
  v_miss numeric;
  v_chances jsonb;
  v_r record;
  v_slot integer;
  v_floor text;
  v_floor_rank integer;
begin
  for v_row in
    select pt.slug, pt.name, pt.genre_id, pt.cards_count, pt.season, pt.drop_rates
      from public.booster_types pt where pt.active
  loop
    if v_row.season is not null then
      select count(*)::int, coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities from public.playable_cards c where c.season = v_row.season;
    elsif v_row.genre_id is null then
      select count(*)::int, coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities from public.playable_cards c where c.season is null;
    else
      select count(*)::int, coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities
        from public.playable_cards c join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_row.genre_id and c.season is null;
    end if;

    v_pool := coalesce(v_pool, 0);
    v_rates := coalesce(
      v_row.drop_rates,
      (select value from public.game_config where key = 'booster_drop_rates'),
      '{"C":620.25,"UC":250,"R":114,"SR":14,"UR":1.5,"L":0.25}'::jsonb
    );
    v_chances := '{}'::jsonb;

    for v_r in
      select e.key as rarity from jsonb_each_text(v_rates) e(key, value)
       where e.key = any(v_rarities)
    loop
      v_miss := 1;
      for v_slot in 1..v_row.cards_count loop
        v_floor := (array['C','C','C','UC','R'])[least(v_slot, 5)];
        v_floor_rank := array_position(array['C','UC','R','SR','UR','L'], v_floor);
        select coalesce(sum(e.value::numeric), 0),
               coalesce(sum(e.value::numeric) filter (where e.key = v_r.rarity), 0)
          into v_slot_total, v_weight
          from jsonb_each_text(v_rates) e(key, value)
         where e.key = any(v_rarities)
           and case e.key when 'C' then 1 when 'UC' then 2 when 'R' then 3
                          when 'SR' then 4 when 'UR' then 5 when 'L' then 6 else 0 end >= v_floor_rank;
        if v_slot_total > 0 then
          v_miss := v_miss * (1 - case
            when array_position(array['C','UC','R','SR','UR','L'], v_r.rarity) >= v_floor_rank
              then v_weight / v_slot_total
            else 0
          end);
        end if;
      end loop;
      v_chances := v_chances || jsonb_build_object(v_r.rarity, round((1-v_miss)::numeric, 4));
    end loop;

    if v_row.season is null then
      v_chances := v_chances || jsonb_build_object(
        'has_mythic', v_rarities @> array['L']::text[],
        'has_high_rarity', v_rarities && array['SR','UR','L']::text[],
        'golden_every', greatest(1, coalesce(
          (select (value #>> '{}')::int from public.game_config where key = 'booster_golden_every'), 10
        )),
        'divine_chance', least(1, greatest(0, coalesce(
          (select (value #>> '{}')::numeric from public.game_config where key = 'booster_divine_chance'), 0.0005
        ))),
        'mythic_pity_every', greatest(1, coalesce(
          (select (value #>> '{}')::int from public.game_config where key = 'booster_guarantee_mythic_every'), 250
        )),
        'slot_4_min_rank', 2,
        'slot_5_min_rank', 3
      );
    end if;

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

comment on column public.profiles.pity_mythic is
  'Nombre de boosters permanents consécutifs sans Mythique ; pity conservé si le pool du pack ne contient pas de Mythique.';
comment on column public.profiles.standard_boosters_opened is
  'Nombre de boosters permanents ouverts, stock et bonus compris ; cadence du booster doré.';
