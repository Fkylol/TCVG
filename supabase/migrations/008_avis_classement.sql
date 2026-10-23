-- ============================================================
--  Migration 008 — pages publiques : avis/bugs et classement
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
-- ============================================================

-- ————— Avis et bugs —————
-- Le joueur envoie un message, personne ne le relit depuis le site : la table
-- est en écriture seule (aucune policy de lecture publique) et se consulte
-- depuis le dashboard Supabase.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  -- Nul pour un visiteur non connecté : le pied de page est public.
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  message text not null,
  -- Page depuis laquelle le message a été envoyé, utile pour un bug.
  page text,
  created_at timestamptz not null default now(),
  constraint feedback_kind_valid check (kind in ('avis', 'bug')),
  constraint feedback_message_length check (char_length(message) between 10 and 2000),
  constraint feedback_page_length check (page is null or char_length(page) <= 200)
);

create index if not exists feedback_created_idx
  on public.feedback (created_at desc);

create index if not exists feedback_user_idx
  on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- Insertion seule, et seulement pour soi-même : un visiteur non connecté ne
-- peut pas signer un message d'un autre compte.
drop policy if exists "feedback: envoi d'un message" on public.feedback;
create policy "feedback: envoi d'un message"
  on public.feedback for insert
  with check (user_id is null or user_id = auth.uid());

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

-- ————— Classement —————
-- `profiles` et `collection` ne sont lisibles que par leur propriétaire : une
-- fonction `security definer` expose donc uniquement ce qui est public
-- (pseudo, avatar, cadre, compteurs), jamais l'email ni les lignes brutes.
create or replace function public.leaderboard(p_limit integer default 50)
returns table (
  rank bigint,
  username text,
  avatar_card_id text,
  frame text,
  unique_cards bigint,
  total_cards bigint,
  boosters_opened integer
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
      coalesce(sum(c.quantity), 0) as total_cards
    from public.profiles p
    left join public.collection c on c.user_id = p.id
    group by p.id, p.username, p.avatar_card_id, p.frame, p.boosters_opened
  ),
  ranked as (
    select
      row_number() over (
        order by unique_cards desc, total_cards desc, username asc
      ) as rank,
      *
    from stats
  )
  select rank, username, avatar_card_id, frame, unique_cards, total_cards, boosters_opened
  from ranked
  order by rank
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.leaderboard(integer) from public;
grant execute on function public.leaderboard(integer) to anon, authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'leaderboard') then
    raise exception 'leaderboard() absente après migration';
  end if;
  raise notice 'Avis/bugs et classement en place.';
end;
$$;
