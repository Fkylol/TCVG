-- ============================================================
--  Migration 034 — Durcissement des privilèges
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Audit de sécurité du 24 octobre 2026. Supabase accorde par défaut tous les
--  droits sur les nouvelles tables ET l'exécution des nouvelles fonctions aux
--  rôles `anon` et `authenticated`. Les migrations précédentes retiraient
--  souvent les droits avec `revoke ... from public`, ce qui ne supprime pas
--  ces attributions nominatives : plusieurs objets internes restaient
--  joignables avec la seule clé publique du site.
--
--  Cette migration ne dépend pas des 031 à 033 (Agora et échanges) : elle peut
--  être appliquée avant ou après elles.
-- ============================================================

-- ————— Profils : aucune écriture directe par l'API —————
-- Le profil est créé par le trigger `handle_new_user()` (definer) et modifié
-- uniquement par `set_profile_style()` / `claim_daily_bonus()`. Sans ce
-- retrait, un joueur dont la ligne de profil manquerait pouvait en insérer une
-- avec `is_admin = true` et le solde de son choix, la policy d'insertion ne
-- contrôlant que l'identifiant.
-- `revoke all` plutôt que les seules écritures : Supabase laisse aussi
-- TRUNCATE et TRIGGER aux deux rôles, et TRUNCATE échappe à RLS.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "profiles: creation de son profil" on public.profiles;

-- ————— Collection : lecture seule côté client —————
-- `schema.sql` n'avait jamais révoqué les droits par défaut : `anon` disposait
-- de INSERT / UPDATE / DELETE / TRUNCATE sur `collection`. Les écritures sont
-- heureusement bloquées par RLS (aucune policy d'écriture), mais TRUNCATE
-- échappe à RLS. Tout passe déjà par les fonctions `definer` du serveur.
revoke all on public.collection from anon, authenticated;
grant select on public.collection to authenticated;

-- ————— Tirage des boosters : fonctions internes —————
-- `_store_cards()` écrit dans la collection ; les autres calculent le tirage.
-- Elles ne sont appelées que par `open_pack()` (definer), jamais par le
-- client. En SECURITY INVOKER, `_store_cards()` restait exposée à `anon` : la
-- RLS la bloquait, mais la moindre policy d'écriture ajoutée plus tard en
-- aurait fait un générateur de cartes.
revoke all on function public._store_cards(uuid, jsonb) from public;
revoke all on function public._store_cards(uuid, jsonb) from anon;
revoke all on function public._store_cards(uuid, jsonb) from authenticated;

revoke all on function public._draw_cards(text[], integer, jsonb) from public;
revoke all on function public._draw_cards(text[], integer, jsonb) from anon;
revoke all on function public._draw_cards(text[], integer, jsonb) from authenticated;

revoke all on function public._pick_card(text[], text, text[]) from public;
revoke all on function public._pick_card(text[], text, text[]) from anon;
revoke all on function public._pick_card(text[], text, text[]) from authenticated;

revoke all on function public.random_unit() from public;
revoke all on function public.random_unit() from anon;
revoke all on function public.random_unit() from authenticated;

revoke all on function public.roll_rarity(jsonb, text[], double precision) from public;
revoke all on function public.roll_rarity(jsonb, text[], double precision) from anon;
revoke all on function public.roll_rarity(jsonb, text[], double precision) from authenticated;

-- ————— Vérification —————
-- Les droits restants sont listés : il ne doit plus y avoir d'écriture pour
-- `anon` sur `profiles` et `collection`, ni d'exécution des fonctions
-- internes du tirage.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from information_schema.role_table_grants g
   where g.table_schema = 'public'
     and g.table_name in ('profiles', 'collection')
     and g.grantee in ('anon', 'authenticated')
     and g.privilege_type <> 'SELECT';

  if v_bad > 0 then
    raise warning '034 : % droit(s) d''écriture restent accordés à anon/authenticated', v_bad;
  end if;

  select count(*) into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('_store_cards', '_draw_cards', '_pick_card', 'random_unit', 'roll_rarity')
     and coalesce(p.proacl::text, '') ~ '(anon|authenticated)=';

  if v_bad > 0 then
    raise warning '034 : % fonction(s) internes encore exécutables par anon/authenticated', v_bad;
  end if;
end;
$$;
