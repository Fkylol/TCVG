-- ============================================================
--  Migration 048 — overlay Halloween et booster de la sorcière
--
--  Le navigateur ne décide jamais s'il peut réclamer : la fonction
--  `claim_halloween_booster()` vérifie la session, la limite de débit, puis
--  fait le contrôle « une heure » et le crédit du stock bonus dans la même
--  opération atomique. Un double clic ne peut pas créditer deux boosters.
--
--  Le booster offert rejoint `profiles.bonus_boosters`, le stock bonus déjà
--  utilisé par le parrainage et consommé par `open_pack()` après le stock
--  normal. Il est donc ouvrable dans n'importe quel pack, sans nouvelle
--  mécanique d'inventaire parallèle.
-- ============================================================

-- ————— 1. Dernière réclamation, une ligne par joueur —————
create table if not exists public.halloween_claims (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_claim_at timestamptz not null default now()
);

comment on table public.halloween_claims is
  'Dernier booster d''Halloween réclamé par joueur. La fonction claim_halloween_booster() est la seule à écrire ici.';

alter table public.halloween_claims enable row level security;
revoke all on public.halloween_claims from anon, authenticated;

-- ————— 2. Compteur de débit de la route —————
-- Fenêtre fixe : une ligne par clé (IP ou joueur), remise à zéro à l'expiration.
create table if not exists public.halloween_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null default 0
);

comment on table public.halloween_rate_limits is
  'Limite de débit de la route Halloween. Aucune lecture directe par les joueurs.';

alter table public.halloween_rate_limits enable row level security;
revoke all on public.halloween_rate_limits from anon, authenticated;

-- ————— 3. Compteur interne —————
create or replace function public._halloween_rate_hit(
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

  insert into public.halloween_rate_limits as l (key, window_start, hits)
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

revoke all on function public._halloween_rate_hit(text, integer, integer) from public;
revoke all on function public._halloween_rate_hit(text, integer, integer) from anon;
revoke all on function public._halloween_rate_hit(text, integer, integer) from authenticated;

-- ————— 4. Réclamation atomique —————
create or replace function public.claim_halloween_booster(p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_last timestamptz;
  v_next timestamptz;
  v_retry integer;
  v_bonus integer;
  v_ip text := nullif(btrim(coalesce(p_ip, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Limite de débit globale : 30 essais par IP et 12 par joueur par minute.
  -- Elle protège la route des scripts, même quand la réclamation est encore
  -- en attente. Le contrôle « une heure » reste la règle métier.
  if v_ip is not null and length(v_ip) <= 64 then
    if not public._halloween_rate_hit('halloween:ip:' || v_ip, 30, 60) then
      return jsonb_build_object(
        'ok', false,
        'reason', 'rate_limited',
        'retryAfterMs', 60000
      );
    end if;
  end if;

  if not public._halloween_rate_hit('halloween:user:' || v_uid::text, 12, 60) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'rate_limited',
      'retryAfterMs', 60000
    );
  end if;

  -- Une seule instruction : la ligne est créée au premier passage, puis mise
  -- à jour uniquement si l'heure est écoulée. Deux appels concurrents ne
  -- peuvent pas tous les deux modifier la ligne.
  insert into public.halloween_claims as h (user_id, last_claim_at)
  values (v_uid, v_now)
  on conflict (user_id) do update
    set last_claim_at = excluded.last_claim_at
    where h.last_claim_at <= v_now - interval '1 hour'
  returning last_claim_at into v_last;

  if v_last is null then
    select last_claim_at + interval '1 hour'
      into v_next
      from public.halloween_claims
     where user_id = v_uid;

    v_retry := greatest(
      0,
      ceil(extract(epoch from (coalesce(v_next, v_now + interval '1 hour') - v_now)) * 1000)
    )::integer;

    return jsonb_build_object(
      'ok', false,
      'reason', 'cooldown',
      'retryAfterMs', v_retry,
      'nextAt', coalesce(v_next, v_now + interval '1 hour')
    );
  end if;

  -- Le stock bonus est le même que celui du parrainage : il est consommé par
  -- open_pack() après le stock normal, sur le pack choisi par le joueur.
  update public.profiles
     set bonus_boosters = bonus_boosters + 1
   where id = v_uid
  returning bonus_boosters into v_bonus;

  if v_bonus is null then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ok', true,
    'booster', jsonb_build_object('name', 'Booster de la sorcière'),
    'bonusBoosters', v_bonus,
    'retryAfterMs', 3600000,
    'nextAt', v_last + interval '1 hour'
  );
end;
$$;

revoke all on function public.claim_halloween_booster(text) from public;
revoke all on function public.claim_halloween_booster(text) from anon;
grant execute on function public.claim_halloween_booster(text) to authenticated;

-- Contrôles de structure.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'halloween_claims'
  ) then
    raise exception 'halloween_claims absente';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'halloween_rate_limits'
  ) then
    raise exception 'halloween_rate_limits absente';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'claim_halloween_booster'
  ) then
    raise exception 'claim_halloween_booster() absente';
  end if;
end;
$$;

-- ROLLBACK
-- drop function if exists public.claim_halloween_booster(text);
-- drop function if exists public._halloween_rate_hit(text, integer, integer);
-- drop table if exists public.halloween_rate_limits;
-- drop table if exists public.halloween_claims;
