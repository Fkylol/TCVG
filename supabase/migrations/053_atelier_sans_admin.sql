-- ============================================================
--  Migration 053 — ATELIER : DEUX COMPTES, SANS DROITS D'ADMIN
--  Rejouable sans risque.
--
--  L'atelier ne dépend plus de `is_admin()` : son accès est une liste
--  nominative dans `src/lib/atelier-access.ts` (deathsky74, asperge). Ces deux
--  comptes n'ont donc plus besoin du rôle d'administration, qui ouvre les
--  onglets Admin (marché), Parrainages et Cadres — on le leur retire ici.
--
--  Les autres administrateurs gardent leurs droits ; ils perdent seulement
--  l'accès à l'atelier, réservé aux deux comptes du catalogue.
-- ============================================================

-- ————— 1. Les deux comptes de l'atelier ne sont plus administrateurs —————
update public.profiles
   set is_admin = false
 where lower(username) in ('deathsky74', 'asperge')
   and is_admin;

-- ————— 2. Contrôle : qui reste administrateur —————
do $$
declare
  v_admins text;
  v_atelier integer;
begin
  select coalesce(string_agg(p.username, ', ' order by p.username), 'aucun')
    into v_admins
    from public.profiles p
   where p.is_admin;

  select count(*) into v_atelier
    from public.profiles p
   where lower(p.username) in ('deathsky74', 'asperge');

  if v_atelier <> 2 then
    raise exception 'Comptes de l''atelier introuvables (attendu 2, trouvé %)', v_atelier;
  end if;

  raise notice 'Administrateurs restants : %', v_admins;
end
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  update public.profiles set is_admin = true
--   where lower(username) in ('deathsky74', 'asperge');
-- ============================================================
