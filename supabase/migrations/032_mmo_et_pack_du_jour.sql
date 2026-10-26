-- ============================================================
--  Migration 032 — Pack MMO (le roulement est retiré par la 035)
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Deux changements :
--    • le pack MMO rejoint le catalogue (genre `mmo` + type de booster) ;
--    • un roulement quotidien avait été ajouté ici : il est retiré par la
--      migration 035, qui rebranche `open_pack()` sur le tirage direct. Le
--      bloc « 2 » et l'enveloppe du bloc « 3 » ne sont donc plus la règle en
--      vigueur ; ils restent dans l'historique des migrations appliquées.
--
--  Aucune table ni colonne n'a jamais porté ce roulement : il était recalculé
--  à chaque appel à partir de la date à Paris.
-- ============================================================

-- ————— 1. Genre et pack MMO —————
-- Les cartes (WoW, FF XIV, Dofus, Guild Wars 2) sont rattachées au genre par
-- `npm run db:genres` ; sans cartes, le pack reste « bientôt disponible ».
insert into public.genres (slug, name, description)
values (
  'mmo',
  'MMO',
  'Jeux en ligne persistants : World of Warcraft, Final Fantasy XIV, Dofus, Guild Wars 2.'
)
-- Le nom suffit : une description déjà rédigée en base n'est pas écrasée.
on conflict (slug) do update
  set name = excluded.name;

insert into public.booster_types (slug, name, genre_id, cards_count)
select 'mmo', 'MMO', g.id, 5
  from public.genres g
 where g.slug = 'mmo'
on conflict (slug) do nothing;

-- ————— 2. Fonction de roulement —————
-- Le pack du jour est un index déterministe dans la liste triée des packs
-- spécialisés disponibles : même jour = même pack pour tout le monde, sans
-- état à stocker. Un pack indisponible (pool trop petit) sort de la liste.
create or replace function public.daily_pack_slug_at(p_at timestamptz)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  with eligible as (
    select ps.slug
      from public.pack_stats() as ps
     where ps.available
       and ps.genre_id is not null
  ),
  listed as (
    select array_agg(slug order by slug) as slugs from eligible
  )
  select case
    when slugs is null or cardinality(slugs) = 0 then null
    else slugs[
      1 + (
        floor(
          extract(epoch from ((p_at at time zone 'Europe/Paris')::date)) / 86400
        )::int % cardinality(slugs)
      )
    ]
  end
  from listed;
$$;

create or replace function public.daily_pack_slug()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select public.daily_pack_slug_at(now());
$$;

-- Informations du panneau : pack du jour, pack de demain, fin du roulement et
-- liste complète (pour l'affichage « demain » sans seconde requête).
create or replace function public.daily_pack_info()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with next_rotation as (
    select (
      date_trunc('day', now() at time zone 'Europe/Paris') + interval '1 day'
    ) at time zone 'Europe/Paris' as next_at
  )
  select jsonb_build_object(
    'slug', public.daily_pack_slug_at(now()),
    'tomorrow', public.daily_pack_slug_at(next_at),
    'next_at', next_at,
    'rotation', coalesce((
      select jsonb_agg(ps.slug order by ps.slug)
        from public.pack_stats() as ps
       where ps.available
         and ps.genre_id is not null
    ), '[]'::jsonb)
  )
  from next_rotation;
$$;

revoke all on function public.daily_pack_slug_at(timestamptz) from public;
revoke all on function public.daily_pack_slug_at(timestamptz) from anon;
revoke all on function public.daily_pack_slug() from public;
revoke all on function public.daily_pack_slug() from anon;
revoke all on function public.daily_pack_info() from public;
revoke all on function public.daily_pack_info() from anon;
grant execute on function public.daily_pack_slug_at(timestamptz) to authenticated;
grant execute on function public.daily_pack_slug() to authenticated;
grant execute on function public.daily_pack_info() to authenticated;

-- ————— 3. open_pack devient un garde-fou —————
-- On renomme l'ouverture existante (migration 014) et on la remplace par une
-- enveloppe qui vérifie le roulement. Recopier tout le tirage serait une
-- source de divergence : il reste à un seul endroit, `open_pack_any()`.
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_pack'
  ) and not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_pack_any'
  ) then
    alter function public.open_pack(text) rename to open_pack_any;
  end if;
end;
$$;

create or replace function public.open_pack(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slug text := nullif(btrim(p_slug), '');
  v_daily text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_slug is null or not exists (
    select 1 from public.booster_types where slug = v_slug and active
  ) then
    raise exception 'unknown_pack' using errcode = 'P0002';
  end if;

  -- Le Mix reste toujours ouvrable ; un pack spécialisé doit être celui du
  -- jour. Le refus est renvoyé, pas levé : l'interface peut l'expliquer.
  if v_slug <> 'mix' then
    v_daily := public.daily_pack_slug();

    if v_daily is null then
      return jsonb_build_object('ok', false, 'reason', 'rotation_unavailable');
    end if;

    if v_slug <> v_daily then
      return jsonb_build_object(
        'ok', false,
        'reason', 'pack_not_today',
        'daily', v_daily
      );
    end if;
  end if;

  return public.open_pack_any(v_slug);
end;
$$;

-- L'ouverture réelle n'est plus appelable par un joueur : seul le garde-fou
-- ci-dessus y accède (les deux fonctions appartiennent au même propriétaire).
revoke all on function public.open_pack_any(text) from public;
revoke all on function public.open_pack_any(text) from anon;
revoke all on function public.open_pack_any(text) from authenticated;

revoke all on function public.open_pack(text) from public;
revoke all on function public.open_pack(text) from anon;
grant execute on function public.open_pack(text) to authenticated;

-- ————— 4. Contrôles finaux —————
do $$
declare
  v_daily text;
  v_packs integer;
begin
  if not exists (select 1 from public.genres where slug = 'mmo') then
    raise exception 'genre mmo absent';
  end if;

  if not exists (select 1 from public.booster_types where slug = 'mmo' and active) then
    raise exception 'booster mmo absent';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_pack_any'
  ) then
    raise exception 'open_pack_any absent : le renommage a échoué';
  end if;

  if has_function_privilege('authenticated', 'public.open_pack_any(text)', 'execute') then
    raise exception 'les joueurs peuvent contourner le roulement';
  end if;

  v_daily := public.daily_pack_slug();
  select count(*)::int into v_packs
    from public.booster_types where active;

  if v_daily is not null and not exists (
    select 1 from public.booster_types where slug = v_daily and active and genre_id is not null
  ) then
    raise exception 'pack du jour invalide : %', v_daily;
  end if;

  raise notice 'Roulement en place : % packs, pack du jour = %, demain = %.',
    v_packs,
    coalesce(v_daily, '(aucun pack disponible)'),
    coalesce((public.daily_pack_info() ->> 'tomorrow'), '(aucun)');
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop function if exists public.open_pack(text);
--  alter function public.open_pack_any(text) rename to open_pack;
--  grant execute on function public.open_pack(text) to authenticated;
--  drop function if exists public.daily_pack_info();
--  drop function if exists public.daily_pack_slug();
--  drop function if exists public.daily_pack_slug_at(timestamptz);
--  delete from public.card_genres
--   where genre_id = (select id from public.genres where slug = 'mmo');
--  delete from public.booster_types where slug = 'mmo';
--  delete from public.genres where slug = 'mmo';
-- ============================================================
