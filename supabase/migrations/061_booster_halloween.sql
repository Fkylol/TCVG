-- ============================================================
--  Migration 061 — Le booster d'Halloween et ses cartes exclusives
--
--  Les vingt cartes spectrales d'Halloween (octobre 2026) existent en base
--  comme les autres : fiche, visuel, collection, marché. Mais elles ne sortent
--  que du booster d'Halloween : aucun pack permanent, Mix compris, ne doit les
--  tirer. La règle est posée ici, pas seulement à l'écran — quelqu'un qui
--  appellerait `open_pack('mix')` en direct obtient le même pool que l'interface.
--
--  La saison est une colonne (`cards.season`, `booster_types.season`) plutôt
--  qu'une seconde table : le pool d'un pack reste un tableau d'identifiants,
--  comme pour les genres (migration 037), et `_draw_cards()` n'a pas à connaître
--  la saison — il ne voit que ce tableau.
--
--  Cinq fonctions construisent un pool, et les cinq suivent maintenant la
--  saison : `_open_pack_stock()` et le repli bonus d'`open_pack()` (le tirage),
--  `pack_stats()` (disponibilité et chances affichées), `card_booster_chances()`
--  (migration 039, « chance par booster » de la fiche carte) et `pack_cards()`
--  (liste des personnages d'un pack). Sans les trois dernières, l'interface
--  annoncerait un pool et un tirage différents.
--
--  Les patchs sont textuels, comme la migration 059 : la définition est relue
--  dans le catalogue, l'ancien bloc est vérifié avant remplacement, et une
--  seconde exécution ne fait rien. Rejouable sans risque.
--
--  Fenêtre saisonnière : la base connaît la saison, pas le calendrier. C'est le
--  site qui décide d'ouvrir le pack (15 octobre → 2 novembre à Paris, voir
--  src/lib/halloween/config.ts) ; hors saison, passer `booster_types.active` à
--  false ferme le pack à la source.
-- ============================================================

-- ————— 1. La saison d'une carte —————
alter table public.cards add column if not exists season text;

alter table public.cards drop constraint if exists cards_season_check;
alter table public.cards
  add constraint cards_season_check
  check (season is null or season = 'halloween');

comment on column public.cards.season is
  'Saison exclusive d''une carte : elle ne sort que du booster de cette saison. Nul = catalogue permanent.';

-- La colonne est ajoutée en fin de vue : `create or replace view` n'autorise
-- que des colonnes supplémentaires à la fin, et les privilèges existants sont
-- conservés.
create or replace view public.playable_cards
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.rarity,
  c.number,
  c.franchise_id,
  c.added_at,
  c.season
  from public.cards c
  join public.franchises f on f.id = c.franchise_id
 where c.active
   and f.active;

-- ————— 2. La saison d'un booster —————
alter table public.booster_types add column if not exists season text;

alter table public.booster_types drop constraint if exists booster_types_season_check;
alter table public.booster_types
  add constraint booster_types_season_check
  check (season is null or season = 'halloween');

comment on column public.booster_types.season is
  'Saison exclusive d''un pack : son pool se limite aux cartes de cette saison, que les packs permanents ignorent.';

