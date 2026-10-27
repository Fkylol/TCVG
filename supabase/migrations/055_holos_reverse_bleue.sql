-- ============================================================
--  Migration 055 — Deux holos misprint de plus : reverse et bleue
--  Rejouable sans risque.
--
--  Le tirage ne connaissait que trois défauts (ghosting, cadre décalé, foil qui
--  déborde), répartis à parts égales. Il en compte cinq :
--
--    • reverse   — le foil est posé sur le cadre, l'illustration reste nette ;
--    • holo_blue — le foil est tiré en bleu au lieu de suivre la rareté.
--
--  Les deux nouvelles clés passent par la même porte que les anciennes :
--  `misprint_chance` décide qu'une carte naît défectueuse (0,8 % par défaut),
--  puis `variant_weights` répartit les défauts entre eux. Reverse est un peu
--  plus courante que la bleue, qui reste la plus rare du lot.
--
--  Aucun effet sur le jeu : `variant` reste une colonne purement cosmétique.
--  Le rendu des deux variantes vit dans `src/app/globals.css`, leurs libellés
--  dans `src/lib/variants.ts`.
-- ============================================================

-- ————— 1. Réglage : poids relatifs des défauts —————
insert into public.game_config (key, value) values
  (
    'variant_weights',
    '{"ghosting": 1, "off_center": 1, "holo_bleed": 1, "reverse": 0.7, "holo_blue": 0.3}'::jsonb
  )
on conflict (key) do nothing;

-- ————— 2. La contrainte accepte les cinq clés —————
do $$
begin
  alter table public.collection drop constraint if exists collection_variant_check;
  alter table public.collection
    add constraint collection_variant_check
    check (variant is null or variant in ('holo_bleed', 'off_center', 'ghosting', 'reverse', 'holo_blue'));
end
$$;

-- ————— 3. Tirage : cinq défauts au lieu de trois —————
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
  v_variant_weights jsonb;
  v_variant_keys text[] := array['holo_bleed', 'off_center', 'ghosting', 'reverse', 'holo_blue'];
  v_weight_total numeric;
  v_roll numeric;
  v_entry record;
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
    )),
    coalesce(
      (select value from public.game_config where key = 'variant_weights'),
      '{}'::jsonb
    )
    into v_holo_chance, v_misprint, v_misprint_chance, v_boost, v_window, v_variant_weights;

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
      -- Tirage pondéré parmi les cinq défauts connus. Les clés et les poids
      -- sont filtrés : un réglage incomplet ou fautif ne peut pas écrire une
      -- variante que la contrainte refuserait en fin d'ouverture.
      select coalesce(sum((e.value #>> '{}')::numeric), 0)
        into v_weight_total
        from jsonb_each(v_variant_weights) as e(key, value)
       where e.key = any (v_variant_keys)
         and (e.value #>> '{}')::numeric > 0;

      if v_weight_total > 0 then
        v_roll := public.random_unit() * v_weight_total;

        for v_entry in
          select e.key as key, (e.value #>> '{}')::numeric as weight
            from jsonb_each(v_variant_weights) as e(key, value)
           where e.key = any (v_variant_keys)
             and (e.value #>> '{}')::numeric > 0
           order by e.key
        loop
          v_variant := v_entry.key;
          v_roll := v_roll - v_entry.weight;
          exit when v_roll < 0;
        end loop;
      end if;

      -- Réglage illisible ou vidé : on garde le tirage traditionnel, sinon
      -- toutes les cartes deviendraient normales sans que personne le voie.
      if v_variant is null then
        v_variant := (array['holo_bleed', 'off_center', 'ghosting'])[
          1 + floor(public.random_unit() * 3)::int
        ];
      end if;
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
revoke all on function public._draw_cards(text[], integer, jsonb) from anon;
revoke all on function public._draw_cards(text[], integer, jsonb) from authenticated;

-- ————— 4. Contrôles —————
-- Aucune clé inconnue ne doit pouvoir être réglée : la contrainte la refuserait
-- et le tirage s'arrêterait net au milieu d'un paquet.
do $$
declare
  v_bad text;
  v_total numeric;
begin
  select string_agg(e.key, ', ')
    into v_bad
    from jsonb_each(
      coalesce(
        (select value from public.game_config where key = 'variant_weights'),
        '{}'::jsonb
      )
    ) as e(key, value)
   where e.key not in ('holo_bleed', 'off_center', 'ghosting', 'reverse', 'holo_blue')
      or (e.value #>> '{}')::numeric <= 0;

  if v_bad is not null then
    raise exception 'variant_weights : clé ou poids invalide (%)', v_bad;
  end if;

  select coalesce(sum((e.value #>> '{}')::numeric), 0)
    into v_total
    from jsonb_each(
      coalesce(
        (select value from public.game_config where key = 'variant_weights'),
        '{}'::jsonb
      )
    ) as e(key, value);

  if v_total <= 0 then
    raise exception 'variant_weights : aucun défaut tirable';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'collection_variant_check'
       and pg_get_constraintdef(oid) like '%' || quote_literal('reverse') || '%'
       and pg_get_constraintdef(oid) like '%' || quote_literal('holo_blue') || '%'
  ) then
    raise exception 'collection_variant_check ne connaît pas reverse / holo_blue';
  end if;

  raise notice 'Variantes : cinq défauts tirables.';
end
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  delete from public.game_config where key = 'variant_weights';
--  alter table public.collection drop constraint if exists collection_variant_check;
--  alter table public.collection
--    add constraint collection_variant_check
--    check (variant is null or variant in ('holo_bleed', 'off_center', 'ghosting'));
--  -- Puis réappliquer `_draw_cards` de la migration 037.
-- ============================================================
