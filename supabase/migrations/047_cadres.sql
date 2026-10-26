-- ============================================================
--  Migration 047 — CADRES D'AVATAR (refonte)
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Remplace l'ancien système (10 / 25 personnages, une Légendaire, une
--  Mythique) par des seuils relatifs évalués sur le catalogue ACTIF.
--  Les anciens déblocages ne sont PAS conservés : le recalcul initial est
--  lancé par `npm run db:frames`, qui applique la configuration TypeScript
--  (`src/lib/frames.config.ts`).
--
--  Principes :
--    • user_frames porte les déblocages permanents, avec unicité ;
--    • les seuils ne sont pas en base : elles sont évaluées côté serveur sur
--      des compteurs agrégés (`frame_stats`), puis appliquées atomiquement
--      (`frame_apply`) ;
--    • les acquisitions (collection, marchés, échanges, ouvertures,
--      parrainages payés, connexions) alimentent une file d'évaluation ;
--    • la tâche planifiée `/api/cron/frames` traite la file et recalcule tous
--      les joueurs une fois par jour.
--
--  Rollback : 047_cadres.down.sql.
-- ============================================================

-- ————— 1. Profil : sélection, dernière connexion, dernière évaluation —————
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'frame'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'selected_frame_id'
  ) then
    alter table public.profiles rename column frame to selected_frame_id;
  end if;
end;
$$;

alter table public.profiles
  add column if not exists selected_frame_id text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists frames_evaluated_at timestamptz;

alter table public.profiles alter column selected_frame_id drop default;
alter table public.profiles alter column selected_frame_id drop not null;

-- L'ancien code (interface, classement, chat, échanges) lit encore `frame` :
-- un alias généré évite de réécrire les fonctions SQL existantes. La valeur
-- qui fait foi est `selected_frame_id`.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'frame'
  ) then
    alter table public.profiles
      add column frame text generated always as (selected_frame_id) stored;
  end if;
end;
$$;

comment on column public.profiles.selected_frame_id is
  'Cadre équipé ; NULL = aucun choix explicite (repli sur le meilleur cadre débloqué).';
comment on column public.profiles.last_seen_at is
  'Dernière connexion connue, utilisée par les cadres d''activité.';

-- ————— 2. Tables des cadres —————
create table if not exists public.user_frames (
  user_id uuid not null references public.profiles (id) on delete cascade,
  frame_id text not null,
  unlocked_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id) on delete set null,
  reason text,
  primary key (user_id, frame_id)
);

create index if not exists user_frames_frame_idx
  on public.user_frames (frame_id, unlocked_at desc);

