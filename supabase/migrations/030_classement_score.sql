-- ————— Classement au score de collection —————
--
-- Jusqu'ici, `leaderboard()` classait par nombre de personnages possédés, puis
-- par nombre total de cartes. Le score de collection (somme des qualités, une
-- seule fois par personnage) se calcule dans `src/lib/stats.ts` : on stocke donc
-- la qualité de chaque carte en base, synchronisée par `npm run db:cards`.
--
-- La qualité reste une donnée dérivée : le coefficient 0–1 vit dans le code, et
-- la base ne fait que recopier le résultat. Aucun joueur ne peut l'écrire.

alter table public.cards
  add column if not exists quality smallint not null default 0
  check (quality between 0 and 100);

comment on column public.cards.quality is
  'Qualité 0–100 calculée dans src/lib/stats.ts (60 % puissance, 40 % aura).';

-- Changer le type de retour impose de recréer la fonction.
drop function if exists public.leaderboard(integer);

create or replace function public.leaderboard(p_limit integer default 50)
returns table (
  rank bigint,
  username text,
  avatar_card_id text,
  frame text,
  unique_cards bigint,
  total_cards bigint,
  boosters_opened integer,
  collection_score bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with stats as (
    select
      coalesce(p.username, 'Collectionneur') as username,
      p.avatar_card_id,
      coalesce(p.frame, 'steel') as frame,
      coalesce(p.boosters_opened, 0) as boosters_opened,
      count(c.card_id) as unique_cards,
      coalesce(sum(c.quantity), 0) as total_cards,
      -- Une seule fois par personnage : `collection` a une ligne par carte,
      -- quel que soit le nombre de copies (normales et holos confondues).
      coalesce(sum(k.quality), 0)::bigint as collection_score
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
    collection_score
  from ranked
  order by rank
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.leaderboard(integer) from public;
grant execute on function public.leaderboard(integer) to anon, authenticated;

-- Contrôles : la colonne et la fonction doivent exister après la migration.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cards' and column_name = 'quality'
  ) then
    raise exception 'colonne cards.quality absente après migration';
  end if;

  if not exists (select 1 from pg_proc where proname = 'leaderboard') then
    raise exception 'leaderboard() absente après migration';
  end if;
end $$;
