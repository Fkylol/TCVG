-- ============================================================
--  TCVG — schéma Supabase
--  À coller tel quel dans : Dashboard > SQL Editor > New query
--  Le script est rejouable sans risque (idempotent).
-- ============================================================

-- ————— Profils —————
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  last_booster_at timestamptz,
  boosters_opened integer not null default 0,
  created_at timestamptz not null default now()
);

-- Stock de boosters cumulés (max 10) + ancre d'accumulation.
alter table public.profiles
  add column if not exists booster_stock integer not null default 0;

alter table public.profiles enable row level security;

drop policy if exists "profiles: lecture de son profil" on public.profiles;
create policy "profiles: lecture de son profil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: creation de son profil" on public.profiles;
create policy "profiles: creation de son profil"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles: mise a jour de son profil" on public.profiles;
create policy "profiles: mise a jour de son profil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Une policy RLS ne filtre pas les colonnes : sans ceci, un joueur connecté
-- pourrait s'écrire `booster_stock = 999` depuis la console. Le stock, l'ancre
-- et le compteur d'ouvertures ne sont modifiables que par open_boosters().
revoke update on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;

-- ————— Collection —————
create table if not exists public.collection (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  quantity integer not null default 1 check (quantity > 0),
  first_obtained_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists collection_user_idx on public.collection (user_id);

alter table public.collection enable row level security;

-- Lecture seule côté client : les écritures passent uniquement par open_boosters().
drop policy if exists "collection: lecture de sa collection" on public.collection;
create policy "collection: lecture de sa collection"
  on public.collection for select
  using (auth.uid() = user_id);

-- ————— Création automatique du profil à l'inscription —————
-- Un nouveau compte démarre avec 1 booster en stock.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, last_booster_at, booster_stock)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'collectionneur'), '@', 1)
    ),
    now(),
    1
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comptes créés avant l'ajout du stock : on leur offre le premier booster.
update public.profiles
   set booster_stock = 1,
       last_booster_at = coalesce(last_booster_at, now())
 where booster_stock = 0
   and boosters_opened = 0;

-- ————— Ouverture de boosters (atomique) —————
-- p_count boosters, soit exactement p_count * 3 cartes dans p_cards.
-- Le stock s'accumule d'un booster toutes les 10 minutes, plafonné à 10.
create or replace function public.open_boosters(p_cards text[], p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_stock integer;
  v_anchor timestamptz;
  v_now timestamptz := now();
  v_cooldown interval := interval '10 minutes';
  v_max integer := 10;
  v_accrued integer;
  v_card text;
  v_new text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_count is null or p_count < 1 or p_count > v_max then
    raise exception 'invalid_count' using errcode = '22023';
  end if;

  if p_cards is null or array_length(p_cards, 1) is distinct from p_count * 3 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  -- Verrouille le profil : deux ouvertures simultanées ne peuvent pas
  -- consommer le même stock.
  select booster_stock, last_booster_at
    into v_stock, v_anchor
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  -- Accumulation : 1 booster par tranche de 10 minutes écoulées.
  if v_anchor is null then
    v_anchor := v_now;
  end if;

  v_accrued := floor(extract(epoch from (v_now - v_anchor)) / extract(epoch from v_cooldown))::int;

  if v_accrued > 0 then
    v_stock := least(v_max, v_stock + v_accrued);
    if v_stock >= v_max then
      -- Stock plein : l'ancre repart de maintenant, sinon le temps serait perdu.
      v_anchor := v_now;
    else
      v_anchor := v_anchor + (v_accrued * v_cooldown);
    end if;
  end if;

  if v_stock < p_count then
    return jsonb_build_object(
      'ok', false,
      'opened', 0,
      'stock', v_stock,
      'anchor', v_anchor
    );
  end if;

  foreach v_card in array p_cards loop
    if not exists (
      select 1 from public.collection
       where user_id = v_uid and card_id = v_card
    ) then
      v_new := array_append(v_new, v_card);
    end if;

    insert into public.collection as c (user_id, card_id, quantity)
    values (v_uid, v_card, 1)
    on conflict (user_id, card_id)
      do update set quantity = c.quantity + 1;
  end loop;

  update public.profiles
     set booster_stock = v_stock - p_count,
         last_booster_at = v_anchor,
         boosters_opened = boosters_opened + p_count
   where id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'opened', p_count,
    'stock', v_stock - p_count,
    'anchor', v_anchor,
    'new_cards', to_jsonb(v_new)
  );
end;
$$;

revoke all on function public.open_boosters(text[], integer) from public;
revoke all on function public.open_boosters(text[], integer) from anon;
grant execute on function public.open_boosters(text[], integer) to authenticated;

-- Ancienne signature (un booster à la fois), remplacée par open_boosters().
drop function if exists public.open_booster(text[]);

-- ————— Catalogue en base —————
-- Miroir de src/lib/cards.ts (voir `npm run db:cards`), nécessaire aux règles
-- vérifiées côté serveur : rareté d'une carte possédée, unicité des personnages.
create table if not exists public.cards (
  id text primary key,
  name text not null,
  universe text not null,
  rarity text not null check (rarity in ('C', 'UC', 'R', 'SR', 'UR', 'L')),
  number integer not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists cards_character_unique
  on public.cards (universe, lower(btrim(name)));

alter table public.cards enable row level security;

drop policy if exists "cards: lecture publique" on public.cards;
create policy "cards: lecture publique"
  on public.cards for select
  using (true);

revoke all on public.cards from anon, authenticated;
grant select on public.cards to anon, authenticated;

-- ————— Style de profil (avatar + cadre) —————
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

-- ————— Fin du schéma de base —————
-- Ouverture des boosters : `open_pack(p_slug)` et `buy_booster(p_slug)`
-- (migration 014). L'ancienne `open_boosters(p_cards, p_count)` recevait les
-- cartes du client ; elle est supprimée ici pour qu'un `npm run db:migrate`
-- sans argument ne la réintroduise pas.
drop function if exists public.open_boosters(text[], integer);
