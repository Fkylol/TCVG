-- ============================================================
--  Migration 052 — CLASSEMENT : MYTHIQUES ET RANG DU JOUEUR
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  La page de classement affiche désormais, pour chaque joueur, le nombre de
--  personnages mythiques possédés, et une barre fixe en bas avec son propre
--  rang — même s'il est au-delà du top 50.
--
--  `leaderboard()` change de type de retour (une colonne de plus) : il faut la
--  recréer. `leaderboard_me()` renvoie la ligne du joueur connecté et le nombre
--  total de classés.
--
--  Les deux fonctions sont `security definer` : elles lisent les collections de
--  tout le monde sans exposer ni identifiant, ni e-mail, ni la moindre carte.
-- ============================================================

-- Changer le type de retour impose de recréer les fonctions.
drop function if exists public.leaderboard(integer);
drop function if exists public.leaderboard_me();

-- ————— Le classement complet —————

create or replace function public.leaderboard(p_limit integer default 50)
returns table (
  rank bigint,
  username text,
  avatar_card_id text,
  frame text,
  unique_cards bigint,
  total_cards bigint,
  boosters_opened integer,
  collection_score bigint,
  mythic_cards bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with stats as (
    select
      p.id as user_id,
      coalesce(p.username, 'Collectionneur') as username,
      p.avatar_card_id,
      coalesce(p.frame, 'steel') as frame,
      coalesce(p.boosters_opened, 0) as boosters_opened,
      count(c.card_id) as unique_cards,
      coalesce(sum(c.quantity), 0) as total_cards,
      -- Une seule fois par personnage : `collection` a une ligne par carte,
      -- quel que soit le nombre de copies (normales et holos confondues).
      coalesce(sum(k.quality), 0)::bigint as collection_score,
      -- Les légendaires : le palier le plus rare du catalogue.
      count(*) filter (where k.rarity = 'L') as mythic_cards
    from public.profiles p
    left join public.collection c on c.user_id = p.id
    left join public.cards k on k.id = c.card_id
    -- Comme annoncé sur la page : un compte qui n'a jamais ouvert de booster
    -- n'entre pas dans le classement.
    where coalesce(p.boosters_opened, 0) > 0
    group by p.id, p.username, p.avatar_card_id, p.frame, p.boosters_opened
  ),
  ranked as (
    select
      row_number() over (
        order by collection_score desc, unique_cards desc, total_cards desc, username asc
      ) as rank,
      *
    from stats
  )
  select
    rank,
    username,
    avatar_card_id,
    frame,
    unique_cards,
    total_cards,
    boosters_opened,
    collection_score,
    mythic_cards
  from ranked
  order by rank
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.leaderboard(integer) from public;
grant execute on function public.leaderboard(integer) to anon, authenticated;

-- ————— La ligne du joueur connecté —————

create or replace function public.leaderboard_me()
returns table (
  rank bigint,
  username text,
  avatar_card_id text,
  frame text,
  unique_cards bigint,
  total_cards bigint,
  boosters_opened integer,
  collection_score bigint,
  mythic_cards bigint,
  total_players bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with stats as (
    select
      p.id as user_id,
      coalesce(p.username, 'Collectionneur') as username,
      p.avatar_card_id,
      coalesce(p.frame, 'steel') as frame,
      coalesce(p.boosters_opened, 0) as boosters_opened,
      count(c.card_id) as unique_cards,
      coalesce(sum(c.quantity), 0) as total_cards,
      coalesce(sum(k.quality), 0)::bigint as collection_score,
      count(*) filter (where k.rarity = 'L') as mythic_cards
    from public.profiles p
    left join public.collection c on c.user_id = p.id
    left join public.cards k on k.id = c.card_id
    where coalesce(p.boosters_opened, 0) > 0
    group by p.id, p.username, p.avatar_card_id, p.frame, p.boosters_opened
  ),
  ranked as (
    select
      row_number() over (
        order by collection_score desc, unique_cards desc, total_cards desc, username asc
      ) as rank,
      *
    from stats
  )
  select
    ranked.rank,
    ranked.username,
    ranked.avatar_card_id,
    ranked.frame,
    ranked.unique_cards,
    ranked.total_cards,
    ranked.boosters_opened,
    ranked.collection_score,
    ranked.mythic_cards,
    (select count(*) from ranked) as total_players
  from ranked
  where ranked.user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.leaderboard_me() from public;
revoke all on function public.leaderboard_me() from anon;
grant execute on function public.leaderboard_me() to authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'leaderboard'
  ) then
    raise exception 'leaderboard() absente après migration';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'leaderboard_me'
  ) then
    raise exception 'leaderboard_me() absente après migration';
  end if;

  raise notice 'Classement prêt (% joueur(s) classé(s)).',
    (select count(*) from public.profiles where coalesce(boosters_opened, 0) > 0);
end
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop function if exists public.leaderboard_me();
--  Puis rejouer supabase/migrations/030_classement_score.sql pour revenir à
--  l'ancienne `leaderboard()` (sans la colonne des mythiques).
-- ============================================================