-- ————— 3. Le pack —————
-- Cinq cartes comme les autres, aucune ligne dans la vitrine (le pack n'est pas
-- dans `shopPacks()` : sa seule porte est la citrouille de l'overlay), et
-- `active = true` : c'est la saison, pas le stock, qui décide de son ouverture.
insert into public.booster_types (slug, name, genre_id, cards_count, active, season)
values ('halloween', 'Booster d''Halloween', null, 5, true, 'halloween')
on conflict (slug) do update
  set name = excluded.name,
      genre_id = null,
      cards_count = 5,
      active = true,
      season = 'halloween';

-- ————— 4. Le pool suit la saison —————
-- Un pack à saison ne tire que ses cartes ; un pack permanent — Mix ou genre —
-- ne tire jamais une carte de saison.
do $$
declare
  v_names text[] := array['_open_pack_stock', 'open_pack'];
  v_name text;
  v_definition text;
  v_old text := $old$
  if v_pack.genre_id is null then
    select array_agg(id) into v_pool from public.playable_cards;
  else
    select array_agg(c.id) into v_pool
      from public.playable_cards c
      join public.card_genres cg on cg.card_id = c.id
     where cg.genre_id = v_pack.genre_id;
  end if;
$old$;
  v_new text := $new$
  if v_pack.season is not null then
    select array_agg(id) into v_pool
      from public.playable_cards
     where season = v_pack.season;
  elsif v_pack.genre_id is null then
    select array_agg(id) into v_pool
      from public.playable_cards
     where season is null;
  else
    select array_agg(c.id) into v_pool
      from public.playable_cards c
      join public.card_genres cg on cg.card_id = c.id
     where cg.genre_id = v_pack.genre_id
       and c.season is null;
  end if;
$new$;
begin
  foreach v_name in array v_names loop
    v_definition := replace(
      pg_get_functiondef(('public.' || v_name || '(text)')::regprocedure),
      E'\\r\\n',
      E'\\n'
    );

    if position(v_new in v_definition) > 0 then
      continue;
    end if;

    if position(v_old in v_definition) = 0 then
      raise exception 'sélection du pool inconnue dans %() : vérifier la fonction avant migration', v_name;
    end if;

    execute replace(v_definition, v_old, v_new);
  end loop;

  raise notice 'Tirage : pool par saison en place.';
end;
$$;

do $$
declare
  v_definition text;
  v_old text := $old$
    select pt.slug, pt.name, pt.genre_id, pt.cards_count
      from public.booster_types pt
     where pt.active
$old$;
  v_new text := $new$
    select pt.slug, pt.name, pt.genre_id, pt.cards_count, pt.season
      from public.booster_types pt
     where pt.active
$new$;
  v_pool_old text := $pool_old$
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
$pool_old$;
  v_pool_new text := $pool_new$
    if v_row.season is not null then
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities
        from public.playable_cards c
       where c.season = v_row.season;
    elsif v_row.genre_id is null then
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities
        from public.playable_cards c
       where c.season is null;
    else
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[])
        into v_pool, v_rarities
        from public.playable_cards c
        join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_row.genre_id
         and c.season is null;
    end if;
$pool_new$;
begin
  v_definition := replace(
    pg_get_functiondef('public.pack_stats()'::regprocedure),
    E'\\r\\n',
    E'\\n'
  );

  -- Some deployed databases already have the seasonal pool calculation and an
  -- extended FOR projection (e.g. drop_rates). Preserve it, after checking
  -- the actual pool sizes and availability against the seasonal catalog.
  if position('if v_row.season is not null then' in v_definition) > 0
     and position('and c.season is null' in v_definition) > 0 then
    if position('pt.season' in v_definition) = 0 then
      raise exception 'pack_stats() ignores booster_types.season in its pack query';
    end if;
    if exists (
      select 1
        from public.booster_types bt
        join public.pack_stats() stats on stats.slug = bt.slug
       where bt.active
         and stats.pool_size is distinct from case
           when bt.season is not null then (
             select count(*)::int from public.playable_cards c where c.season = bt.season
           )
           when bt.genre_id is null then (
             select count(*)::int from public.playable_cards c where c.season is null
           )
           else (
             select count(*)::int
               from public.playable_cards c
               join public.card_genres cg on cg.card_id = c.id
              where cg.genre_id = bt.genre_id and c.season is null
           )
         end
         or stats.available is distinct from (
           stats.pool_size >= coalesce(
             (select (value #>> '{}')::int from public.game_config where key = 'pack_min_pool_size'), 15
           )
         )
    ) then
      raise exception 'pack_stats() seasonal pool values are inconsistent';
    end if;
    return;
  end if;

  if position(v_pool_new in v_definition) > 0 then
    return;
  end if;

  if position(v_pool_old in v_definition) = 0 then
    raise exception 'sélection du pool inconnue dans pack_stats() : vérifier la fonction avant migration';
  end if;

  v_definition := replace(v_definition, v_old, v_new);
  execute replace(v_definition, v_pool_old, v_pool_new);

  raise notice 'pack_stats() : pool et disponibilité par saison.';
end;
$$;

do $$
declare
  v_definition text;
  v_old text := $old$
    select pt.slug, pt.name, pt.cards_count, pt.genre_id
      from public.booster_types pt
     where pt.active
     order by pt.slug
$old$;
  v_new text := $new$
    select pt.slug, pt.name, pt.cards_count, pt.genre_id, pt.season
      from public.booster_types pt
     where pt.active
     order by pt.slug
$new$;
  v_pool_old text := $pool_old$
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
$pool_old$;
  v_pool_new text := $pool_new$
    if v_type.season is not null then
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[]),
             coalesce(bool_or(c.id = p_card_id), false)
        into v_pool, v_rarities, v_has
        from public.playable_cards c
       where c.season = v_type.season;
    elsif v_type.genre_id is null then
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[]),
             coalesce(bool_or(c.id = p_card_id), false)
        into v_pool, v_rarities, v_has
        from public.playable_cards c
       where c.season is null;
    else
      select count(*)::int,
             coalesce(array_agg(distinct c.rarity), '{}'::text[]),
             coalesce(bool_or(c.id = p_card_id), false)
        into v_pool, v_rarities, v_has
        from public.playable_cards c
        join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_type.genre_id
         and c.season is null;
    end if;