create table if not exists public.frame_settings (
  frame_id text primary key,
  active boolean not null default true,
  reason text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.frame_pending (
  user_id uuid not null references public.profiles (id) on delete cascade,
  frame_id text not null,
  first_met_at timestamptz not null default now(),
  primary key (user_id, frame_id)
);

create table if not exists public.frame_audit (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  frame_id text,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists frame_audit_created_idx
  on public.frame_audit (created_at desc);

create table if not exists public.frame_eval_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now()
);

alter table public.user_frames enable row level security;
alter table public.frame_settings enable row level security;
alter table public.frame_pending enable row level security;
alter table public.frame_audit enable row level security;
alter table public.frame_eval_queue enable row level security;

-- Aucun accès direct : tout passe par les fonctions `security definer`.
revoke all on public.user_frames from anon, authenticated;
revoke all on public.frame_settings from anon, authenticated;
revoke all on public.frame_pending from anon, authenticated;
revoke all on public.frame_audit from anon, authenticated;
revoke all on public.frame_eval_queue from anon, authenticated;

-- Acier pour tout le monde. Le déblocage est permanent.
insert into public.user_frames (user_id, frame_id)
select p.id, 'steel' from public.profiles p
on conflict (user_id, frame_id) do nothing;

-- ————— 3. File d'évaluation et triggers d'acquisition —————
create or replace function public.frame_enqueue(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.frame_eval_queue as q (user_id)
  values (p_user_id)
  on conflict (user_id) do update set requested_at = now();
$$;

revoke all on function public.frame_enqueue(uuid) from public;
revoke all on function public.frame_enqueue(uuid) from anon, authenticated;

create or replace function public.frame_default_on_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_frames (user_id, frame_id)
  values (new.id, 'steel')
  on conflict (user_id, frame_id) do nothing;

  update public.profiles
     set selected_frame_id = 'steel'
   where id = new.id and selected_frame_id is null;

  perform public.frame_enqueue(new.id);
  return new;
end;
$$;

revoke all on function public.frame_default_on_profile() from public;
revoke all on function public.frame_default_on_profile() from anon, authenticated;

drop trigger if exists profiles_frames_default on public.profiles;
create trigger profiles_frames_default
  after insert on public.profiles
  for each row execute function public.frame_default_on_profile();

create or replace function public.frame_queue_collection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.frame_enqueue(old.user_id);
    return old;
  end if;

  perform public.frame_enqueue(new.user_id);
  return new;
end;
$$;

revoke all on function public.frame_queue_collection() from public;
revoke all on function public.frame_queue_collection() from anon, authenticated;

drop trigger if exists collection_frames_queue on public.collection;
create trigger collection_frames_queue
  after insert or update or delete on public.collection
  for each row execute function public.frame_queue_collection();

create or replace function public.frame_queue_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.frame_enqueue(new.buyer_id);
  perform public.frame_enqueue(new.seller_id);
  return new;
end;
$$;

revoke all on function public.frame_queue_trade() from public;
revoke all on function public.frame_queue_trade() from anon, authenticated;

drop trigger if exists trades_frames_queue on public.trades;
create trigger trades_frames_queue
  after insert on public.trades
  for each row execute function public.frame_queue_trade();

create or replace function public.frame_queue_opening()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.frame_enqueue(new.user_id);
  return new;
end;
$$;

revoke all on function public.frame_queue_opening() from public;
revoke all on function public.frame_queue_opening() from anon, authenticated;

drop trigger if exists booster_openings_frames_queue on public.booster_openings;
create trigger booster_openings_frames_queue
  after insert on public.booster_openings
  for each row execute function public.frame_queue_opening();

create or replace function public.frame_queue_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'paye' then
      perform public.frame_enqueue(new.referrer_id);
      perform public.frame_enqueue(new.referred_id);
    end if;
    return new;
  end if;

  if new.status = 'paye' and old.status is distinct from 'paye' then
    perform public.frame_enqueue(new.referrer_id);
    perform public.frame_enqueue(new.referred_id);
  end if;

  return new;
end;
$$;

revoke all on function public.frame_queue_referral() from public;
revoke all on function public.frame_queue_referral() from anon, authenticated;

drop trigger if exists referrals_frames_queue on public.referrals;
create trigger referrals_frames_queue
  after insert or update of status on public.referrals
  for each row execute function public.frame_queue_referral();

-- ————— 4. Connexion du jour : dernière visite + file —————
create or replace function public.record_activity_day()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_created integer := 0;
begin
  if v_uid is null then
    return;
  end if;

  insert into public.profile_activity_days (user_id, day)
  values (v_uid, (now() at time zone 'utc')::date)
  on conflict (user_id, day) do nothing;
  get diagnostics v_created = row_count;

  -- Une seule écriture et une seule mise en file par jour : les visites
  -- suivantes ne font rien, plutôt que d'écrire le profil à chaque page.
  if v_created > 0 then
    update public.profiles set last_seen_at = now() where id = v_uid;
    perform public.frame_enqueue(v_uid);
  end if;
end;
$$;

revoke all on function public.record_activity_day() from public;
revoke all on function public.record_activity_day() from anon;
grant execute on function public.record_activity_day() to authenticated;

-- ————— 5. Notifications : nouveau type + référence de cadre —————
alter table public.notifications
  add column if not exists frame_id text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing',
    'swap_offer', 'swap_accepted', 'swap_declined', 'swap_expired',
    'listing_cancelled', 'order_cancelled',
    'referral_milestone', 'referral_pending', 'referral_paid', 'referral_refused',
    'frame_unlocked'
  ));

