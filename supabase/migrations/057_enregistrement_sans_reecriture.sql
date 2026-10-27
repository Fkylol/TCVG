-- ============================================================
--  Migration 057 — ENREGISTRER SANS RÉÉCRIRE L'IDENTITÉ DE LA CARTE
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  À chaque enregistrement, l'atelier réécrivait le nom, la rareté et
--  l'univers de la carte dans `public.cards`, même quand rien n'avait changé :
--  un simple recadrage de visuel réécrivait toute la fiche. Deux conséquences,
--  vues en production :
--
--    • le nom envoyé pouvait être celui d'une autre carte (formulaire resté
--      sur la carte précédente) : l'écriture se brisait alors sur l'unicité du
--      personnage — `duplicate key value violates unique constraint
--      "cards_character_unique"` — un message incompréhensible pour un simple
--      recadrage ;
--    • `cards.updated_at` bougeait à chaque enregistrement, pour rien.
--
--  L'écriture ne part donc plus que si l'identité change réellement, et un
--  vrai doublon est expliqué en français plutôt que par le message de
--  PostgreSQL.
--
--  Le cadrage (image_fit, image_position, image_zoom) et la rareté gardent
--  exactement le comportement de la migration 056.
-- ============================================================

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

  -- La base suit, mais seulement quand l'identité change vraiment : le `where`
  -- écarte l'écriture à l'identique (recadrage, emoji, visuel), qui n'a rien à
  -- vérifier du côté de l'unicité.
  begin
    update public.cards c
       set name = coalesce(v_name, c.name),
           rarity = coalesce(v_rarity, c.rarity),
           universe = coalesce(v_universe, c.universe),
           updated_at = now()
     where c.id = p_card_id
       and (c.name is distinct from coalesce(v_name, c.name)
         or c.rarity is distinct from coalesce(v_rarity, c.rarity)
         or c.universe is distinct from coalesce(v_universe, c.universe));
  exception
    when unique_violation then
      raise exception 'Ce personnage existe déjà dans cet univers : la carte n''a pas été enregistrée.'
        using errcode = '23505', detail = sqlerrm;
  end;
end;
$$;

revoke all on function public.atelier_save_card_edit(text, text, text, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.atelier_save_card_edit(text, text, text, text, text, text, text, text, numeric) to authenticated;

-- ————— Contrôles —————
do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'atelier_save_card_edit'
       and pg_get_function_identity_arguments(p.oid) like '%numeric'
       and p.prosrc like '%is distinct from coalesce%'
  ) then
    raise exception 'Enregistrement : la version qui n''écrit que sur changement est absente';
  end if;

  -- L'ancienne signature à six arguments reste en place pour une page déjà
  -- chargée pendant un déploiement : elle ne doit pas être supprimée.
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'atelier_save_card_edit'
       and pg_get_function_identity_arguments(p.oid) not like '%numeric'
  ) then
    raise exception 'Enregistrement : la signature à six arguments a disparu';
  end if;

  raise notice 'Enregistrement : identité réécrite seulement sur changement.';
end
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  -- Réappliquer `atelier_save_card_edit` de la migration 056.
-- ============================================================
