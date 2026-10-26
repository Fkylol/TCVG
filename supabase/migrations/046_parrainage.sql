-- ============================================================
--  Migration 046 — PARRAINAGE
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Un joueur invite un ami par un lien /invite/<code>. Quand le filleul a
--  ouvert 20 boosters (journal serveur `booster_openings`), les deux reçoivent
--  3 boosters bonus. Avec l'A2F Discord confirmée, le paiement est immédiat ;
--  sinon il attend 7 jours (voie différée), avec revérification des conditions
--  au moment du paiement.
--
--  Tout est additif :
--    • nouvelles colonnes sur `profiles` (code, bonus, A2F, empreintes) ;
--    • nouvelles tables `referrals`, `booster_grants`, `booster_openings`,
--      `profile_activity_days`, `referral_audit`, `referral_rate_limits` ;
--    • `open_pack()` devient une enveloppe autour de `_open_pack_stock()` qui
--      consomme le stock normal PUIS le bonus, journalise l'ouverture et
--      évalue le parrainage du joueur.
--
--  Aucune donnée existante n'est supprimée. Rollback : 046_parrainage.down.sql.
-- ============================================================

-- ————— 1. Profils : code, bonus, A2F, empreintes, suspension —————
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists bonus_boosters integer not null default 0,
  add column if not exists discord_mfa_enabled boolean,
  add column if not exists discord_mfa_checked_at timestamptz,
  add column if not exists ip_hash text,
  add column if not exists ip_hash_at timestamptz,
  add column if not exists ua_hash text,
  add column if not exists ua_hash_at timestamptz,
  add column if not exists suspended_at timestamptz;

alter table public.profiles drop constraint if exists profiles_bonus_boosters_check;
alter table public.profiles
  add constraint profiles_bonus_boosters_check check (bonus_boosters >= 0);

create index if not exists profiles_ip_hash_idx
  on public.profiles (ip_hash) where ip_hash is not null;

comment on column public.profiles.bonus_boosters is
  'Boosters offerts (parrainage) : hors plafond de stock, sans expiration.';
comment on column public.profiles.ip_hash is
  'Empreinte salée anonyme de l''IP de connexion, purgée après 90 jours.';
comment on column public.profiles.suspended_at is
  'Compte suspendu par un administrateur : bloque les paiements de parrainage.';

-- ————— 2. Code de parrainage —————
-- 8 caractères tirés au hasard dans un alphabet sans ambiguïté (32^8 = 40 bits).
create or replace function public.random_referral_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_index integer;
begin
  for v_index in 1..8 loop
    v_code := v_code || substr(
      v_alphabet,
      1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(v_alphabet)),
      1
    );
  end loop;
  return v_code;
end;
$$;

revoke all on function public.random_referral_code() from public;
revoke all on function public.random_referral_code() from anon, authenticated;

create or replace function public.ensure_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if new.referral_code is not null and new.referral_code <> '' then
    return new;
  end if;

  loop
    v_code := public.random_referral_code();
    exit when not exists (
      select 1 from public.profiles p where p.referral_code = v_code
    );
  end loop;

  new.referral_code := v_code;
  return new;
end;
$$;

drop trigger if exists profiles_referral_code on public.profiles;
create trigger profiles_referral_code
  before insert on public.profiles
  for each row execute function public.ensure_referral_code();

-- Reprise des comptes existants (aucune collision possible : index créé après).
do $$
declare
  v_row record;
  v_code text;
begin
  for v_row in select id from public.profiles where referral_code is null loop
    loop
      v_code := public.random_referral_code();
      exit when not exists (
        select 1 from public.profiles p where p.referral_code = v_code
      );
    end loop;

    update public.profiles set referral_code = v_code where id = v_row.id;
  end loop;
end;
$$;

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);

-- ————— 3. Tables du parrainage —————
create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  referrer_discord_id text,
  referred_discord_id text,
  created_at timestamptz not null default now(),
  milestone_reached_at timestamptz,
  status text not null default 'en_cours'
    check (status in ('en_cours', 'eligible', 'en_attente', 'a_examiner', 'paye', 'refuse')),
  eligible_at timestamptz,
  paid_at timestamptz,
  refused_reason text,
  path text check (path in ('immediat', 'differe')),
  flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint referrals_no_self check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_id, created_at desc);
create index if not exists referrals_status_idx
  on public.referrals (status, eligible_at);

create table if not exists public.booster_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null check (reason in ('parrain', 'filleul')),
  referral_id bigint not null references public.referrals (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Un parrainage ne peut payer qu'une fois chaque côté.
  unique (user_id, reason, referral_id)
);

create index if not exists booster_grants_user_idx
  on public.booster_grants (user_id, created_at desc);

create table if not exists public.booster_openings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pack_slug text,
  count integer not null default 1 check (count between 1 and 10),
  opened_at timestamptz not null default now()
);

create index if not exists booster_openings_user_idx
  on public.booster_openings (user_id, opened_at desc);

create table if not exists public.profile_activity_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