-- ————— 6. Statistiques agrégées (une requête par joueur) —————
-- Aucune collection n'est chargée : la base compte les personnages ACTIFS
-- distincts, par rareté, par genre et par franchise.
create or replace function public.frame_stats(p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_uid uuid := p_user_id;
  v_profile public.profiles%rowtype;
  v_total integer := 0;
  v_owned integer := 0;
  v_rarity_ur jsonb;
  v_rarity_l jsonb;
  v_genres jsonb := '{}'::jsonb;
  v_franchises jsonb := '[]'::jsonb;
  v_sales integer := 0;
  v_referrals integer := 0;
  v_boosters integer := 0;
  v_streak integer := 0;
  v_day date;
  v_unlocked jsonb := '[]'::jsonb;
  v_pending jsonb := '[]'::jsonb;
  v_disabled jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    v_uid := v_caller;
  end if;

  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_caller is not null
     and v_caller <> v_uid
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object(
      'totalActive', 0, 'ownedDistinct', 0,
      'rarities', jsonb_build_object(
        'UR', jsonb_build_object('total', 0, 'owned', 0),
        'L', jsonb_build_object('total', 0, 'owned', 0)
      ),
      'genres', '{}'::jsonb, 'franchises', '[]'::jsonb,
      'sales', 0, 'referralsPaid', 0, 'boostersOpened', 0, 'streakDays', 0,
      'createdAt', now(), 'lastSeenAt', null, 'selectedFrameId', null,
      'unlocked', '[]'::jsonb, 'pending', '[]'::jsonb, 'disabled', '[]'::jsonb
    );
  end if;

  select count(*) into v_total from public.playable_cards;

  select count(distinct c.card_id) into v_owned
    from public.collection c
    join public.playable_cards p on p.id = c.card_id
   where c.user_id = v_uid;

  v_rarity_ur := jsonb_build_object(
    'total', (select count(*) from public.playable_cards where rarity = 'UR'),
    'owned', (
      select count(distinct c.card_id)
        from public.collection c
        join public.playable_cards p on p.id = c.card_id
       where c.user_id = v_uid and p.rarity = 'UR'
    )
  );

  v_rarity_l := jsonb_build_object(
    'total', (select count(*) from public.playable_cards where rarity = 'L'),
    'owned', (
      select count(distinct c.card_id)
        from public.collection c
        join public.playable_cards p on p.id = c.card_id
       where c.user_id = v_uid and p.rarity = 'L'
    )
  );

  select coalesce(jsonb_object_agg(
    g.slug,
    jsonb_build_object(
      'total', coalesce(t.total, 0),
      'owned', coalesce(t.owned, 0)
    )
  ), '{}'::jsonb)
  into v_genres
  from public.genres g
  left join (
    select cg.genre_id,
           count(*)::int as total,
           count(*) filter (where c.user_id = v_uid)::int as owned
      from public.card_genres cg
      join public.playable_cards pc on pc.id = cg.card_id
      left join public.collection c on c.card_id = pc.id and c.user_id = v_uid
     group by cg.genre_id
  ) t on t.genre_id = g.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', f.slug,
    'name', f.name,
    'total', t.total,
    'owned', t.owned
  ) order by f.name), '[]'::jsonb)
  into v_franchises
  from (
    select pc.franchise_id,
           count(*)::int as total,
           count(*) filter (where c.user_id = v_uid)::int as owned
      from public.playable_cards pc
      left join public.collection c on c.card_id = pc.id and c.user_id = v_uid
     group by pc.franchise_id
  ) t
  join public.franchises f on f.id = t.franchise_id;

  select count(*) into v_sales
    from public.trades where seller_id = v_uid;

  select count(*) into v_referrals
    from public.referrals
   where referrer_id = v_uid and status = 'paye';

  select greatest(
    coalesce(v_profile.boosters_opened, 0),
    coalesce((select sum(o.count) from public.booster_openings o where o.user_id = v_uid), 0)
  ) into v_boosters;

  -- Série de jours consécutifs, terminée aujourd'hui ou hier.
  v_day := (now() at time zone 'utc')::date;
  if not exists (
    select 1 from public.profile_activity_days d
     where d.user_id = v_uid and d.day = v_day
  ) then
    v_day := v_day - 1;
  end if;

  while v_streak < 3700 and exists (
    select 1 from public.profile_activity_days d
     where d.user_id = v_uid and d.day = v_day
  ) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'frameId', u.frame_id,
    'unlockedAt', u.unlocked_at
  ) order by u.unlocked_at desc), '[]'::jsonb)
  into v_unlocked
  from public.user_frames u
  where u.user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'frameId', p.frame_id,
    'firstMetAt', p.first_met_at
  ) order by p.first_met_at), '[]'::jsonb)
  into v_pending
  from public.frame_pending p
  where p.user_id = v_uid;

  select coalesce(jsonb_agg(s.frame_id), '[]'::jsonb)
  into v_disabled
  from public.frame_settings s
  where s.active = false;

  return jsonb_build_object(
    'totalActive', v_total,
    'ownedDistinct', v_owned,
    'rarities', jsonb_build_object('UR', v_rarity_ur, 'L', v_rarity_l),
    'genres', v_genres,
    'franchises', v_franchises,
    'sales', v_sales,
    'referralsPaid', v_referrals,
    'boostersOpened', v_boosters,
    'streakDays', v_streak,
    'createdAt', v_profile.created_at,
    'lastSeenAt', v_profile.last_seen_at,
    'selectedFrameId', v_profile.selected_frame_id,
    'unlocked', v_unlocked,
    'pending', v_pending,
    'disabled', v_disabled
  );
