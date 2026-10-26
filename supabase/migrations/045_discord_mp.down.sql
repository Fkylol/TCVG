-- ============================================================
--  Retour arrière de la 045 : la liaison Discord et son déclencheur
--  disparaissent. Les offres ne notifient plus personne en privé (la
--  notification in-site reste).
-- ============================================================

drop trigger if exists on_auth_identity_linked on auth.identities;
drop function if exists public.handle_new_identity();
drop table if exists public.discord_links;
