-- ============================================================
--  Rollback de la migration 047 — cadres d'avatar
--  À exécuter seulement pour revenir à l'ancien système.
--
--  Les déblocages des nouveaux cadres sont perdus (le site est en
--  développement). Les colonnes d'activité et l'alias `profiles.frame`
--  redeviennent la colonne historique.
-- ============================================================

-- ————— Triggers —————
drop trigger if exists profiles_frames_ban on public.profiles;
drop trigger if exists profiles_frames_default on public.profiles;
drop trigger if exists collection_frames_queue on public.collection;
drop trigger if exists trades_frames_queue on public.trades;
drop trigger if exists booster_openings_frames_queue on public.booster_openings;
drop trigger if exists referrals_frames_queue on public.referrals;

-- ————— Fonctions —————
drop function if exists public.referral_referred_avatars();
drop function if exists public.frame_sweep_list(integer);
drop function if exists public.frame_queue_list(integer);
drop function if exists public.frame_admin_queue_all();
drop function if exists public.frame_admin_remove(text, text, text);
drop function if exists public.frame_admin_assign(text, text, text, text);
drop function if exists public.frame_admin_set_active(text, boolean, text);
drop function if exists public.frame_admin_report();
drop function if exists public.frame_apply(uuid, jsonb, text[], text[]);
drop function if exists public.frame_stats(uuid);
drop function if exists public.frame_queue_referral();
drop function if exists public.frame_queue_opening();
drop function if exists public.frame_queue_trade();
drop function if exists public.frame_queue_collection();
drop function if exists public.frame_clear_on_ban();
drop function if exists public.frame_default_on_profile();
drop function if exists public.frame_enqueue(uuid);

-- ————— Notifications —————
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing',
    'swap_offer', 'swap_accepted', 'swap_declined', 'swap_expired',
    'listing_cancelled', 'order_cancelled',
    'referral_milestone', 'referral_pending', 'referral_paid', 'referral_refused'
  ));

alter table public.notifications drop column if exists frame_id;

-- ————— Sélection : retour à l'ancienne fonction (003) —————
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

-- ————— Activité : ancienne version sans file de cadres —————
create or replace function public.record_activity_day()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  insert into public.profile_activity_days (user_id, day)
  values (v_uid, (now() at time zone 'utc')::date)
  on conflict (user_id, day) do nothing;
end;
$$;

revoke all on function public.record_activity_day() from public;
revoke all on function public.record_activity_day() from anon;
grant execute on function public.record_activity_day() to authenticated;

-- ————— Marché : signature de 023, sans avatar ni cadre vendeur —————
drop function if exists public.market_listings();

create function public.market_listings()
returns table (
  id bigint,
  card_id text,
  holo boolean,
  price_pixels integer,
  status text,
  created_at timestamptz,
  sold_at timestamptz,
  fee_pixels integer,
  seller_payout integer,
  seller_id uuid,
  seller_username text,
  mine boolean,
  genres text[],
  expires_at timestamptz,
  cancel_reason text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    l.id,
    l.card_id,
    l.holo,
    l.price_pixels,
    l.status,
    l.created_at,
    l.sold_at,
    l.fee_pixels,
    l.seller_payout,
    l.seller_id,
    coalesce(p.username, 'Collectionneur') as seller_username,
    l.seller_id = auth.uid() as mine,
    coalesce(
      (
        select array_agg(g.slug order by g.slug)
          from public.card_genres cg
          join public.genres g on g.id = cg.genre_id
         where cg.card_id = l.card_id
      ),
      '{}'::text[]
    ) as genres,
    l.expires_at,
    l.cancel_reason
  from public.market_listings l
  join public.profiles p on p.id = l.seller_id
  where (
      l.status = 'active'
      and (l.expires_at is null or l.expires_at > now())
    )
    or l.seller_id = auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.market_listings() from public;
revoke all on function public.market_listings() from anon;
grant execute on function public.market_listings() to authenticated;

-- ————— Tables (après les fonctions qui les lisent) —————
drop table if exists public.frame_eval_queue;
drop table if exists public.frame_audit;
drop table if exists public.frame_pending;
drop table if exists public.frame_settings;
drop table if exists public.user_frames;

-- ————— Profils : retour à `frame` —————
alter table public.profiles drop column if exists last_seen_at;
alter table public.profiles drop column if exists frames_evaluated_at;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'selected_frame_id'
  ) then
    -- L'alias généré doit partir avant de renommer la vraie colonne.
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'frame'
    ) then
      alter table public.profiles drop column frame;
    end if;

    update public.profiles set selected_frame_id = 'steel' where selected_frame_id is null;
    alter table public.profiles rename column selected_frame_id to frame;
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'frame'
  ) then
    alter table public.profiles alter column frame set default 'steel';
    alter table public.profiles alter column frame set not null;
  end if;
end;
$$;
