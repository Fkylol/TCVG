-- ============================================================
--  Migration 063 — VITRINE PUBLIQUE DES PROFILS
--  Huit emplacements de cartes sélectionnées par chaque joueur.
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  La table n'est jamais exposée directement à l'API :
--    • public_profile_showcase() ne renvoie que le pseudo, l'avatar, le cadre
--      et les huit cartes choisies encore présentes dans la collection ;
--    • save_profile_showcase() vérifie la session, les huit emplacements,
--      l'absence de doublons et la possession de chaque carte.
-- ============================================================

create table if not exists public.profile_showcase (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot between 1 and 8),
  card_id text not null references public.cards (id) on delete cascade,
  primary key (user_id, slot),
  unique (user_id, card_id)
);

alter table public.profile_showcase enable row level security;
revoke all on public.profile_showcase from anon, authenticated;

create or replace function public.public_profile_showcase(p_username text)
returns table (
  username text,
  avatar_card_id text,
  frame text,
  is_owner boolean,
  slot smallint,
  card_id text,
  holo_quantity integer,
  variant text
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select p.id, p.username, p.avatar_card_id, coalesce(p.frame, 'steel') as frame
      from public.profiles p
     where lower(p.username) = lower(btrim(coalesce(p_username, '')))
       and p.suspended_at is null
     order by (p.id = (select auth.uid())) desc, p.created_at, p.id
     limit 1
  )
  select
    target.username,
    target.avatar_card_id,
    target.frame,
    target.id = (select auth.uid()),
    slots.slot::smallint,
    case when c.card_id is not null then showcase.card_id else null end,
    coalesce(c.holo_quantity, 0)::integer,
    coalesce(c.variant, 'normal')
  from target
  cross join generate_series(1, 8) as slots(slot)
  left join public.profile_showcase showcase
    on showcase.user_id = target.id and showcase.slot = slots.slot
  left join public.collection c
    on c.user_id = target.id and c.card_id = showcase.card_id
  order by slots.slot;
$$;

revoke all on function public.public_profile_showcase(text) from public;
grant execute on function public.public_profile_showcase(text) to anon, authenticated;

create or replace function public.save_profile_showcase(p_card_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cards text[];
  v_owned integer;
  v_distinct integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if coalesce(cardinality(p_card_ids), 0) <> 8 then
    raise exception 'invalid_showcase' using errcode = '22023';
  end if;

  select array_agg(nullif(btrim(value), '') order by ordinal)
    into v_cards
    from unnest(p_card_ids) with ordinality as input(value, ordinal);

  select count(*) filter (where card_id is not null),
         count(distinct card_id)
    into v_owned, v_distinct
    from unnest(v_cards) as selected(card_id);

  if v_owned <> v_distinct then
    raise exception 'duplicate_showcase_card' using errcode = '22023';
  end if;

  if exists (
    select 1
      from unnest(v_cards) as selected(card_id)
     where selected.card_id is not null
       and not exists (
         select 1 from public.collection c
          where c.user_id = v_uid
            and c.card_id = selected.card_id
            and c.quantity > 0
       )
  ) then
    raise exception 'card_not_owned' using errcode = '42501';
  end if;

  -- Serialise les sauvegardes d'un profil ; suppression + insertion reste
  -- atomique et ne peut jamais publier un mélange de deux sélections.
  perform 1 from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  delete from public.profile_showcase where user_id = v_uid;
  insert into public.profile_showcase (user_id, slot, card_id)
  select v_uid, selected.ordinal::smallint, selected.card_id
    from unnest(v_cards) with ordinality as selected(card_id, ordinal)
   where selected.card_id is not null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_profile_showcase(text[]) from public;
revoke all on function public.save_profile_showcase(text[]) from anon;
grant execute on function public.save_profile_showcase(text[]) to authenticated;

-- Contrôles : seuls les RPCs autorisés sont accessibles via l'API.
do $$
begin
  if has_table_privilege('anon', 'public.profile_showcase', 'select')
     or has_table_privilege('authenticated', 'public.profile_showcase', 'select') then
    raise exception 'vitrine : accès direct à la table encore accordé';
  end if;
  if not has_function_privilege('anon', 'public.public_profile_showcase(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_profile_showcase(text[])', 'execute') then
    raise exception 'vitrine : droits RPC manquants';
  end if;
end;
$$;
