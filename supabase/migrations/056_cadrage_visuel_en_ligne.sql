-- ============================================================
--  Migration 056 — CADRAGE DU VISUEL DÉPUIS L'ATELIER EN LIGNE
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  L'atelier en ligne savait remplacer l'URL d'un visuel, pas le recadrer :
--  une image horizontale arrivait centrée, coupait la tête du personnage, et
--  il fallait passer par la machine de développement. `card_edits` garde donc
--  le cadrage choisi dans l'atelier :
--    • `image_fit`      — `cover` (remplir le cadre) ou `contain` (tout garder) ;
--    • `image_position` — position CSS, « 50% 12% » ;
--    • `image_zoom`     — grossissement de 1 à 3.
--
--  Le cadrage s'applique au visuel affiché, qu'il vienne du catalogue ou
--  d'une URL choisie dans l'atelier : on peut recadrer une photo en place.
--  NULL = cadrage par défaut (haut-centre, sans zoom).
-- ============================================================

-- ————— 1. Les trois colonnes —————
alter table public.card_edits
  add column if not exists image_fit text,
  add column if not exists image_position text,
  add column if not exists image_zoom numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'card_edits_image_fit_check') then
    alter table public.card_edits
      add constraint card_edits_image_fit_check
      check (image_fit is null or image_fit in ('cover', 'contain'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'card_edits_image_position_check') then
    alter table public.card_edits
      add constraint card_edits_image_position_check
      check (image_position is null or image_position ~ '^[0-9]{1,3}(\.[0-9]+)?% [0-9]{1,3}(\.[0-9]+)?%$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'card_edits_image_zoom_check') then
    alter table public.card_edits
      add constraint card_edits_image_zoom_check
      check (image_zoom is null or (image_zoom >= 1 and image_zoom <= 3));
  end if;
end
$$;

-- ————— 2. Enregistrer une carte, cadrage compris —————
create or replace function public.atelier_save_card_edit(
  p_card_id text,
  p_name text,
  p_rarity text,
  p_universe text,
  p_emoji text,
  p_image_url text,
  p_image_fit text,
  p_image_position text,
  p_image_zoom numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_universe text := nullif(btrim(coalesce(p_universe, '')), '');
  v_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
  v_image text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_rarity text := nullif(btrim(coalesce(p_rarity, '')), '');
  v_fit text := nullif(btrim(coalesce(p_image_fit, '')), '');
  v_position text := nullif(btrim(coalesce(p_image_position, '')), '');
  v_zoom numeric := p_image_zoom;
begin
  if not public.is_atelier() then
    raise exception 'Atelier : accès refusé.' using errcode = '42501';
  end if;

  if p_card_id is null or p_card_id = '' then
    raise exception 'Carte inconnue.';
  end if;

  if v_rarity is not null and v_rarity not in ('C', 'UC', 'R', 'SR', 'UR', 'L') then
    raise exception 'Rareté inconnue : %', v_rarity;
  end if;

  if v_image is not null and v_image !~* '^https?://' then
    raise exception 'Le visuel doit être une URL http(s).';
  end if;

  -- Un cadrage sans `fit` ne veut rien dire : on repart du défaut complet.
  if v_fit is null then
    v_position := null;
    v_zoom := null;
  end if;

  if v_fit is not null and v_fit not in ('cover', 'contain') then
    raise exception 'Cadrage inconnu : %', v_fit;
  end if;

  if v_position is not null
     and v_position !~ '^[0-9]{1,3}(\.[0-9]+)?% [0-9]{1,3}(\.[0-9]+)?%$' then
    raise exception 'Position de cadrage invalide : %', v_position;
  end if;

  -- Le grossissement est borné plutôt que refusé : un arrondi de curseur ne
  -- doit pas faire échouer l'enregistrement d'une fiche.
  if v_zoom is not null then
    v_zoom := round(greatest(1, least(3, v_zoom))::numeric, 2);
  end if;

  insert into public.card_edits (
    card_id, name, rarity, universe, emoji, image_url,
    image_fit, image_position, image_zoom, updated_by, updated_at
  )
  values (
    p_card_id, v_name, v_rarity, v_universe, v_emoji, v_image,
    v_fit, v_position, v_zoom, auth.uid(), now()
  )
  on conflict (card_id) do update
    set name = excluded.name,
        rarity = excluded.rarity,
        universe = excluded.universe,
        emoji = excluded.emoji,
        image_url = excluded.image_url,
        image_fit = excluded.image_fit,
        image_position = excluded.image_position,
        image_zoom = excluded.image_zoom,
        updated_by = excluded.updated_by,
        updated_at = now();

  -- La base suit, pour le tirage des boosters et les jointures du marché.
  update public.cards
     set name = coalesce(v_name, name),
         rarity = coalesce(v_rarity, rarity),
         universe = coalesce(v_universe, universe),
         updated_at = now()
   where id = p_card_id;
end;
$$;

revoke all on function public.atelier_save_card_edit(text, text, text, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.atelier_save_card_edit(text, text, text, text, text, text, text, text, numeric) to authenticated;

-- ————— 3. Ancienne signature : conservée pour un déploiement en cours —————
-- Une page déjà chargée peut encore appeler la version à six arguments. Elle
-- enregistre la fiche sans toucher au cadrage… puis la version à neuf
-- arguments prend le relais.
create or replace function public.atelier_save_card_edit(
  p_card_id text,
  p_name text,
  p_rarity text,
  p_universe text,
  p_emoji text,
  p_image_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.atelier_save_card_edit(
    p_card_id, p_name, p_rarity, p_universe, p_emoji, p_image_url,
    null, null, null
  );
end;
$$;

revoke all on function public.atelier_save_card_edit(text, text, text, text, text, text) from public, anon;
grant execute on function public.atelier_save_card_edit(text, text, text, text, text, text) to authenticated;

-- ————— 4. Contrôles —————
do $$
declare
  v_columns integer;
begin
  select count(*)::int into v_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'card_edits'
     and column_name in ('image_fit', 'image_position', 'image_zoom');

  if v_columns <> 3 then
    raise exception 'Cadrage : colonnes manquantes sur card_edits (%)', v_columns;
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'atelier_save_card_edit'
       and pg_get_function_identity_arguments(p.oid) like '%numeric'
  ) then
    raise exception 'Cadrage : atelier_save_card_edit à neuf arguments absente';
  end if;

  raise notice 'Cadrage en ligne : card_edits prêt (image_fit, image_position, image_zoom).';
end
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop function if exists public.atelier_save_card_edit(text, text, text, text, text, text, text, text, numeric);
--  alter table public.card_edits
--    drop column if exists image_zoom,
--    drop column if exists image_position,
--    drop column if exists image_fit;
--  -- Puis réappliquer `atelier_save_card_edit` de la migration 054.
-- ============================================================