$pool_new$;
  v_count_old text := $count_old$
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
$count_old$;
  v_count_new text := $count_new$
    if v_type.season is not null then
      select count(*)::int
        into v_count
        from public.playable_cards c
       where c.season = v_type.season
         and c.rarity = v_rarity;
    elsif v_type.genre_id is null then
      select count(*)::int
        into v_count
        from public.playable_cards c
       where c.season is null
         and c.rarity = v_rarity;
    else
      select count(*)::int
        into v_count
        from public.playable_cards c
        join public.card_genres cg on cg.card_id = c.id
       where cg.genre_id = v_type.genre_id
         and c.season is null
         and c.rarity = v_rarity;
    end if;
$count_new$;
begin
  v_definition := replace(
    pg_get_functiondef('public.card_booster_chances(text)'::regprocedure),
    E'\\r\\n',
    E'\\n'
  );

  if position(v_count_new in v_definition) > 0 then
    return;
  end if;

  if position(v_old in v_definition) = 0 then
    raise exception 'lecture des packs inconnue dans card_booster_chances() : vérifier la fonction avant migration';
  end if;
  if position(v_pool_old in v_definition) = 0 then
    raise exception 'sélection du pool inconnue dans card_booster_chances() : vérifier la fonction avant migration';
  end if;
  if position(v_count_old in v_definition) = 0 then
    raise exception 'comptage de rareté inconnu dans card_booster_chances() : vérifier la fonction avant migration';
  end if;

  v_definition := replace(v_definition, v_old, v_new);
  v_definition := replace(v_definition, v_pool_old, v_pool_new);
  execute replace(v_definition, v_count_old, v_count_new);

  raise notice 'card_booster_chances() : chances par saison.';
end;
$$;

do $$
declare
  v_definition text;
  v_old text := $old$
        and (
          bt.genre_id is null
          or exists (
            select 1 from public.card_genres cg
             where cg.card_id = c.id and cg.genre_id = bt.genre_id
          )
        )
$old$;
  v_new text := $new$
        and case
              when bt.season is not null then c.season = bt.season
              when bt.genre_id is null then c.season is null
              else c.season is null
                   and exists (
                     select 1 from public.card_genres cg
                      where cg.card_id = c.id and cg.genre_id = bt.genre_id
                   )
            end
$new$;
begin
  v_definition := replace(
    pg_get_functiondef('public.pack_cards(text)'::regprocedure),
    E'\\r\\n',
    E'\\n'
  );

  if position(v_new in v_definition) > 0 then
    return;
  end if;

  if position(v_old in v_definition) = 0 then
    raise exception 'filtre de pool inconnu dans pack_cards() : vérifier la fonction avant migration';
  end if;

  execute replace(v_definition, v_old, v_new);

  raise notice 'pack_cards() : liste des personnages par saison.';
end;
$$;