create table if not exists public.referral_audit (
  id bigint generated always as identity primary key,
  referral_id bigint references public.referrals (id) on delete cascade,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_audit_referral_idx
  on public.referral_audit (referral_id, created_at desc);

create table if not exists public.referral_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

alter table public.referrals enable row level security;
alter table public.booster_grants enable row level security;
alter table public.booster_openings enable row level security;
alter table public.profile_activity_days enable row level security;
alter table public.referral_audit enable row level security;
alter table public.referral_rate_limits enable row level security;

-- Aucun accès direct : les pages passent par des fonctions `security definer`
-- qui ne renvoient que les champs utiles. Le journal d'ouvertures et les
-- empreintes restent invisibles, même pour leur propriétaire.
revoke all on public.referrals from anon, authenticated;
revoke all on public.booster_grants from anon, authenticated;
revoke all on public.booster_openings from anon, authenticated;
revoke all on public.profile_activity_days from anon, authenticated;
revoke all on public.referral_audit from anon, authenticated;
revoke all on public.referral_rate_limits from anon, authenticated;

-- ————— 4. Notifications : nouveaux types + message libre —————
alter table public.notifications
  add column if not exists referral_id bigint references public.referrals (id) on delete set null,
  add column if not exists message text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing',
    'swap_offer', 'swap_accepted', 'swap_declined', 'swap_expired',
    'listing_cancelled', 'order_cancelled',
    'referral_milestone', 'referral_pending', 'referral_paid', 'referral_refused'
  ));

-- ————— 5. Configuration côté base (miroir de src/lib/referral/config.ts) —————
create or replace function public.referral_config()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'reward_boosters', 3,
    'required_openings', 20,
    'delay_days', 7,
    'max_paid_per_referrer', 20,
    'max_pending_per_referrer', 50,
    'active_days_required_delayed', 3,
    'discord_min_account_age_days', 0,
    'fingerprint_retention_days', 90,
    'same_ip_review_threshold', 3,
    'signup_burst_threshold', 5,
    'signup_burst_window_hours', 24,
    'new_account_window_minutes', 15
  );
$$;

revoke all on function public.referral_config() from public;
grant execute on function public.referral_config() to anon, authenticated;

-- ————— 6. Journal d'ouvertures —————
create or replace function public.referral_openings(p_user_id uuid, p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(o.count), 0)::int
    from public.booster_openings o
   where o.user_id = p_user_id
     and o.opened_at >= p_since;
$$;

revoke all on function public.referral_openings(uuid, timestamptz) from public;
revoke all on function public.referral_openings(uuid, timestamptz) from anon, authenticated;

