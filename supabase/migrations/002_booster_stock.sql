-- ============================================================
--  Migration 002 — stock de boosters cumulables (max 10)
--  À coller dans : Dashboard > SQL Editor > New query > Run
--  Rejouable sans risque.
-- ============================================================

-- 1. Colonne de stock
alter table public.profiles
  add column if not exists booster_stock integer not null default 0;

-- Sans ceci, un joueur connecté peut s'écrire `booster_stock = 999` : une
-- policy RLS limite les lignes, pas les colonnes. Seul open_boosters()
-- (security definer) peut toucher au stock, à l'ancre et au compteur.
revoke update on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;

-- 2. Un nouveau compte démarre avec 1 booster
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
      split_part(new.email, '@', 1)
    ),
    now(),
    1
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Ouverture de 1 à 10 boosters en une fois
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

  select booster_stock, last_booster_at
    into v_stock, v_anchor
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  if v_anchor is null then
    v_anchor := v_now;
  end if;

  v_accrued := floor(extract(epoch from (v_now - v_anchor)) / extract(epoch from v_cooldown))::int;

  if v_accrued > 0 then
    v_stock := least(v_max, v_stock + v_accrued);
    if v_stock >= v_max then
      v_anchor := v_now;
    else
      v_anchor := v_anchor + (v_accrued * v_cooldown);
    end if;
  end if;

  if v_stock < p_count then
    return jsonb_build_object('ok', false, 'opened', 0, 'stock', v_stock, 'anchor', v_anchor);
  end if;

  foreach v_card in array p_cards loop
    if not exists (
      select 1 from public.collection where user_id = v_uid and card_id = v_card
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

-- 4. Ancienne signature (un booster à la fois)
drop function if exists public.open_booster(text[]);

-- 5. Comptes existants n'ayant jamais ouvert de booster : un offert
update public.profiles
   set booster_stock = 1,
       last_booster_at = coalesce(last_booster_at, now())
 where booster_stock = 0
   and boosters_opened = 0;