-- ————— 5. Contrôles —————
do $$
declare
  v_names text[] := array[
    'public._open_pack_stock(text)',
    'public.open_pack(text)',
    'public.pack_stats()',
    'public.card_booster_chances(text)',
    'public.pack_cards(text)'
  ];
  v_signature text;
  v_pool integer;
  v_available boolean;
  v_seasonal integer;
  v_permanent integer;
  v_leak integer;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cards' and column_name = 'season'
  ) then
    raise exception 'cards.season absente';
  end if;

  if not exists (
    select 1 from public.booster_types
     where slug = 'halloween' and season = 'halloween' and cards_count = 5 and active
  ) then
    raise exception 'booster d''Halloween absent ou mal réglé';
  end if;

  -- Les cinq fonctions qui construisent un pool doivent citer la saison.
  foreach v_signature in array v_names loop
    if position('season' in pg_get_functiondef(v_signature::regprocedure)) = 0 then
      raise exception '%() ignore la saison', v_signature;
    end if;
  end loop;

  select count(*)::int into v_seasonal from public.cards where season = 'halloween';

  if v_seasonal = 0 then
    raise notice
      'Pack d''Halloween : aucune carte saisonnière en base pour l''instant — lancer `npm run db:cards`.';
    return;
  end if;

  select pool_size, available
    into v_pool, v_available
    from public.pack_stats()
   where slug = 'halloween';

  if coalesce(v_pool, 0) <> v_seasonal or not coalesce(v_available, false) then
    raise exception
      'pool d''Halloween incohérent : % carte(s) saisonnière(s), pool = %, ouvrable = %',
      v_seasonal, coalesce(v_pool, 0), coalesce(v_available, false);
  end if;

  select count(*)::int into v_permanent from public.cards where season is null and active;

  select pool_size into v_pool from public.pack_stats() where slug = 'mix';

  if coalesce(v_pool, 0) <> v_permanent then
    raise exception 'pool du Mix incohérent : % au lieu des % cartes permanentes', v_pool, v_permanent;
  end if;

  -- Tirage de contrôle du pack saisonnier : aucune carte hors saison.
  select count(*)::int into v_leak
    from (
      select bt.season,
             bt.cards_count,
             public._draw_cards(
               (select array_agg(c.id)
                  from public.playable_cards c
                 where c.season = bt.season),
               bt.cards_count,
               (select value from public.game_config where key = 'booster_drop_rates')
             ) as drawn
        from public.booster_types bt
       where bt.active
         and bt.season is not null
    ) as paquet
    cross join lateral jsonb_array_elements(paquet.drawn) as carte
   where not exists (
     select 1 from public.playable_cards c
      where c.id = carte ->> 'id' and c.season = paquet.season
   );

  if v_leak > 0 then
    raise exception 'fuite hors saison : % carte(s)', v_leak;
  end if;

  -- Tirage de contrôle des packs permanents : aucune carte de saison.
  select count(*)::int into v_leak
    from (
      select bt.genre_id,
             bt.cards_count,
             public._draw_cards(
               (select array_agg(c.id)
                  from public.playable_cards c
                 where c.season is null
                   and (
                     bt.genre_id is null
                     or exists (
                       select 1 from public.card_genres cg
                        where cg.card_id = c.id and cg.genre_id = bt.genre_id
                     )
                   )),
               bt.cards_count,
               (select value from public.game_config where key = 'booster_drop_rates')
             ) as drawn
        from public.booster_types bt
       where bt.active
         and bt.season is null
    ) as paquet
    cross join lateral jsonb_array_elements(paquet.drawn) as carte
   where exists (
     select 1 from public.playable_cards c
      where c.id = carte ->> 'id' and c.season is not null
   );

  if v_leak > 0 then
    raise exception 'une carte saisonnière sort d''un pack permanent : % carte(s)', v_leak;
  end if;

  raise notice
    'Pack d''Halloween : % cartes exclusives, pool %, ouvrable ; packs permanents : % cartes, aucune fuite.',
    v_seasonal, v_pool, v_permanent;
end;
$$;

-- ============================================================
--  Retour arrière (à exécuter à la main si besoin)
--
--  delete from public.booster_types where slug = 'halloween';
--  alter table public.booster_types drop column if exists season;
--  update public.cards set season = null;
--  alter table public.cards drop column if exists season;
--
--  Les cinq fonctions gardent leur branche saison : avec une colonne toujours
--  nulle (`cards.season is null` est vrai pour tout le monde), elles retrouvent
--  exactement le comportement de la 059. La vue `playable_cards` garde, elle,
--  une colonne `season` de plus — sans effet sur les fonctions qui listent des
--  colonnes nommées.
-- ============================================================