-- ————— 7. Aides internes —————
-- Toutes les fonctions ci-dessous sont révoquées ensuite : seul le propriétaire
-- (les fonctions `security definer`) peut les appeler, jamais un joueur.
create or replace function public._referral_log(
  p_referral_id bigint,
  p_actor_id uuid,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.referral_audit (referral_id, actor_id, action, details)
  values (p_referral_id, p_actor_id, p_action, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public._referral_notify(
  p_user_id uuid,
  p_kind text,
  p_message text,
  p_referral_id bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, message, referral_id)
  values (p_user_id, p_kind, p_message, p_referral_id);
$$;

create or replace function public._refuse_referral(p_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref public.referrals%rowtype;
  v_referrer text;
  v_referred text;
  v_why text;
begin
  select * into v_ref from public.referrals where id = p_id for update;
  if not found or v_ref.status in ('paye', 'refuse') then
    return;
  end if;

  -- Raison affichable : jamais un signal anti-fraude, seulement un fait vérifiable.
  v_why := case p_reason
    when 'referrer_suspended' then 'le compte du parrain est suspendu'
    when 'referred_suspended' then 'le compte du filleul est suspendu'
    when 'discord_unlinked' then 'le compte Discord n''est plus lié'
    when 'discord_changed' then 'le compte Discord a changé'
    when 'active_days' then 'l''activité du filleul est restée insuffisante pendant l''attente'
    when 'paid_cap' then 'le plafond de parrainages payés est atteint'
    when 'admin' then 'l''invitation a été refusée par la modération'
    else 'les conditions ne sont plus réunies'
  end;

  update public.referrals
     set status = 'refuse',
         refused_reason = p_reason,
         updated_at = now()
   where id = p_id and status not in ('paye', 'refuse');

  select username into v_referrer from public.profiles where id = v_ref.referrer_id;
  select username into v_referred from public.profiles where id = v_ref.referred_id;

  perform public._referral_log(
    p_id, null, 'refused', jsonb_build_object('reason', p_reason)
  );

  -- Message volontairement générique : les signaux anti-fraude ne sortent pas.
  perform public._referral_notify(
    v_ref.referrer_id,
    'referral_refused',
    'Ton parrainage avec ' || coalesce(v_referred, 'un joueur') ||
      ' n''a pas abouti : ' || v_why || '. Aucun booster n''a été attribué.',
    p_id
  );
  perform public._referral_notify(
    v_ref.referred_id,
    'referral_refused',
    'Le parrainage avec ' || coalesce(v_referrer, 'ton parrain') ||
      ' n''a pas abouti : ' || v_why || '. Aucun booster n''a été attribué.',
    p_id
  );
end;
$$;

create or replace function public._pay_referral(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public.referral_config();
  v_reward integer := coalesce((v_cfg->>'reward_boosters')::int, 3);
  v_ref public.referrals%rowtype;
  v_referrer text;
  v_referred text;
  v_grant bigint;
begin
  -- Le changement de statut conditionnel est la garde d'idempotence : deux
  -- exécutions simultanées ne peuvent pas le gagner toutes les deux.
  update public.referrals
     set status = 'paye',
         paid_at = now(),
         updated_at = now()
   where id = p_id
     and status in ('eligible', 'en_attente', 'a_examiner')
  returning * into v_ref;

  if not found then
    return false;
  end if;

  insert into public.booster_grants (user_id, amount, reason, referral_id)
  values (v_ref.referrer_id, v_reward, 'parrain', p_id)
  on conflict (user_id, reason, referral_id) do nothing
  returning id into v_grant;

  if v_grant is not null then
    update public.profiles
       set bonus_boosters = bonus_boosters + v_reward
     where id = v_ref.referrer_id;
  end if;

  insert into public.booster_grants (user_id, amount, reason, referral_id)
  values (v_ref.referred_id, v_reward, 'filleul', p_id)
  on conflict (user_id, reason, referral_id) do nothing
  returning id into v_grant;

  if v_grant is not null then
    update public.profiles
       set bonus_boosters = bonus_boosters + v_reward
     where id = v_ref.referred_id;
  end if;

  select username into v_referrer from public.profiles where id = v_ref.referrer_id;
  select username into v_referred from public.profiles where id = v_ref.referred_id;

  perform public._referral_log(
    p_id, null, 'paid', jsonb_build_object('reward', v_reward)
  );

  perform public._referral_notify(
    v_ref.referrer_id,
    'referral_paid',
    'Parrainage réussi : ' || coalesce(v_referred, 'ton filleul') || ' a débloqué tes ' ||
      v_reward || ' boosters bonus.',
    p_id
  );
  perform public._referral_notify(
    v_ref.referred_id,
    'referral_paid',
    'Ton parrainage a abouti : ' || v_reward || ' boosters bonus crédités. Merci ' ||
      coalesce(v_referrer, 'à ton parrain') || ' !',
    p_id
  );

  return true;
end;
$$;

-- ————— 8. Vérification des empreintes et activité —————
-- Appelée par le serveur (service_role) au retour OAuth : l'empreinte ne peut
-- pas être déclarée par le navigateur.
create or replace function public.record_fingerprint(
  p_user_id uuid,
  p_ip_hash text,
  p_ua_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set ip_hash = coalesce(nullif(p_ip_hash, ''), ip_hash),
         ip_hash_at = case when nullif(p_ip_hash, '') is null then ip_hash_at else now() end,
         ua_hash = coalesce(nullif(p_ua_hash, ''), ua_hash),
         ua_hash_at = case when nullif(p_ua_hash, '') is null then ua_hash_at else now() end
   where id = p_user_id;
end;
$$;

revoke all on function public.record_fingerprint(uuid, text, text) from public;
revoke all on function public.record_fingerprint(uuid, text, text) from anon, authenticated;

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

-- ————— 9. Aperçu d'un code (page /invite) —————
create or replace function public.referral_preview(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_name text;
begin
  if length(v_code) <> 8 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select p.username into v_name
    from public.profiles p
   where p.referral_code = v_code
     and p.suspended_at is null;

  if v_name is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  return jsonb_build_object('ok', true, 'code', v_code, 'username', v_name);
end;
$$;

revoke all on function public.referral_preview(text) from public;
grant execute on function public.referral_preview(text) to anon, authenticated;

-- ————— 10. Limite de débit (fenêtre fixe, en base) —————
create or replace function public.referral_rate_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if p_key is null or p_key = '' or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.referral_rate_limits as l (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when l.window_start + make_interval(secs => p_window_seconds) <= now()
            then now()
          else l.window_start
        end,
        hits = case
          when l.window_start + make_interval(secs => p_window_seconds) <= now()
            then 1
          else l.hits + 1
        end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.referral_rate_hit(text, integer, integer) from public;
grant execute on function public.referral_rate_hit(text, integer, integer) to anon, authenticated;

-- ————— 11. Création du parrainage (première inscription) —————
create or replace function public.referral_create(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public.referral_config();
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_profile public.profiles%rowtype;
  v_referrer public.profiles%rowtype;
  v_referred_discord text;
  v_referrer_discord text;
  v_age_minutes numeric;
  v_active integer;
  v_recent integer;
  v_shared integer;
  v_same_ip boolean;
  v_flags jsonb := '{}'::jsonb;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if length(v_code) <> 8 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  if exists (select 1 from public.referrals where referred_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_referred');
  end if;

  v_age_minutes := extract(epoch from (now() - v_profile.created_at)) / 60;
  if v_age_minutes > coalesce((v_cfg->>'new_account_window_minutes')::int, 15) then
    return jsonb_build_object('ok', false, 'reason', 'not_new_account');
  end if;

  select * into v_referrer from public.profiles where referral_code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code');
  end if;


  if v_referrer.id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  if v_referrer.suspended_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'referrer_suspended');
  end if;

  select discord_id into v_referred_discord from public.discord_links where user_id = v_uid;
  select discord_id into v_referrer_discord from public.discord_links where user_id = v_referrer.id;

  if v_referred_discord is null or v_referrer_discord is null then
    return jsonb_build_object('ok', false, 'reason', 'discord_missing');
  end if;

  if v_referred_discord = v_referrer_discord then
    return jsonb_build_object('ok', false, 'reason', 'same_discord');
  end if;

  select count(*)::int into v_active
    from public.referrals
   where referrer_id = v_referrer.id
     and status in ('en_cours', 'eligible', 'en_attente', 'a_examiner');

  if v_active >= coalesce((v_cfg->>'max_pending_per_referrer')::int, 50) then
    perform public._referral_log(
      null,
      v_referrer.id,
      'pending_cap',
      jsonb_build_object('referred', v_uid)
    );
    return jsonb_build_object('ok', false, 'reason', 'pending_cap');
  end if;

  v_same_ip := v_profile.ip_hash is not null and v_profile.ip_hash = v_referrer.ip_hash;
  if v_same_ip then
    v_flags := v_flags || jsonb_build_object('same_ip', true);
  end if;

  -- Filleuls du même parrain partageant l'empreinte du nouveau compte.
  select count(*)::int into v_shared
    from public.referrals r
    join public.profiles p on p.id = r.referred_id
   where r.referrer_id = v_referrer.id
     and v_profile.ip_hash is not null
     and p.ip_hash = v_profile.ip_hash;

  if v_shared + 1 >= coalesce((v_cfg->>'same_ip_review_threshold')::int, 3) then
    v_flags := v_flags || jsonb_build_object('shared_ip_group', true);
  end if;

  select count(*)::int into v_recent
    from public.referrals
   where referrer_id = v_referrer.id
     and created_at > now() - make_interval(hours => coalesce((v_cfg->>'signup_burst_window_hours')::int, 24));

  if v_recent >= coalesce((v_cfg->>'signup_burst_threshold')::int, 5) then
    v_flags := v_flags || jsonb_build_object('signup_burst', true);
  end if;

  insert into public.referrals (
    referrer_id, referred_id, referrer_discord_id, referred_discord_id, flags
  )
  values (
    v_referrer.id, v_uid, v_referrer_discord, v_referred_discord, v_flags
  )
  returning id into v_id;

  perform public._referral_log(
    v_id, v_uid, 'created', jsonb_build_object('code', v_code, 'flags', v_flags)
  );

  return jsonb_build_object(
    'ok', true,
    'referral', v_id,
    'referrer', v_referrer.username,
    'flags', v_flags
  );
end;
$$;

revoke all on function public.referral_create(text) from public;
revoke all on function public.referral_create(text) from anon;
grant execute on function public.referral_create(text) to authenticated;

-- ————— 12. Évaluation unique et idempotente —————
create or replace function public.evaluate_referral(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public.referral_config();
  v_required integer := coalesce((v_cfg->>'required_openings')::int, 20);
  v_delay integer := coalesce((v_cfg->>'delay_days')::int, 7);
  v_max_paid integer := coalesce((v_cfg->>'max_paid_per_referrer')::int, 20);
  v_active_required integer := coalesce((v_cfg->>'active_days_required_delayed')::int, 3);
  v_min_age integer := coalesce((v_cfg->>'discord_min_account_age_days')::int, 0);

  v_ref public.referrals%rowtype;
  v_referrer public.profiles%rowtype;
  v_referred public.profiles%rowtype;
  v_openings integer;
  v_paid integer;
  v_milestone timestamptz;
  v_eligible timestamptz;
  v_flags jsonb;
  v_same_ip boolean;
  v_shared integer;
  v_recent integer;
  v_review boolean;
  v_discord text;
  v_discord_recent boolean := false;
  v_snowflake timestamptz;
  v_mfa boolean;
  v_active integer;
begin
  select * into v_ref from public.referrals where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if v_ref.status in ('paye', 'refuse') then
    return jsonb_build_object('ok', true, 'status', v_ref.status, 'skipped', true);
  end if;

  select * into v_referrer from public.profiles where id = v_ref.referrer_id;
  select * into v_referred from public.profiles where id = v_ref.referred_id;

  if v_referrer.id is null then
    perform public._refuse_referral(p_id, 'referrer_missing');
    return jsonb_build_object('ok', true, 'status', 'refuse');
  end if;

  if v_referred.id is null then
    perform public._refuse_referral(p_id, 'referred_missing');
    return jsonb_build_object('ok', true, 'status', 'refuse');
  end if;

  if v_referrer.suspended_at is not null then
    perform public._refuse_referral(p_id, 'referrer_suspended');
    return jsonb_build_object('ok', true, 'status', 'refuse');
  end if;

  if v_referred.suspended_at is not null then
    perform public._refuse_referral(p_id, 'referred_suspended');
    return jsonb_build_object('ok', true, 'status', 'refuse');
  end if;

  v_openings := public.referral_openings(v_ref.referred_id, v_ref.created_at);

  if v_openings < v_required then
    update public.referrals
       set status = 'en_cours', updated_at = now()
     where id = p_id and status <> 'en_cours';
    return jsonb_build_object('ok', true, 'status', 'en_cours', 'openings', v_openings);
  end if;

  -- Seuil atteint : horodaté une seule fois.
  if v_ref.milestone_reached_at is null then
    v_milestone := now();
    update public.referrals
       set milestone_reached_at = v_milestone,
           status = 'eligible',
           updated_at = now()
     where id = p_id;
    perform public._referral_log(
      p_id, null, 'milestone', jsonb_build_object('openings', v_openings)
    );
    perform public._referral_notify(
      v_ref.referrer_id,
      'referral_milestone',
      coalesce(v_referred.username, 'Ton filleul') || ' a atteint ' || v_required ||
        ' boosters ouverts. Vérification du parrainage en cours.',
      p_id
    );
    perform public._referral_notify(
      v_ref.referred_id,
      'referral_milestone',
      'Seuil atteint : ' || v_required || ' boosters ouverts. Vérification du parrainage en cours.',
      p_id
    );
  else
    v_milestone := v_ref.milestone_reached_at;
  end if;

  -- Compte Discord du filleul, toujours lié au même identifiant.
  select discord_id into v_discord from public.discord_links where user_id = v_ref.referred_id;
  if v_discord is null then
    perform public._refuse_referral(p_id, 'discord_unlinked');
    return jsonb_build_object('ok', true, 'status', 'refuse');
  end if;
  if v_ref.referred_discord_id is not null and v_discord <> v_ref.referred_discord_id then
    perform public._refuse_referral(p_id, 'discord_changed');
    return jsonb_build_object('ok', true, 'status', 'refuse');
  end if;

  select count(*)::int into v_paid
    from public.referrals
   where referrer_id = v_ref.referrer_id and status = 'paye';

  if v_paid >= v_max_paid then
    perform public._refuse_referral(p_id, 'paid_cap');
    return jsonb_build_object('ok', true, 'status', 'refuse');
  end if;

  -- Signaux de proximité : conservés, jamais effacés.
  v_flags := coalesce(v_ref.flags, '{}'::jsonb);
  v_same_ip := v_referrer.ip_hash is not null
    and coalesce(v_referred.ip_hash = v_referrer.ip_hash, false);
  if v_same_ip then
    v_flags := v_flags || jsonb_build_object('same_ip', true);
  end if;

  select count(*)::int into v_shared
    from public.referrals r
    join public.profiles p on p.id = r.referred_id
   where r.referrer_id = v_ref.referrer_id
     and r.id <> p_id
     and v_referred.ip_hash is not null
     and p.ip_hash = v_referred.ip_hash;

  if v_shared + 1 >= coalesce((v_cfg->>'same_ip_review_threshold')::int, 3) then
    v_flags := v_flags || jsonb_build_object('shared_ip_group', true);
  end if;

  select count(*)::int into v_recent
    from public.referrals
   where referrer_id = v_ref.referrer_id
     and created_at > now() - make_interval(hours => coalesce((v_cfg->>'signup_burst_window_hours')::int, 24));

  if v_recent > coalesce((v_cfg->>'signup_burst_threshold')::int, 5) then
    v_flags := v_flags || jsonb_build_object('signup_burst', true);
  end if;

  v_review := coalesce((v_flags->>'shared_ip_group')::boolean, false)
           or coalesce((v_flags->>'signup_burst')::boolean, false);

  if v_review then
    update public.referrals
       set status = 'a_examiner', flags = v_flags, updated_at = now()
     where id = p_id;
    perform public._referral_log(
      p_id, null, 'review', jsonb_build_object('flags', v_flags)
    );
    return jsonb_build_object('ok', true, 'status', 'a_examiner');
  end if;

  -- Voie : immédiate seulement si l'A2F est confirmée et rien ne force l'attente.
  if v_min_age > 0 and v_ref.referred_discord_id is not null then
    if v_ref.referred_discord_id ~ '^[0-9]{15,25}$' then
      v_snowflake := to_timestamp(
        (((v_ref.referred_discord_id::bigint >> 22) + 1420070400000) / 1000.0)::double precision
      );
      v_discord_recent := v_snowflake > now() - make_interval(days => v_min_age);
    else
      v_discord_recent := true;
    end if;
  end if;

  v_mfa := coalesce(v_referred.discord_mfa_enabled, false);
  v_eligible := v_milestone + make_interval(days => v_delay);

  -- A2F active (au seuil ou pendant l'attente), sans contrainte de proximité :
  -- paiement immédiat.
  if v_mfa and not v_same_ip and not v_discord_recent then
    update public.referrals
       set path = 'immediat',
           flags = v_flags,
           eligible_at = null,
           updated_at = now()
     where id = p_id;
    perform public._pay_referral(p_id);
    return jsonb_build_object('ok', true, 'status', 'paye', 'path', 'immediat');
  end if;

  if now() < v_eligible then
    if v_ref.status <> 'en_attente' then
      perform public._referral_log(
        p_id, null, 'pending',
        jsonb_build_object('eligible_at', v_eligible, 'flags', v_flags)
      );
      perform public._referral_notify(
        v_ref.referrer_id,
        'referral_pending',
        'Parrainage de ' || coalesce(v_referred.username, 'ton filleul') ||
          ' : les boosters arrivent le ' || to_char(v_eligible, 'DD/MM/YYYY') || '.',
        p_id
      );
      perform public._referral_notify(
        v_ref.referred_id,
        'referral_pending',
        'Tes boosters de parrainage arrivent le ' || to_char(v_eligible, 'DD/MM/YYYY') ||
          '. Active l''A2F sur Discord pour les recevoir tout de suite.',
        p_id
      );
    end if;

    update public.referrals
       set status = 'en_attente',
           path = 'differe',
           eligible_at = v_eligible,
           flags = v_flags,
           updated_at = now()
     where id = p_id;

    return jsonb_build_object('ok', true, 'status', 'en_attente', 'eligible_at', v_eligible);
  end if;

  -- Paiement différé : l'activité du filleul pendant l'attente est exigée.
  if v_active_required > 0 then
    select count(distinct d.day)::int into v_active
      from public.profile_activity_days d
     where d.user_id = v_ref.referred_id
       and d.day >= (v_ref.created_at at time zone 'utc')::date
       and d.day <= (now() at time zone 'utc')::date;

    if v_active < v_active_required then
      perform public._refuse_referral(p_id, 'active_days');
      return jsonb_build_object('ok', true, 'status', 'refuse');
    end if;
  end if;

  update public.referrals
     set path = 'differe', flags = v_flags, updated_at = now()
   where id = p_id;

  perform public._pay_referral(p_id);
  return jsonb_build_object('ok', true, 'status', 'paye', 'path', 'differe');
end;
$$;

revoke all on function public.evaluate_referral(bigint) from public;
revoke all on function public.evaluate_referral(bigint) from anon, authenticated;

create or replace function public.evaluate_referrals_for_referred(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  for v_row in
    select id from public.referrals
     where referred_id = p_user_id
       and status in ('en_cours', 'eligible', 'en_attente', 'a_examiner')
  loop
    perform public.evaluate_referral(v_row.id);
  end loop;
end;
$$;

revoke all on function public.evaluate_referrals_for_referred(uuid) from public;
revoke all on function public.evaluate_referrals_for_referred(uuid) from anon, authenticated;

-- Résultat de la vérification A2F, journalisé sur chaque parrainage concerné.
-- Appelée par le serveur (service_role) au retour OAuth : la valeur vient de
-- Discord, jamais du navigateur.
create or replace function public.referral_record_mfa(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  update public.profiles
     set discord_mfa_enabled = p_enabled,
         discord_mfa_checked_at = now()
   where id = p_user_id;

  if not found then
    return;
  end if;

  for v_row in
    select id from public.referrals where referred_id = p_user_id
  loop
    perform public._referral_log(
      v_row.id, p_user_id, 'mfa_check', jsonb_build_object('enabled', p_enabled)
    );
  end loop;

  perform public.evaluate_referrals_for_referred(p_user_id);
end;
$$;

revoke all on function public.referral_record_mfa(uuid, boolean) from public;
revoke all on function public.referral_record_mfa(uuid, boolean) from anon, authenticated;

-- Bouton « J'ai activé l'A2F, revérifier » : ne fait que relire l'état réel.
create or replace function public.referral_reevaluate_self()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_out jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  for v_row in
    select id from public.referrals
     where referred_id = v_uid
       and status in ('en_cours', 'eligible', 'en_attente', 'a_examiner')
  loop
    v_out := v_out || jsonb_build_array(public.evaluate_referral(v_row.id));
  end loop;

  return jsonb_build_object('ok', true, 'results', v_out);
end;
$$;

revoke all on function public.referral_reevaluate_self() from public;
revoke all on function public.referral_reevaluate_self() from anon;
grant execute on function public.referral_reevaluate_self() to authenticated;

-- ————— 13. Tableau de bord du joueur —————
create or replace function public.referral_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public.referral_config();
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_paid integer;
  v_active integer;
  v_rows jsonb;
  v_invited jsonb;
  v_referred_ref public.referrals%rowtype;
  v_missed integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  select count(*)::int into v_paid
    from public.referrals where referrer_id = v_uid and status = 'paye';

  select count(*)::int into v_active
    from public.referrals
   where referrer_id = v_uid
     and status in ('en_cours', 'eligible', 'en_attente', 'a_examiner');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'username', p.username,
           'status', r.status,
           'created_at', r.created_at,
           'milestone_reached_at', r.milestone_reached_at,
           'eligible_at', r.eligible_at,
           'paid_at', r.paid_at,
           'path', r.path,
           'openings', public.referral_openings(r.referred_id, r.created_at)
         ) order by r.created_at desc), '[]'::jsonb)
    into v_rows
    from public.referrals r
    join public.profiles p on p.id = r.referred_id
   where r.referrer_id = v_uid;

  select * into v_referred_ref
    from public.referrals where referred_id = v_uid;

  if found then
    select jsonb_build_object(
             'id', v_referred_ref.id,
             'referrer', p.username,
             'status', v_referred_ref.status,
             'path', v_referred_ref.path,
             'eligible_at', v_referred_ref.eligible_at,
             'paid_at', v_referred_ref.paid_at,
             'openings', public.referral_openings(v_uid, v_referred_ref.created_at),
             'discord_linked', exists (
               select 1 from public.discord_links d where d.user_id = v_uid
             )
           )
      into v_invited
      from public.profiles p
     where p.id = v_referred_ref.referrer_id;
  end if;

  -- Invitations non rattachées faute de place (plafond « en cours »).
  select count(*)::int into v_missed
    from public.referral_audit a
   where a.action = 'pending_cap'
     and a.actor_id = v_uid
     and a.created_at > now() - interval '30 days';

  return jsonb_build_object(
    'ok', true,
    'code', v_profile.referral_code,
    'bonus_boosters', v_profile.bonus_boosters,
    'missed', v_missed,
    'mfa_enabled', coalesce(v_profile.discord_mfa_enabled, false),
    'mfa_checked_at', v_profile.discord_mfa_checked_at,
    'discord_linked', exists (
      select 1 from public.discord_links d where d.user_id = v_uid
    ),
    'required_openings', coalesce((v_cfg->>'required_openings')::int, 20),
    'reward_boosters', coalesce((v_cfg->>'reward_boosters')::int, 3),
    'delay_days', coalesce((v_cfg->>'delay_days')::int, 7),
    'max_paid', coalesce((v_cfg->>'max_paid_per_referrer')::int, 20),
    'max_pending', coalesce((v_cfg->>'max_pending_per_referrer')::int, 50),
    'paid', v_paid,
    'active', v_active,
    'referrals', v_rows,
    'invited', v_invited
  );
end;
$$;

revoke all on function public.referral_overview() from public;
revoke all on function public.referral_overview() from anon;
grant execute on function public.referral_overview() to authenticated;

-- ————— 14. Administration —————
create or replace function public.referral_admin_report(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'referrer', pr.username,
           'referred', pf.username,
           'created_at', r.created_at,
           'status', r.status,
           'path', r.path,
           'flags', r.flags,
           'eligible_at', r.eligible_at,
           'paid_at', r.paid_at,
           'refused_reason', r.refused_reason,
           'openings', public.referral_openings(r.referred_id, r.created_at),
           'mfa', coalesce(pf.discord_mfa_enabled, false),
           'discord_linked', exists (
             select 1 from public.discord_links d where d.user_id = r.referred_id
           )
         ) order by r.created_at desc), '[]'::jsonb)
    into v_rows
    from public.referrals r
    join public.profiles pr on pr.id = r.referrer_id
    join public.profiles pf on pf.id = r.referred_id
   where v_status is null or r.status = v_status;

  return jsonb_build_object(
    'ok', true,
    'counts', jsonb_build_object(
      'total', (select count(*) from public.referrals),
      'en_cours', (select count(*) from public.referrals where status = 'en_cours'),
      'en_attente', (select count(*) from public.referrals where status = 'en_attente'),
      'a_examiner', (select count(*) from public.referrals where status = 'a_examiner'),
      'paye', (select count(*) from public.referrals where status = 'paye'),
      'refuse', (select count(*) from public.referrals where status = 'refuse')
    ),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.referral_admin_report(text) from public;
revoke all on function public.referral_admin_report(text) from anon;
grant execute on function public.referral_admin_report(text) to authenticated;

create or replace function public.referral_admin_decide(
  p_id bigint,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public.referral_config();
  v_uid uuid := auth.uid();
  v_status text;
  v_referrer uuid;
  v_paid boolean;
  v_paid_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select status, referrer_id into v_status, v_referrer
    from public.referrals where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if v_status in ('paye', 'refuse') then
    return jsonb_build_object('ok', false, 'reason', 'final');
  end if;

  if p_approve then
    -- Seul un parrainage « à examiner » se paie à la main.
    if v_status <> 'a_examiner' then
      return jsonb_build_object('ok', false, 'reason', 'not_review');
    end if;

    -- Le plafond du parrain s'applique aussi à une approbation manuelle.
    select count(*)::int into v_paid_count
      from public.referrals
     where referrer_id = v_referrer and status = 'paye';

    if v_paid_count >= coalesce((v_cfg->>'max_paid_per_referrer')::int, 20) then
      perform public._referral_log(p_id, v_uid, 'admin_approve_blocked', '{"reason":"paid_cap"}'::jsonb);
      return jsonb_build_object('ok', false, 'reason', 'paid_cap');
    end if;

    perform public._referral_log(p_id, v_uid, 'admin_approve', '{}'::jsonb);
    v_paid := public._pay_referral(p_id);
    return jsonb_build_object('ok', v_paid, 'status', case when v_paid then 'paye' else v_status end);
  end if;

  perform public._referral_log(
    p_id, v_uid, 'admin_refuse',
    jsonb_build_object('reason', nullif(btrim(coalesce(p_reason, '')), ''))
  );
  perform public._refuse_referral(p_id, coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'admin'));
  return jsonb_build_object('ok', true, 'status', 'refuse');
end;
$$;

revoke all on function public.referral_admin_decide(bigint, boolean, text) from public;
revoke all on function public.referral_admin_decide(bigint, boolean, text) from anon;
grant execute on function public.referral_admin_decide(bigint, boolean, text) to authenticated;

-- ————— 15. Tâche planifiée : paiements dus et purge —————
create or replace function public.referral_cron_batch(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(500, greatest(1, coalesce(p_limit, 100)));
  v_row record;
  v_processed integer := 0;
  v_paid integer := 0;
  v_failed integer := 0;
  v_result jsonb;
begin
  for v_row in
    select id
      from public.referrals
     where status = 'en_attente' and eligible_at is not null and eligible_at <= now()
     order by eligible_at
     limit v_limit
  loop
    begin
      v_result := public.evaluate_referral(v_row.id);
      v_processed := v_processed + 1;
      if v_result->>'status' = 'paye' then
        v_paid := v_paid + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
      perform public._referral_log(
        v_row.id, null, 'cron_error', jsonb_build_object('error', sqlerrm)
      );
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'processed', v_processed,
    'paid', v_paid,
    'failed', v_failed
  );
end;
$$;

revoke all on function public.referral_cron_batch(integer) from public;
revoke all on function public.referral_cron_batch(integer) from anon, authenticated;

create or replace function public.purge_referral_fingerprints()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := coalesce((public.referral_config()->>'fingerprint_retention_days')::int, 90);
  v_ip integer;
  v_ua integer;
begin
  update public.profiles
     set ip_hash = null, ip_hash_at = null
   where ip_hash is not null
     and (ip_hash_at is null or ip_hash_at < now() - make_interval(days => v_days));
  get diagnostics v_ip = row_count;

  update public.profiles
     set ua_hash = null, ua_hash_at = null
   where ua_hash is not null
     and (ua_hash_at is null or ua_hash_at < now() - make_interval(days => v_days));
  get diagnostics v_ua = row_count;

  delete from public.referral_rate_limits
   where window_start < now() - interval '1 day';

  return jsonb_build_object('ok', true, 'ip', v_ip, 'ua', v_ua);
end;
$$;

revoke all on function public.purge_referral_fingerprints() from public;
revoke all on function public.purge_referral_fingerprints() from anon, authenticated;

-- ————— 16. Boosters bonus dans l'ouverture —————
-- L'ancienne fonction de tirage garde son nom d'origine et devient interne.
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_pack'
  ) and not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = '_open_pack_stock'
  ) then
    alter function public.open_pack(text) rename to _open_pack_stock;
  end if;
end;
$$;

revoke all on function public._open_pack_stock(text) from public;
revoke all on function public._open_pack_stock(text) from anon, authenticated;

create or replace function public.open_pack(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_bonus integer;
  v_stock integer;
  v_anchor timestamptz;
  v_pack public.booster_types%rowtype;
  v_pool text[];
  v_rates jsonb;
  v_min integer;
  v_cards jsonb;
  v_server_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 1) Stock normal d'abord. La fonction historique fait le tirage complet.
  v_result := public._open_pack_stock(p_slug);

  if coalesce((v_result->>'ok')::boolean, false) then
    insert into public.booster_openings (user_id, pack_slug, count)
    values (v_uid, coalesce(v_result->>'pack', p_slug), 1);

    select bonus_boosters into v_bonus from public.profiles where id = v_uid;
    perform public.evaluate_referrals_for_referred(v_uid);

    return v_result || jsonb_build_object('bonus', coalesce(v_bonus, 0));
  end if;

  select bonus_boosters into v_bonus from public.profiles where id = v_uid;
  v_bonus := coalesce(v_bonus, 0);

  if coalesce(v_result->>'reason', '') <> 'no_stock' or v_bonus < 1 then
    return v_result || jsonb_build_object('bonus', v_bonus);
  end if;

  -- 2) Stock épuisé : le solde bonus prend le relais, sans bloquer la recharge.
  select * into v_pack
    from public.booster_types
   where slug = p_slug and active = true;

  if not found then
    raise exception 'unknown_pack' using errcode = 'P0002';
  end if;

  if v_pack.genre_id is null then
    select array_agg(id) into v_pool from public.playable_cards;
  else
    select array_agg(c.id) into v_pool
      from public.playable_cards c
      join public.card_genres cg on cg.card_id = c.id
     where cg.genre_id = v_pack.genre_id;
  end if;

  v_min := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'pack_min_pool_size'),
    15
  );

  if v_pool is null or array_length(v_pool, 1) < v_min then
    raise exception 'pack_unavailable' using errcode = '22023';
  end if;

  v_rates := coalesce(
    v_pack.drop_rates,
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  select booster_stock, last_booster_at
    into v_stock, v_anchor
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  -- Mise à jour conditionnelle unique : le solde ne peut pas devenir négatif.
  update public.profiles
     set bonus_boosters = bonus_boosters - 1
   where id = v_uid
     and bonus_boosters >= 1;

  if not found then
    raise exception 'concurrent_open' using errcode = '40001';
  end if;

  v_cards := public._draw_cards(v_pool, v_pack.cards_count, v_rates);
  v_cards := public._store_cards(v_uid, v_cards);

  insert into public.booster_openings (user_id, pack_slug, count)
  values (v_uid, v_pack.slug, 1);

  perform public.evaluate_referrals_for_referred(v_uid);

  return jsonb_build_object(
    'ok', true,
    'pack', v_pack.slug,
    'cards', v_cards,
    'stock', v_stock,
    'anchor', v_anchor,
    'server_now', v_server_now,
    'bonus', greatest(0, v_bonus - 1)
  );
end;
$$;

revoke all on function public.open_pack(text) from public;
revoke all on function public.open_pack(text) from anon;
grant execute on function public.open_pack(text) to authenticated;

-- Aides internes : aucun joueur ne doit pouvoir payer ou refuser directement.
revoke all on function public.ensure_referral_code() from public, anon, authenticated;
revoke all on function public._referral_log(bigint, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public._referral_notify(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public._refuse_referral(bigint, text) from public, anon, authenticated;
revoke all on function public._pay_referral(bigint) from public, anon, authenticated;

-- ————— 17. Droits du serveur (service_role) —————
-- Les fonctions internes ne sont pas exécutables par un joueur, mais le serveur
-- (clé de service) en a besoin : empreintes au retour OAuth, paiement horaire et
-- purge. `service_role` ne récupère pas automatiquement un droit révoqué à PUBLIC.
grant execute on function public.record_fingerprint(uuid, text, text) to service_role;
grant execute on function public.referral_record_mfa(uuid, boolean) to service_role;
grant execute on function public.evaluate_referral(bigint) to service_role;
grant execute on function public.evaluate_referrals_for_referred(uuid) to service_role;
grant execute on function public.referral_cron_batch(integer) to service_role;
grant execute on function public.purge_referral_fingerprints() to service_role;

-- ————— 18. Contrôles finaux —————
do $$
declare
  v_kind text;
begin
  if not exists (
    select 1 from public.profiles where referral_code is not null
  ) then
    raise exception 'aucun code de parrainage généré';
  end if;

  if exists (
    select 1 from public.profiles where bonus_boosters < 0
  ) then
    raise exception 'solde bonus négatif';
  end if;

  select pg_get_constraintdef(oid) into v_kind
    from pg_constraint
   where conname = 'notifications_kind_check'
     and conrelid = 'public.notifications'::regclass;

  if v_kind is null or position('referral_paid' in v_kind) = 0 then
    raise exception 'notifications_kind_check ne connaît pas referral_paid';
  end if;

  if has_function_privilege('authenticated', 'public._open_pack_stock(text)', 'execute') then
    raise exception 'les joueurs peuvent contourner le bonus';
  end if;

  if has_function_privilege('authenticated', 'public.evaluate_referral(bigint)', 'execute') then
    raise exception 'evaluate_referral est appelable par un joueur';
  end if;

  raise notice 'Parrainage en place : codes, journal, bonus et évaluation.';
end;
$$;

-- ============================================================
--  ROLLBACK
--  Voir 046_parrainage.down.sql (remet open_pack en place et retire
--  les objets ajoutés ; les bonus déjà attribués sont conservés).
-- ============================================================
