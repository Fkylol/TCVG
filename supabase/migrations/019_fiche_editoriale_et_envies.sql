-- ============================================================
--  Migration 019 — Fiche éditoriale verrouillée et envies bornées
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque (idempotente).
--
--  1. `card_profiles` : le contenu éditorial d'une carte (biographie,
--     apparitions, studio, voix, anecdotes, source). Jamais dans `cards`,
--     donc jamais dans le catalogue chargé côté client.
--  2. `card_profile()` : lecture seule côté serveur, réservée aux joueurs qui
--     possèdent la carte. Sans la carte, la fonction ne renvoie que
--     `{"unlocked": false}` — aucun champ éditorial ne traverse la réponse.
--  3. `card_wishlist_count()` : « dans les envies de N joueurs », masqué sous
--     3 envies pour ne pas exposer de chiffres individuels.
--  4. `wishlist` : plafond de 200 envies par joueur, posé par trigger.
--
--  Réversibilité : le bloc ROLLBACK en fin de fichier annule tout.
-- ============================================================

-- ————— 1. Fiche éditoriale —————
create table if not exists public.card_profiles (
  card_id text primary key references public.cards (id) on delete cascade,
  bio text,
  appearances text[],
  studio text,
  voice text,
  trivia text,
  source_name text,
  source_url text,
  updated_at timestamptz not null default now(),
  -- Une source affichée doit avoir un nom : un lien seul ne s'attribue pas.
  constraint card_profiles_source_check check (source_url is null or source_name is not null)
);

alter table public.card_profiles enable row level security;

-- Aucune policy : la table n'est lisible ni par `anon` ni par `authenticated`.
-- Tout passe par `card_profile()`, qui vérifie la possession.
drop policy if exists "card_profiles: aucun acces direct" on public.card_profiles;
revoke all on public.card_profiles from anon, authenticated;

create index if not exists card_profiles_updated_idx
  on public.card_profiles (updated_at desc);

-- ————— 2. Lecture conditionnée à la possession —————
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
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Carte absente ou retirée : aucun contenu, même pour un possesseur.
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

  select * into v_row
    from public.card_profiles
   where card_id = p_card_id;

  if v_row.card_id is null then
    return jsonb_build_object('unlocked', true);
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'bio', v_row.bio,
    'appearances', to_jsonb(v_row.appearances),
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

-- ————— 3. Compteur d'envies public, mais jamais sous 3 —————
create or replace function public.card_wishlist_count(p_card_id text)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select case when count(*) >= 3 then count(*)::int else null end
    from public.wishlist w
   where w.card_id = p_card_id;
$$;

revoke all on function public.card_wishlist_count(text) from public;
grant execute on function public.card_wishlist_count(text) to anon, authenticated;

-- ————— 4. Plafond de 200 envies par joueur —————
create or replace function public.enforce_wishlist_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_max integer := 200;
begin
  select count(*)::int
    into v_count
    from public.wishlist w
   where w.user_id = new.user_id;

  if v_count >= v_max then
    raise exception 'wishlist_full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists wishlist_limit on public.wishlist;
create trigger wishlist_limit
  before insert on public.wishlist
  for each row execute function public.enforce_wishlist_limit();

revoke all on function public.enforce_wishlist_limit() from public;

-- ————— Contrôle final —————
do $$
declare
  v_table boolean;
  v_profiles integer;
begin
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'card_profiles'
  ) into v_table;

  if not v_table then
    raise exception 'table card_profiles absente';
  end if;

  select count(*)::int into v_profiles from public.card_profiles;
  raise notice 'fiches éditoriales en base : %', v_profiles;
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main pour annuler cette migration)
-- ============================================================
-- drop trigger if exists wishlist_limit on public.wishlist;
-- drop function if exists public.enforce_wishlist_limit();
-- drop function if exists public.card_wishlist_count(text);
-- drop function if exists public.card_profile(text);
-- drop table if exists public.card_profiles;
