-- ============================================================
--  Migration 003 — catalogue en base + style de profil
--  À coller dans : Dashboard > SQL Editor > New query > Run
--  Rejouable sans risque.
-- ============================================================

-- ————— Catalogue —————
-- Miroir de src/lib/cards.ts, alimenté par `npm run db:cards`.
-- Il sert à faire respecter des règles côté base : rareté d'une carte possédée,
-- unicité des personnages, et plus tard intégrité des annonces du marché.

create table if not exists public.cards (
  id text primary key,
  name text not null,
  universe text not null,
  rarity text not null check (rarity in ('C', 'R', 'SR', 'UR', 'L')),
  number integer not null,
  updated_at timestamptz not null default now()
);

-- Le garde-fou demandé : un même personnage ne peut pas exister deux fois dans
-- le même univers, quelle que soit la casse ou les espaces autour du nom.
create unique index if not exists cards_character_unique
  on public.cards (universe, lower(btrim(name)));

alter table public.cards enable row level security;

drop policy if exists "cards: lecture publique" on public.cards;
create policy "cards: lecture publique"
  on public.cards for select
  using (true);

-- Écriture réservée au script de synchronisation (clé service / connexion admin).
revoke all on public.cards from anon, authenticated;
grant select on public.cards to anon, authenticated;

-- ————— Style de profil —————
alter table public.profiles
  add column if not exists avatar_card_id text,
  add column if not exists frame text not null default 'steel';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_card_fk'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_card_fk
      foreign key (avatar_card_id) references public.cards (id) on delete set null;
  end if;
end;
$$;

-- L'avatar et le cadre ne sont modifiables que par set_profile_style(), qui
-- vérifie la possession de la carte et le déblocage du cadre.
create or replace function public.set_profile_style(p_avatar_card_id text, p_frame text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_unique integer;
  v_legendary integer;
  v_mythic integer;
  v_frame text := coalesce(nullif(btrim(p_frame), ''), 'steel');
  v_avatar text := nullif(btrim(p_avatar_card_id), '');
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_avatar is not null then
    if not exists (
      select 1 from public.collection c
       where c.user_id = v_uid and c.card_id = v_avatar
    ) then
      raise exception 'card_not_owned' using errcode = '42501';
    end if;
  end if;

  select
    count(*)::int,
    count(*) filter (where k.rarity = 'UR')::int,
    count(*) filter (where k.rarity = 'L')::int
    into v_unique, v_legendary, v_mythic
    from public.collection c
    join public.cards k on k.id = c.card_id
   where c.user_id = v_uid;

  v_allowed := case v_frame
    when 'steel' then true
    when 'jade' then v_unique >= 10
    when 'amethyst' then v_unique >= 25
    when 'gold' then v_legendary >= 1
    when 'mythic' then v_mythic >= 1
    else false
  end;

  if not v_allowed then
    raise exception 'frame_locked' using errcode = '42501';
  end if;

  update public.profiles
     set avatar_card_id = v_avatar,
         frame = v_frame
   where id = v_uid;

  return jsonb_build_object('avatar', v_avatar, 'frame', v_frame);
end;
$$;

revoke all on function public.set_profile_style(text, text) from public;
revoke all on function public.set_profile_style(text, text) from anon;
grant execute on function public.set_profile_style(text, text) to authenticated;
