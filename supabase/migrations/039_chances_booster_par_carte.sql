-- ============================================================
--  Migration 039 — « Ouvrir un booster » retrouve le bon pack
--  Rejouable sans risque.
--
--  Constat : `card_booster_chances()` lisait `booster_types.price_pixels`,
--  colonne supprimée quand les boosters ont cessé de coûter des Pixels. L'appel
--  échouait donc à chaque fois (`42703: record v_type has no field
--  price_pixels`), la fiche carte recevait une liste vide et affichait
--  « Chance par booster — ». Le bouton « Ouvrir un booster » n'ayant plus de
--  meilleur pack à proposer, il retombait sur `/boosters` sans sélection.
--
--  Correctif : plus de prix dans la réponse (les boosters sont gratuits), et
--  calcul aligné sur `pack_stats()` / `_draw_cards()` : pool = `playable_cards`
--  (donc genre strict depuis la 037), raretés filtrées sur celles du pool, et
--  seuls les packs réellement ouvrables sont annoncés.
-- ============================================================

create or replace function public.card_booster_chances(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_rarity text;
  v_min integer;
  v_rates jsonb;
  v_type record;
  v_pool integer;
  v_has boolean;
  v_rarities text[];
  v_total numeric;
  v_weight numeric;
  v_count integer;
  v_slot numeric;
  v_chance numeric;
  v_out jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Une carte retirée du catalogue ne sort plus d'aucun booster : aucune
  -- chance, sans lever d'erreur (la fiche reste consultable).
  select c.rarity into v_rarity
    from public.playable_cards c
   where c.id = p_card_id;

  if not found then
    return v_out;
  end if;

  v_min := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'pack_min_pool_size'),
    15
  );
  v_rates := coalesce(
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  for v_type in
    select pt.slug, pt.name, pt.cards_count, pt.genre_id
      from public.booster_types pt
     where pt.active
     order by pt.slug
  loop
    if v_type.genre_id is null then
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[]),
             coalesce(bool_or(c.id = p_card_id), false)
        into v_pool, v_rarities, v_has
        from public.playable_cards c;
    else
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[]),
             coalesce(bool_or(c.id = p_card_id), false)
        into v_pool, v_rarities, v_has
        from public.playable_cards c
        join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_type.genre_id;
    end if;

    -- Le pack doit contenir la carte, et rester ouvrable (seuil de pool).
    if not v_has or coalesce(v_pool, 0) < v_min then
      continue;
    end if;

    -- Seules les raretés présentes dans le pool peuvent sortir (même filtre
    -- que `pack_stats()` et `_draw_cards()`).
    select coalesce(sum(e.value::numeric), 0)
      into v_total
      from jsonb_each_text(v_rates) as e(key, value)
     where e.key = any (v_rarities);

    select e.value::numeric
      into v_weight
      from jsonb_each_text(v_rates) as e(key, value)
     where e.key = v_rarity;

    if coalesce(v_total, 0) <= 0 or coalesce(v_weight, 0) <= 0 then
      continue;
    end if;

    if v_type.genre_id is null then
      select count(*)::int
        into v_count
        from public.playable_cards c
       where c.rarity = v_rarity;
    else
      select count(*)::int
        into v_count
        from public.playable_cards c
        join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_type.genre_id
         and c.rarity = v_rarity;
    end if;

    if coalesce(v_count, 0) = 0 then
      continue;
    end if;

    -- Chance de sortir CETTE carte : part de sa rareté dans le pool, divisée
    -- par le nombre de cartes de cette rareté, puis répétée sur chaque carte
    -- du paquet.
    v_slot := (v_weight / v_total) / v_count;
    v_chance := 1 - power(1 - v_slot, v_type.cards_count);

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'slug', v_type.slug,
        'name', v_type.name,
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
declare
  v_body text;
begin
  select prosrc into v_body from pg_proc where proname = 'card_booster_chances';
  if v_body is null then
    raise exception 'card_booster_chances() absente';
  end if;
  if v_body like '%price_pixels%' then
    raise exception 'card_booster_chances() lit encore une colonne supprimée';
  end if;

  raise notice 'Chances par carte : calcul aligné sur le pool des paquets.';
end;
$$;
