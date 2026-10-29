-- ============================================================
-- Migration 064 — complétion des profils publics
-- Le RPC ne révèle que deux compteurs agrégés, jamais les cartes possédées.
-- ============================================================

create or replace function public.public_profile_completion(p_username text)
returns table (
  owned_unique bigint,
  total_active bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select p.id
      from public.profiles p
     where lower(p.username) = lower(btrim(coalesce(p_username, '')))
       and p.suspended_at is null
     order by (p.id = (select auth.uid())) desc, p.created_at, p.id
     limit 1
  ),
  owned as (
    select count(distinct c.card_id)::bigint as count
      from target
      left join public.collection c
        on c.user_id = target.id and c.quantity > 0
      left join public.cards k
        on k.id = c.card_id and k.active = true
     where k.id is not null
  )
  select
    owned.count,
    (select count(*)::bigint from public.cards where active = true)
  from owned;
$$;

revoke all on function public.public_profile_completion(text) from public;
grant execute on function public.public_profile_completion(text) to anon, authenticated;
