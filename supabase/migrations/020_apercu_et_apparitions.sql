-- ============================================================
--  Migration 020 — Aperçu, biographie et apparitions
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque (idempotente).
--
--  1. `card_profiles.overview` : le résumé affiché en tête de fiche.
--  2. `card_appearances` : les œuvres où le personnage apparaît, avec leur
--     média (manga, jeu, film…) pour le tableau « Apparitions ».
--     L'ancien tableau `appearances text[]` ne portait que des titres : il est
--     supprimé après reprise des éventuelles lignes existantes.
--  3. `card_profile()` renvoie l'aperçu et les apparitions ordonnées.
--
--  Réversibilité : le bloc ROLLBACK en fin de fichier annule tout.
-- ============================================================

-- ————— 1. Résumé —————
alter table public.card_profiles
  add column if not exists overview text;

-- ————— 2. Apparitions détaillées —————
create table if not exists public.card_appearances (
  card_id text not null references public.cards (id) on delete cascade,
  position integer not null default 0,
  media text not null,
  title text not null,
  primary key (card_id, position)
);

alter table public.card_appearances enable row level security;

-- Table lue uniquement par `card_profile()`, qui vérifie la possession.
revoke all on public.card_appearances from anon, authenticated;

create index if not exists card_appearances_card_idx
  on public.card_appearances (card_id, position);

-- Reprise de l'ancien tableau : chaque titre devient une ligne sans média
-- connu. Aucune donnée n'est perdue, le média reste à compléter.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'card_profiles'
       and column_name = 'appearances'
  ) then
    insert into public.card_appearances (card_id, position, media, title)
    select p.card_id,
           coalesce(t.ord - 1, 0),
           '—',
           t.title
      from public.card_profiles p
      cross join lateral unnest(p.appearances) with ordinality as t(title, ord)
     where t.title is not null
       and btrim(t.title) <> ''
    on conflict (card_id, position) do nothing;

    alter table public.card_profiles drop column appearances;
  end if;
end;
$$;

-- ————— 3. Lecture conditionnée à la possession —————
create or replace function public.card_profile(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.card_profiles;
  v_appearances jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
      from public.cards k
     where k.id = p_card_id
       and k.active
  ) then
    return jsonb_build_object('unlocked', false, 'missing', true);
  end if;

  if not exists (
    select 1
      from public.collection c
     where c.user_id = v_uid
       and c.card_id = p_card_id
  ) then
    return jsonb_build_object('unlocked', false);
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object('media', a.media, 'title', a.title)
             order by a.position
           ),
           '[]'::jsonb
         )
    into v_appearances
    from public.card_appearances a
   where a.card_id = p_card_id;

  select * into v_row
    from public.card_profiles
   where card_id = p_card_id;

  if v_row.card_id is null then
    return jsonb_build_object('unlocked', true, 'appearances', v_appearances);
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'overview', v_row.overview,
    'bio', v_row.bio,
    'appearances', v_appearances,
    'studio', v_row.studio,
    'voice', v_row.voice,
    'trivia', v_row.trivia,
    'source_name', v_row.source_name,
    'source_url', v_row.source_url,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.card_profile(text) from public;
revoke all on function public.card_profile(text) from anon;
grant execute on function public.card_profile(text) to authenticated;

-- ————— Contrôle final —————
do $$
declare
  v_columns integer;
begin
  select count(*)::int into v_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'card_profiles'
     and column_name in ('overview', 'appearances');

  if v_columns <> 1 then
    raise exception 'colonne overview absente de card_profiles';
  end if;

  raise notice 'aperçu et apparitions en place';
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main pour annuler cette migration)
-- ============================================================
-- alter table public.card_profiles add column appearances text[];
-- update public.card_profiles p set appearances = a.titles
--   from (select card_id, array_agg(title order by position) as titles
--           from public.card_appearances group by card_id) a
--  where a.card_id = p.card_id;
-- drop table if exists public.card_appearances;
-- alter table public.card_profiles drop column overview;
