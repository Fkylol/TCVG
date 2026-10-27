-- ============================================================
--  Migration 051 — CADEAU DE BIENVENUE : 10 BOOSTERS
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Le cadeau vit dans `profiles.bonus_boosters`, le solde déjà utilisé par les
--  récompenses de parrainage et le booster d'Halloween : il ne compte pas dans
--  le plafond de stock (`BOOSTER_STOCK_MAX`), n'expire pas et se consomme quand
--  le stock normal est vide.
--
--  1. Tout nouveau compte reçoit 10 boosters bonus à la création.
--  2. Chaque joueur déjà inscrit reçoit une fois les mêmes 10 boosters.
--
--  `booster_grants` sert de journal : sa ligne `cadeau-10-boosters` empêche de
--  verser le cadeau deux fois si la migration est rejouée.
-- ============================================================

-- ————— 0. Journal des cadeaux —————

-- `booster_grants` servait uniquement aux récompenses de parrainage, d'où une
-- colonne `referral_id` obligatoire. Un cadeau n'a pas de parrainage : la
-- colonne devient facultative.

alter table public.booster_grants
  alter column referral_id drop not null;

-- La contrainte de motif ne connaissait que le parrainage : on y ajoute les
-- deux motifs du cadeau (création de compte, versement unique).
alter table public.booster_grants
  drop constraint if exists booster_grants_reason_check;
alter table public.booster_grants
  add constraint booster_grants_reason_check
  check (reason in ('parrain', 'filleul', 'bienvenue', 'cadeau-10-boosters'));

-- ————— 1. Nouveaux comptes —————

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_created uuid;
begin
  insert into public.profiles (id, username, last_booster_at, booster_stock, bonus_boosters)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'collectionneur'), '@', 1)
    ),
    now(),
    1,
    10
  )
  on conflict (id) do nothing
  returning id into v_created;

  -- Profil réellement créé : on garde la trace du cadeau.
  if v_created is not null then
    insert into public.booster_grants (user_id, amount, reason)
    values (v_created, 10, 'bienvenue');
  end if;

  return new;
end;
$function$;

-- ————— 2. Joueurs déjà inscrits —————

do $$
declare
  v_players integer;
begin
  if exists (select 1 from public.booster_grants where reason = 'cadeau-10-boosters') then
    raise notice 'Cadeau déjà versé : aucun profil modifié.';
    return;
  end if;

  update public.profiles
     set bonus_boosters = bonus_boosters + 10;

  insert into public.booster_grants (user_id, amount, reason)
  select id, 10, 'cadeau-10-boosters'
    from public.profiles;

  select count(*) into v_players from public.profiles;
  raise notice 'Cadeau versé à % joueur(s).', v_players;
end
$$;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'handle_new_user'
  ) then
    raise exception 'handle_new_user() absente après migration';
  end if;

  raise notice 'Solde bonus : % booster(s) au total sur le jeu.',
    (select coalesce(sum(bonus_boosters), 0) from public.profiles);
end
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  update public.profiles p
--     set bonus_boosters = greatest(p.bonus_boosters - 10, 0)
--   where exists (
--     select 1 from public.booster_grants g
--      where g.user_id = p.id and g.reason = 'cadeau-10-boosters');
--
--  delete from public.booster_grants where reason in ('cadeau-10-boosters', 'bienvenue');
--
--  Puis restaurer `handle_new_user()` (supabase/schema.sql).
-- ============================================================