end;
$$;

revoke all on function public.frame_stats(uuid) from public;
revoke all on function public.frame_stats(uuid) from anon;
grant execute on function public.frame_stats(uuid) to authenticated;
grant execute on function public.frame_stats(uuid) to service_role;

-- ————— 7. Application atomique des déblocages —————
-- Réservée au serveur : un joueur ne peut pas s'attribuer un cadre depuis la
-- console. L'insertion avec contrainte d'unicité rend l'opération idempotente
-- même sous évaluations simultanées.
create or replace function public.frame_apply(
  p_user_id uuid,
  p_unlock jsonb default '[]'::jsonb,
  p_pending_add text[] default '{}'::text[],
  p_pending_remove text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_id text;
  v_new jsonb := '[]'::jsonb;
  v_pending text;
begin
  if p_user_id is null then
    raise exception 'missing_user' using errcode = '22023';
  end if;

  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_row in
    select *
      from jsonb_to_recordset(coalesce(p_unlock, '[]'::jsonb))
        as x(id text, name text)
  loop
    v_id := null;
    insert into public.user_frames (user_id, frame_id)
    values (p_user_id, v_row.id)
    on conflict (user_id, frame_id) do nothing
    returning frame_id into v_id;

    if v_id is not null then
      insert into public.notifications (user_id, kind, message, frame_id)
      values (
        p_user_id,
        'frame_unlocked',
        'Nouveau cadre débloqué : ' || coalesce(nullif(v_row.name, ''), v_row.id),
        v_id
      );
      v_new := v_new || jsonb_build_array(v_id);
    end if;
  end loop;

  foreach v_pending in array coalesce(p_pending_remove, '{}'::text[]) loop
    delete from public.frame_pending
     where user_id = p_user_id and frame_id = v_pending;
  end loop;

  foreach v_pending in array coalesce(p_pending_add, '{}'::text[]) loop
    insert into public.frame_pending (user_id, frame_id)
    values (p_user_id, v_pending)
    on conflict (user_id, frame_id) do nothing;
  end loop;

  delete from public.frame_eval_queue where user_id = p_user_id;

  update public.profiles
     set frames_evaluated_at = now()
   where id = p_user_id;

  return v_new;
end;
$$;

revoke all on function public.frame_apply(uuid, jsonb, text[], text[]) from public;
revoke all on function public.frame_apply(uuid, jsonb, text[], text[]) from anon, authenticated;
grant execute on function public.frame_apply(uuid, jsonb, text[], text[]) to service_role;

-- ————— 8. Sélection : plus jamais de cadre invalide —————
-- Le serveur envoie le meilleur cadre débloqué ; la fonction se replie elle
-- aussi sur un cadre acquis plutôt que de lever une erreur.
create or replace function public.set_profile_style(p_avatar_card_id text, p_frame text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_frame text := nullif(btrim(coalesce(p_frame, '')), '');
  v_avatar text := nullif(btrim(p_avatar_card_id), '');
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

  if v_frame is null then
    v_frame := 'steel';
  end if;

  if not exists (
    select 1 from public.user_frames u
     where u.user_id = v_uid and u.frame_id = v_frame
  ) then
    select u.frame_id into v_frame
      from public.user_frames u
     where u.user_id = v_uid
     order by u.unlocked_at desc, u.frame_id
     limit 1;
  end if;

  if v_frame is null then
    insert into public.user_frames (user_id, frame_id)
    values (v_uid, 'steel')
    on conflict (user_id, frame_id) do nothing;
    v_frame := 'steel';
  end if;

  update public.profiles
     set avatar_card_id = v_avatar,
         selected_frame_id = v_frame
   where id = v_uid;

  return jsonb_build_object('avatar', v_avatar, 'frame', v_frame);
end;
$$;

revoke all on function public.set_profile_style(text, text) from public;
revoke all on function public.set_profile_style(text, text) from anon;
grant execute on function public.set_profile_style(text, text) to authenticated;

-- ————— 9. Marché : avatar et cadre du vendeur, en une requête groupée —————
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
  seller_avatar_card_id text,
  seller_frame text,
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
    p.avatar_card_id,
    coalesce(p.selected_frame_id, 'steel'),
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

-- ————— 8 bis. Un ban retire les cadres —————
-- Les cadres sont permanents sauf suspension du compte : la remise en état
-- repart de l'Acier, puis les seuils recalculés. Le journal garde la trace.
create or replace function public.frame_clear_on_ban()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.suspended_at is not null and old.suspended_at is null then
    delete from public.user_frames where user_id = new.id;
    delete from public.frame_pending where user_id = new.id;

    update public.profiles
       set selected_frame_id = null
     where id = new.id;

    insert into public.frame_audit (user_id, action, reason)
    values (new.id, 'frames_cleared_ban', 'suspended_at');
  end if;

  return new;
end;
$$;

revoke all on function public.frame_clear_on_ban() from public;
revoke all on function public.frame_clear_on_ban() from anon, authenticated;

drop trigger if exists profiles_frames_ban on public.profiles;
create trigger profiles_frames_ban
  after update of suspended_at on public.profiles
  for each row execute function public.frame_clear_on_ban();

-- ————— 9 bis. Files de la tâche planifiée —————
-- Le cron serveur lit les identifiants via ces deux fonctions, sans accès
-- direct aux tables. `frame_apply` retire ensuite l'utilisateur de la file.
create or replace function public.frame_queue_list(p_limit integer default 200)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select q.user_id
      from public.frame_eval_queue q
     order by q.requested_at
     limit least(1000, greatest(1, coalesce(p_limit, 200)));
end;
$$;

revoke all on function public.frame_queue_list(integer) from public;
revoke all on function public.frame_queue_list(integer) from anon, authenticated;
grant execute on function public.frame_queue_list(integer) to service_role;

create or replace function public.frame_sweep_list(p_limit integer default 300)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select p.id
      from public.profiles p
     order by p.frames_evaluated_at nulls first, p.last_seen_at nulls last, p.created_at
     limit least(2000, greatest(1, coalesce(p_limit, 300)));
end;
$$;

revoke all on function public.frame_sweep_list(integer) from public;
revoke all on function public.frame_sweep_list(integer) from anon, authenticated;
grant execute on function public.frame_sweep_list(integer) to service_role;

-- ————— 9 ter. Avatars des filleuls (une seule requête groupée) —————
create or replace function public.referral_referred_avatars()
returns table (referral_id bigint, avatar_card_id text, frame text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.avatar_card_id, coalesce(p.selected_frame_id, 'steel')
    from public.referrals r
    join public.profiles p on p.id = r.referred_id
   where r.referrer_id = auth.uid();
$$;

revoke all on function public.referral_referred_avatars() from public;
revoke all on function public.referral_referred_avatars() from anon;
grant execute on function public.referral_referred_avatars() to authenticated;

-- ————— 10. Administration —————
create or replace function public.frame_admin_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_overrides jsonb := '{}'::jsonb;
  v_audit jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_object_agg(s.frame_id, s.count), '{}'::jsonb)
  into v_counts
  from (
    select frame_id, count(*)::int as count
      from public.user_frames
     group by frame_id
  ) s;

  select coalesce(jsonb_object_agg(
    s.frame_id,
    jsonb_build_object('active', s.active, 'reason', s.reason)
  ), '{}'::jsonb)
  into v_overrides
  from public.frame_settings s;

  select coalesce(jsonb_agg(jsonb_build_object(
    'at', a.created_at,
    'action', a.action,
    'frameId', a.frame_id,
    'reason', a.reason,
    'actor', pa.username,
    'username', pu.username
  ) order by a.created_at desc), '[]'::jsonb)
  into v_audit
  from (
    select * from public.frame_audit order by created_at desc limit 30
  ) a
  left join public.profiles pa on pa.id = a.actor_id
  left join public.profiles pu on pu.id = a.user_id;

  return jsonb_build_object(
    'totalPlayers', (select count(*) from public.profiles),
    'queued', (select count(*) from public.frame_eval_queue),
    'counts', v_counts,
    'overrides', v_overrides,
    'audit', v_audit
  );
end;
$$;

revoke all on function public.frame_admin_report() from public;
revoke all on function public.frame_admin_report() from anon;
grant execute on function public.frame_admin_report() to authenticated;

create or replace function public.frame_admin_set_active(
  p_frame_id text,
  p_active boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_frame text := nullif(btrim(coalesce(p_frame_id, '')), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_frame is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_frame');
  end if;

  insert into public.frame_settings as s (frame_id, active, reason, updated_by, updated_at)
  values (v_frame, coalesce(p_active, true), nullif(btrim(coalesce(p_reason, '')), ''), v_uid, now())
  on conflict (frame_id) do update
    set active = excluded.active,
        reason = excluded.reason,
        updated_by = v_uid,
        updated_at = now();

  if p_active = false then
    update public.profiles
       set selected_frame_id = null
     where selected_frame_id = v_frame;
  end if;

  insert into public.frame_audit (frame_id, actor_id, action, reason)
  values (
    v_frame,
    v_uid,
    case when coalesce(p_active, true) then 'frame_activated' else 'frame_deactivated' end,
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.frame_admin_set_active(text, boolean, text) from public;
revoke all on function public.frame_admin_set_active(text, boolean, text) from anon;
grant execute on function public.frame_admin_set_active(text, boolean, text) to authenticated;

create or replace function public.frame_admin_assign(
  p_username text,
  p_frame_id text,
  p_reason text default null,
  p_frame_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_frame text := nullif(btrim(coalesce(p_frame_id, '')), '');
  v_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_frame is null or nullif(btrim(coalesce(p_username, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  select * into v_target
    from public.profiles
   where lower(username) = lower(btrim(p_username))
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_player');
  end if;

  insert into public.user_frames (user_id, frame_id, granted_by, reason)
  values (v_target.id, v_frame, v_uid, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (user_id, frame_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into public.notifications (user_id, kind, message, frame_id)
    values (
      v_target.id,
      'frame_unlocked',
      'Cadre attribué : ' || coalesce(nullif(btrim(p_frame_name), ''), v_frame),
      v_frame
    );

    insert into public.frame_audit (user_id, frame_id, actor_id, action, reason)
    values (v_target.id, v_frame, v_uid, 'frame_granted', nullif(btrim(coalesce(p_reason, '')), ''));
  end if;

  return jsonb_build_object('ok', true, 'inserted', v_rows > 0);
end;
$$;

revoke all on function public.frame_admin_assign(text, text, text, text) from public;
revoke all on function public.frame_admin_assign(text, text, text, text) from anon;
grant execute on function public.frame_admin_assign(text, text, text, text) to authenticated;

create or replace function public.frame_admin_remove(
  p_username text,
  p_frame_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_frame text := nullif(btrim(coalesce(p_frame_id, '')), '');
  v_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_frame is null or nullif(btrim(coalesce(p_username, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  select * into v_target
    from public.profiles
   where lower(username) = lower(btrim(p_username))
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_player');
  end if;

  if v_frame = 'steel' then
    return jsonb_build_object('ok', false, 'reason', 'default_frame');
  end if;

  delete from public.user_frames
   where user_id = v_target.id and frame_id = v_frame;

  get diagnostics v_rows = row_count;

  update public.profiles
     set selected_frame_id = null
   where id = v_target.id and selected_frame_id = v_frame;

  if v_rows > 0 then
    insert into public.frame_audit (user_id, frame_id, actor_id, action, reason)
    values (v_target.id, v_frame, v_uid, 'frame_removed', nullif(btrim(coalesce(p_reason, '')), ''));
  end if;

  return jsonb_build_object('ok', true, 'removed', v_rows > 0);
end;
$$;

revoke all on function public.frame_admin_remove(text, text, text) from public;
revoke all on function public.frame_admin_remove(text, text, text) from anon;
grant execute on function public.frame_admin_remove(text, text, text) to authenticated;

create or replace function public.frame_admin_queue_all()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.frame_eval_queue as q (user_id)
  select p.id from public.profiles p
  on conflict (user_id) do update set requested_at = now();

  get diagnostics v_rows = row_count;

  insert into public.frame_audit (actor_id, action, details)
  values (v_uid, 'frame_queue_all', jsonb_build_object('players', v_rows));

  return jsonb_build_object('ok', true, 'queued', v_rows);
end;
$$;

revoke all on function public.frame_admin_queue_all() from public;
revoke all on function public.frame_admin_queue_all() from anon;
grant execute on function public.frame_admin_queue_all() to authenticated;

-- ————— 11. Contrôles —————
do $$
declare
  v_profiles integer;
  v_steel integer;
begin
  select count(*) into v_profiles from public.profiles;
  select count(*) into v_steel from public.user_frames where frame_id = 'steel';

  if v_steel < v_profiles then
    raise exception 'cadres : % profils mais seulement % Acier', v_profiles, v_steel;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'frame'
  ) then
    raise exception 'cadres : alias profiles.frame absent';
  end if;

  raise notice 'cadres : % profils, % Acier, % en file d''évaluation',
    v_profiles, v_steel, (select count(*) from public.frame_eval_queue);
end;
$$;
