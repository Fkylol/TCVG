-- ============================================================
--  Migration 035 — Tous les packs restent ouvrables
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  La rotation quotidienne (migration 032) est retirée. Elle ne reposait sur
--  aucune table, aucune colonne et aucune tâche planifiée : seulement trois
--  fonctions de calcul et une enveloppe `open_pack()` qui refusait les packs
--  hors roulement. On rend l'ouverture directe à la fonction de tirage
--  (`open_pack_any`, migrations 014 et 015), qui garde l'authentification, le
--  stock et le seuil de pool, puis on supprime les fonctions du roulement,
--  désormais sans appelant.
--
--  Aucune donnée de joueur n'est lue, modifiée ou supprimée.
-- ============================================================

do $$
begin
  -- 1. L'enveloppe du roulement disparaît ; le tirage reprend son nom.
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_pack_any'
  ) then
    drop function if exists public.open_pack(text);
    alter function public.open_pack_any(text) rename to open_pack;
  end if;
end;
$$;

revoke all on function public.open_pack(text) from public;
revoke all on function public.open_pack(text) from anon;
grant execute on function public.open_pack(text) to authenticated;

-- 2. Les fonctions du roulement n'ont plus d'appelant.
drop function if exists public.daily_pack_info();
drop function if exists public.daily_pack_slug();
drop function if exists public.daily_pack_slug_at(timestamptz);

-- 3. Contrôles finaux
do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_pack'
  ) then
    raise exception 'open_pack absente';
  end if;

  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_pack_any'
  ) then
    raise exception 'open_pack_any existe encore : le renommage a échoué';
  end if;

  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'daily_pack_%'
  ) then
    raise exception 'fonctions de roulement encore présentes';
  end if;

  if has_function_privilege('anon', 'public.open_pack(text)', 'execute') then
    raise exception 'open_pack ne doit pas être exécutable par anon';
  end if;

  raise notice 'Ouverture directe rétablie pour les % packs actifs.',
    (select count(*) from public.booster_types where active);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  recreate la fonction `daily_pack_slug_at`, `daily_pack_slug` et
--  `daily_pack_info` telles que dans la migration 032, puis l'enveloppe
--  `open_pack` de cette même migration.
-- ============================================================
