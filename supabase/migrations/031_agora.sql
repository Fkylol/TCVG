-- ============================================================
--  Migration 031 — L'AGORA : chat communautaire en direct
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Périmètre : C1 (temps réel), C2 (salons et langues), C3 (types de
--  messages), C5 (sécurité, modération, anti-spam), C6 (données de
--  l'interface). Les échanges carte contre carte (C4) viendront dans une
--  migration séparée : rien ici ne les préempte, `chat_messages.payload`
--  est déjà prêt à recevoir d'autres types d'annonces.
--
--  Principes appliqués :
--    • le message est écrit en base AVANT d'être diffusé (Realtime lit la
--      table) : aucun message ne peut exister seulement chez le client ;
--    • l'identifiant est croissant : à la reconnexion, le client redemande
--      tout ce qui est postérieur à son dernier identifiant ;
--    • tous les droits sont vérifiés en base (fonctions `security definer`),
--      le client n'a aucun accès en écriture directe aux tables ;
--    • aucune donnée privée dans les payloads : pseudo, avatar, cadre et
--      identifiant de carte uniquement ;
--    • les joueurs n'écrivent pas en HTML : le corps est du texte brut, les
--      liens sont refusés, les mots interdits sont masqués.
--
--  Tables (lecture seule pour les joueurs, sauf `chat_messages` et
--  `chat_rooms` dont Realtime a besoin) :
--    chat_rooms, chat_messages, chat_announcements, chat_presence,
--    chat_preferences, chat_reports, chat_blocks, chat_sanctions,
--    chat_audit, chat_banned_words.
-- ============================================================

-- ————— Réglages (modifiables en base, sans redéploiement) —————
insert into public.game_config (key, value) values
  ('chat_room_capacity', '150'::jsonb),
  ('chat_retention_days', '7'::jsonb),
  ('chat_rate_seconds', '3'::jsonb),
  ('chat_rate_per_minute', '20'::jsonb),
  ('chat_unlock_boosters', '20'::jsonb),
  ('chat_unlock_hours', '24'::jsonb),
  ('chat_max_announcements', '3'::jsonb),
  ('chat_announcement_minutes', '30'::jsonb),
  ('chat_history_page', '50'::jsonb)
on conflict (key) do nothing;

-- Lecture d'un réglage numérique, avec repli si la clé manque.
create or replace function public.chat_setting(p_key text, p_default numeric)
returns numeric
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.game_config where key = p_key),
    p_default
  );
$$;

revoke all on function public.chat_setting(text, numeric) from public;
revoke all on function public.chat_setting(text, numeric) from anon;

-- ————— Salons —————
-- Une langue = un groupe de salons numérotés. La capacité est portée par le
-- salon : la changer ici ne réécrit pas les salons existants (voir README).
create table if not exists public.chat_rooms (
  id integer generated always as identity primary key,
  language text not null check (language in ('fr', 'en', 'es', 'int')),
  number integer not null check (number between 1 and 50),
  capacity integer not null default 150 check (capacity between 2 and 1000),
  read_only boolean not null default false,
  created_at timestamptz not null default now(),
  unique (language, number)
);

alter table public.chat_rooms enable row level security;

drop policy if exists "chat_rooms: lecture" on public.chat_rooms;
create policy "chat_rooms: lecture"
  on public.chat_rooms for select
  to authenticated
  using (true);

revoke all on public.chat_rooms from anon, authenticated;
grant select on public.chat_rooms to authenticated;

-- Douze salons de départ : trois par langue.
insert into public.chat_rooms (language, number, capacity)
select lang, n, greatest(2, public.chat_setting('chat_room_capacity', 150)::int)
  from (values ('fr'), ('en'), ('es'), ('int')) as l(lang),
       (values (1), (2), (3)) as s(n)
on conflict (language, number) do nothing;

-- ————— Messages —————
-- `kind` : texte libre, annonce « j'échange », annonce « je cherche »,
-- message système (arrivée, règles). `payload` ne contient que des
-- identifiants : la carte est résolue par le client depuis le catalogue,
-- et la collection de l'auteur n'est jamais exposée.
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room_id integer not null references public.chat_rooms (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'have', 'want', 'system')),
  body text not null default '' check (char_length(body) <= 300),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);

create index if not exists chat_messages_room_idx
  on public.chat_messages (room_id, id desc);

create index if not exists chat_messages_user_idx
  on public.chat_messages (user_id, created_at desc);

create index if not exists chat_messages_recent_idx
  on public.chat_messages (created_at desc);

-- ————— Annonces —————
create table if not exists public.chat_announcements (
  id bigint generated always as identity primary key,
  message_id bigint not null unique references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.cards (id) on delete cascade,
  kind text not null check (kind in ('have', 'want')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'withdrawn', 'removed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists chat_announcements_user_idx
  on public.chat_announcements (user_id, status);

create index if not exists chat_announcements_expiry_idx
  on public.chat_announcements (expires_at)
  where status = 'active';

-- ————— Présence (compteur de joueurs connectés) —————
-- Un battement toutes les 30 s côté client ; un joueur est compté connecté
-- s'il a battu dans les 60 dernières secondes.
create table if not exists public.chat_presence (
  room_id integer not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists chat_presence_seen_idx
  on public.chat_presence (seen_at);

-- ————— Préférences (langue, salon, dernier message lu) —————
create table if not exists public.chat_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'fr' check (language in ('fr', 'en', 'es', 'int')),
  room_id integer references public.chat_rooms (id) on delete set null,
  hide_announcements boolean not null default false,
  last_read_message_id bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ————— Signalements —————
create table if not exists public.chat_reports (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'scam', 'other')),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'open' check (status in ('open', 'handled', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  unique (message_id, reporter_id)
);

create index if not exists chat_reports_open_idx
  on public.chat_reports (created_at desc)
  where status = 'open';

-- ————— Blocages —————
create table if not exists public.chat_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists chat_blocks_blocked_idx
  on public.chat_blocks (blocked_id);

-- ————— Sanctions (réduction au silence) —————
-- `until` nul = définitif. Une sanction levée garde sa ligne : le journal
-- reste lisible, rien n'est effacé.
create table if not exists public.chat_sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  moderator_id uuid references auth.users (id) on delete set null,
  kind text not null default 'mute' check (kind in ('mute')),
  until timestamptz,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users (id) on delete set null
);

create index if not exists chat_sanctions_active_idx
  on public.chat_sanctions (user_id, until);

-- ————— Journal d'audit —————
-- Aucune lecture côté joueur, même administrateur : il se consulte par
-- `chat_admin_queue()` ou depuis le SQL Editor.
create table if not exists public.chat_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users (id) on delete set null,
  message_id bigint,
  room_id integer,
  reason text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_audit_recent_idx
  on public.chat_audit (created_at desc);

-- ————— Filtre de contenu —————
-- Liste de départ, volontairement courte : les mots se règlent en base.
create table if not exists public.chat_banned_words (
  word text primary key check (char_length(word) between 3 and 40),
  created_at timestamptz not null default now()
);

insert into public.chat_banned_words (word) values
  ('connard'), ('connasse'), ('salope'), ('pute'), ('enculé'), ('encule'),
  ('fdp'), ('bâtard'), ('batard'), ('ordure'), ('abruti'), ('nique ta mère')
on conflict (word) do nothing;

-- ————— Verrouillage des tables —————
-- Tout passe par les fonctions : ces tables ne sont ni lisibles ni
-- modifiables directement par un joueur.
alter table public.chat_announcements enable row level security;
alter table public.chat_presence enable row level security;
alter table public.chat_preferences enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_sanctions enable row level security;
alter table public.chat_audit enable row level security;
alter table public.chat_banned_words enable row level security;

revoke all on public.chat_announcements from anon, authenticated;
revoke all on public.chat_presence from anon, authenticated;
revoke all on public.chat_preferences from anon, authenticated;
revoke all on public.chat_reports from anon, authenticated;
revoke all on public.chat_blocks from anon, authenticated;
revoke all on public.chat_sanctions from anon, authenticated;
revoke all on public.chat_audit from anon, authenticated;
revoke all on public.chat_banned_words from anon, authenticated;

-- ————— Blocage : fonction lisible par les policies RLS —————
-- `security definer` : la policy peut l'appeler sans donner au joueur un
-- droit de lecture sur `chat_blocks`.
create or replace function public.chat_is_blocked(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
      from public.chat_blocks b
     where b.blocker_id = auth.uid()
       and b.blocked_id = p_user_id
  );
$$;

revoke all on function public.chat_is_blocked(uuid) from public;
revoke all on function public.chat_is_blocked(uuid) from anon;
grant execute on function public.chat_is_blocked(uuid) to authenticated;

-- Realtime : un joueur ne reçoit que les messages visibles. Ses blocages
-- s'appliquent aussi au flux (en plus du masquage côté client).
alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages: lecture" on public.chat_messages;
create policy "chat_messages: lecture"
  on public.chat_messages for select
  to authenticated
  using (deleted_at is null and not public.chat_is_blocked(user_id));

revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

-- ————— Nettoyage : annonces échues, rétention, présence —————
create or replace function public.chat_sweep()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
  v_deleted integer;
  v_days integer := greatest(1, public.chat_setting('chat_retention_days', 7)::int);
begin
  update public.chat_announcements
     set status = 'expired'
   where status = 'active'
     and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- Rétention : la durée est annoncée dans les règles du chat.
  delete from public.chat_messages
   where created_at < now() - make_interval(days => v_days);
  get diagnostics v_deleted = row_count;

  delete from public.chat_presence
   where seen_at < now() - interval '1 hour';

  return jsonb_build_object('expired', v_expired, 'purged', v_deleted);
end;
$$;

revoke all on function public.chat_sweep() from public;
revoke all on function public.chat_sweep() from anon;

-- ————— Peut-on écrire ? —————
-- Déblocage progressif : un minimum de boosters ouverts et un compte assez
-- ancien. Avant cela, la lecture reste ouverte et l'interface affiche ce
-- qui manque. Les administrateurs passent outre le déblocage (pas la
-- sanction, qui s'applique à tout le monde).
create or replace function public.chat_can_write()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_opened integer := 0;
  v_age_hours numeric := 0;
  v_min_boosters integer := public.chat_setting('chat_unlock_boosters', 20)::int;
  v_min_hours numeric := public.chat_setting('chat_unlock_hours', 24);
  v_muted boolean := false;
  v_muted_until timestamptz;
  v_admin boolean := false;
  v_unlocked boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select coalesce(p.boosters_opened, 0) into v_opened
    from public.profiles p where p.id = v_uid;

  select greatest(0, extract(epoch from (now() - u.created_at)) / 3600.0)
    into v_age_hours
    from auth.users u where u.id = v_uid;

  v_admin := public.is_admin();

  select true, s.until into v_muted, v_muted_until
    from public.chat_sanctions s
   where s.user_id = v_uid
     and s.lifted_at is null
     and (s.until is null or s.until > now())
   order by s.until nulls first, s.created_at desc
   limit 1;

  if v_muted then
    return jsonb_build_object(
      'ok', false,
      'reason', 'muted',
      'muted', true,
      'muted_until', v_muted_until
    );
  end if;

  v_unlocked := v_admin
    or (coalesce(v_opened, 0) >= v_min_boosters and coalesce(v_age_hours, 0) >= v_min_hours);

  return jsonb_build_object(
    'ok', v_unlocked,
    'muted', false,
    'unlocked', v_unlocked,
    'boosters', coalesce(v_opened, 0),
    'boosters_needed', greatest(0, v_min_boosters - coalesce(v_opened, 0)),
    'hours_left', round(greatest(0, v_min_hours - coalesce(v_age_hours, 0))::numeric, 1),
    'hours_needed', v_min_hours,
    'reason', case when v_unlocked then null else 'locked' end
  );
end;
$$;

revoke all on function public.chat_can_write() from public;
revoke all on function public.chat_can_write() from anon;
grant execute on function public.chat_can_write() to authenticated;

-- ————— Nettoyage du texte —————
-- Refuse le vide (sauf annonce), la longueur excessive et les liens. Les
-- caractères de contrôle sont remplacés : aucun HTML ne peut rentrer.
create or replace function public.chat_clean_body(p_body text, p_allow_empty boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
immutable
as $$
declare
  v_body text;
begin
  v_body := regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g');
  v_body := regexp_replace(v_body, '[[:space:]]+', ' ', 'g');
  v_body := btrim(v_body);

  if v_body = '' and not p_allow_empty then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  if char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'reason', 'too_long', 'max', 300);
  end if;

  -- Aucun lien : ni schéma, ni « www. », ni domaine connu.
  if v_body ~* '(https?://|www\.|\y[a-z0-9][a-z0-9-]*\.(com|net|org|fr|be|ch|ca|io|gg|ly|me|tv|co|xyz|info|app|dev|shop|site|online|ru|cn|uk|de|es|it|nl|pt)(\y|/))' then
    return jsonb_build_object('ok', false, 'reason', 'links_forbidden');
  end if;

  return jsonb_build_object('ok', true, 'body', v_body);
end;
$$;

revoke all on function public.chat_clean_body(text, boolean) from public;
revoke all on function public.chat_clean_body(text, boolean) from anon;

-- Majuscules abusives : un message entièrement crié (15 lettres minimum)
-- est ramené en casse de phrase, sans le refuser.
create or replace function public.chat_soften_shouting(p_body text)
returns text
language sql
immutable
as $$
  select case
    when char_length(regexp_replace(p_body, '[^[:alpha:]]', '', 'g')) >= 15
     and regexp_replace(p_body, '[^[:alpha:]]', '', 'g') = upper(regexp_replace(p_body, '[^[:alpha:]]', '', 'g'))
    then upper(left(p_body, 1)) || lower(substr(p_body, 2))
    else p_body
  end;
$$;

-- Masquage des mots interdits : chaque occurrence est remplacée par des
-- puces, casse comprise, sans toucher au reste du message.
create or replace function public.chat_mask_words(p_body text)
returns text
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_body text := p_body;
  v_word text;
  v_pos integer;
begin
  for v_word in select word from public.chat_banned_words loop
    loop
      v_pos := position(lower(v_word) in lower(v_body));
      exit when v_pos = 0;
      v_body := overlay(v_body placing repeat('•', char_length(v_word)) from v_pos for char_length(v_word));
    end loop;
  end loop;

  return v_body;
end;
$$;

revoke all on function public.chat_mask_words(text) from public;
revoke all on function public.chat_mask_words(text) from anon;

-- ————— Limite de débit et anti-flood —————
create or replace function public.chat_rate_gate(p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seconds numeric := greatest(1, public.chat_setting('chat_rate_seconds', 3));
  v_per_minute integer := greatest(1, public.chat_setting('chat_rate_per_minute', 20)::int);
  v_count integer;
  v_since timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select count(*) into v_count
    from public.chat_messages m
   where m.user_id = v_uid
     and m.created_at > now() - make_interval(secs => v_seconds::double precision);

  if v_count > 0 then
    select max(m.created_at) into v_since
      from public.chat_messages m
     where m.user_id = v_uid;

    return jsonb_build_object(
      'ok', false,
      'reason', 'too_fast',
      'retry_after', greatest(1, ceil(v_seconds - extract(epoch from (now() - v_since))))::int
    );
  end if;

  select count(*) into v_count
    from public.chat_messages m
   where m.user_id = v_uid
     and m.created_at > now() - interval '60 seconds';

  if v_count >= v_per_minute then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'retry_after', 60);
  end if;

  -- Trois fois le même message en deux minutes : c'est du flood.
  select count(*) into v_count
    from public.chat_messages m
   where m.user_id = v_uid
     and lower(m.body) = lower(p_body)
     and m.created_at > now() - interval '2 minutes';

  if v_count >= 2 then
    return jsonb_build_object('ok', false, 'reason', 'flood');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_rate_gate(text) from public;
revoke all on function public.chat_rate_gate(text) from anon;

-- ————— Entrée dans un salon (présence + message d'arrivée) —————
-- Interne : appelée par `chat_join` / `chat_set_room`.
create or replace function public.chat_enter_room(p_uid uuid, p_room_id integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seen timestamptz;
  v_name text;
  v_read_only boolean := true;
begin
  select p.seen_at into v_seen
    from public.chat_presence p
   where p.room_id = p_room_id and p.user_id = p_uid;

  insert into public.chat_presence (room_id, user_id, seen_at)
  values (p_room_id, p_uid, now())
  on conflict (room_id, user_id)
    do update set seen_at = now();

  -- Message d'arrivée : seulement après une absence d'une heure, pour ne
  -- pas transformer chaque rechargement de page en bavardage.
  if v_seen is null or v_seen < now() - interval '60 minutes' then
    select r.read_only into v_read_only from public.chat_rooms r where r.id = p_room_id;
    select p.username into v_name from public.profiles p where p.id = p_uid;

    if not coalesce(v_read_only, true) then
      insert into public.chat_messages (room_id, user_id, kind, body, payload)
      values (
        p_room_id,
        null,
        'system',
        coalesce(v_name, 'Un joueur') || ' entre dans le salon.',
        jsonb_build_object('event', 'join', 'username', v_name)
      );
    end if;
  end if;
end;
$$;

revoke all on function public.chat_enter_room(uuid, integer) from public;
revoke all on function public.chat_enter_room(uuid, integer) from anon;
revoke all on function public.chat_enter_room(uuid, integer) from authenticated;

-- ————— État du panneau —————
-- Un seul appel au chargement : salons et connectés, préférences, droit
-- d'écriture, blocages, non-lus, réglages d'affichage.
create or replace function public.chat_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pref public.chat_preferences%rowtype;
  v_unread integer := 0;
  v_mine integer := 0;
  v_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_sweep();

  insert into public.chat_preferences (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_pref from public.chat_preferences where user_id = v_uid;

  select count(*) into v_unread
    from public.chat_messages m
   where m.room_id = v_pref.room_id
     and m.id > v_pref.last_read_message_id
     and m.user_id is distinct from v_uid
     and m.deleted_at is null
     and not public.chat_is_blocked(m.user_id);

  select count(*) into v_mine
    from public.chat_announcements a
   where a.user_id = v_uid and a.status = 'active';

  v_admin := public.is_admin();

  return jsonb_build_object(
    'rooms', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'language', r.language,
          'number', r.number,
          'capacity', r.capacity,
          'read_only', r.read_only,
          'online', coalesce(o.online, 0)
        ) order by r.language, r.number
      ), '[]'::jsonb)
        from public.chat_rooms r
        left join (
          select p.room_id, count(*)::int as online
            from public.chat_presence p
           where p.seen_at > now() - interval '60 seconds'
           group by p.room_id
        ) o on o.room_id = r.id
    ),
    'language', v_pref.language,
    'room_id', v_pref.room_id,
    'hide_announcements', v_pref.hide_announcements,
    'can_write', public.chat_can_write(),
    'blocked', (
      select coalesce(jsonb_agg(b.blocked_id), '[]'::jsonb)
        from public.chat_blocks b
       where b.blocker_id = v_uid
    ),
    'admin', v_admin,
    'unread', v_unread,
    'my_announcements', v_mine,
    'settings', jsonb_build_object(
      'history_page', public.chat_setting('chat_history_page', 50)::int,
      'retention_days', public.chat_setting('chat_retention_days', 7)::int,
      'rate_seconds', public.chat_setting('chat_rate_seconds', 3)::int,
      'rate_per_minute', public.chat_setting('chat_rate_per_minute', 20)::int,
      'max_announcements', public.chat_setting('chat_max_announcements', 3)::int,
      'announcement_minutes', public.chat_setting('chat_announcement_minutes', 30)::int,
      'unlock_boosters', public.chat_setting('chat_unlock_boosters', 20)::int,
      'unlock_hours', public.chat_setting('chat_unlock_hours', 24)::int
    )
  );
end;
$$;

revoke all on function public.chat_state() from public;
revoke all on function public.chat_state() from anon;
grant execute on function public.chat_state() to authenticated;

-- ————— Rejoindre un salon —————
-- Langue explicite, sinon la dernière langue choisie, sinon le français.
-- Salon explicite s'il existe, sinon le moins rempli de la langue.
create or replace function public.chat_join(
  p_language text default null,
  p_room_id integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pref public.chat_preferences%rowtype;
  v_language text;
  v_room integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_sweep();

  insert into public.chat_preferences (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_pref from public.chat_preferences where user_id = v_uid;

  v_language := coalesce(nullif(btrim(p_language), ''), v_pref.language, 'fr');
  if v_language not in ('fr', 'en', 'es', 'int') then
    v_language := 'fr';
  end if;

  if p_room_id is not null
     and exists (select 1 from public.chat_rooms r where r.id = p_room_id) then
    v_room := p_room_id;
  elsif v_pref.room_id is not null
    and exists (
      select 1 from public.chat_rooms r
       where r.id = v_pref.room_id
         and r.language = v_language
         and (select count(*) from public.chat_presence p
               where p.room_id = r.id and p.seen_at > now() - interval '60 seconds') < r.capacity
    ) then
    v_room := v_pref.room_id;
  else
    select r.id into v_room
      from public.chat_rooms r
     where r.language = v_language
     order by
       (select count(*) from public.chat_presence p
         where p.room_id = r.id and p.seen_at > now() - interval '60 seconds'),
       r.read_only,
       r.number
     limit 1;
  end if;

  if v_room is null then
    return jsonb_build_object('ok', false, 'reason', 'no_room');
  end if;

  perform public.chat_enter_room(v_uid, v_room);

  update public.chat_preferences
     set language = (select r.language from public.chat_rooms r where r.id = v_room),
         room_id = v_room,
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'state', public.chat_state());
end;
$$;

revoke all on function public.chat_join(text, integer) from public;
revoke all on function public.chat_join(text, integer) from anon;
grant execute on function public.chat_join(text, integer) to authenticated;

-- Changement de salon à la main : même contrôle de capacité, même présence.
create or replace function public.chat_set_room(p_room_id integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_full boolean;
  v_language text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select r.language,
         (select count(*) from public.chat_presence p
           where p.room_id = r.id and p.seen_at > now() - interval '60 seconds') >= r.capacity
    into v_language, v_full
    from public.chat_rooms r
   where r.id = p_room_id;

  if v_language is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_room');
  end if;

  if v_full then
    return jsonb_build_object('ok', false, 'reason', 'room_full');
  end if;

  perform public.chat_enter_room(v_uid, p_room_id);

  update public.chat_preferences
     set language = v_language, room_id = p_room_id, updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'state', public.chat_state());
end;
$$;

revoke all on function public.chat_set_room(integer) from public;
revoke all on function public.chat_set_room(integer) from anon;
grant execute on function public.chat_set_room(integer) to authenticated;

-- Battement de présence (30 s) : met aussi à jour le dernier message lu.
create or replace function public.chat_ping(p_room_id integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.chat_rooms r where r.id = p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_room');
  end if;

  insert into public.chat_presence (room_id, user_id, seen_at)
  values (p_room_id, v_uid, now())
  on conflict (room_id, user_id)
    do update set seen_at = now();

  update public.chat_preferences p
     set last_read_message_id = greatest(
           p.last_read_message_id,
           coalesce((select max(m.id) from public.chat_messages m where m.room_id = p_room_id), 0)
         ),
         updated_at = now()
   where p.user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'online', (
      select coalesce(jsonb_agg(jsonb_build_object('room_id', s.room_id, 'online', s.online)), '[]'::jsonb)
        from (
          select p2.room_id, count(*)::int as online
            from public.chat_presence p2
           where p2.seen_at > now() - interval '60 seconds'
           group by p2.room_id
        ) s
    )
  );
end;
$$;

revoke all on function public.chat_ping(integer) from public;
revoke all on function public.chat_ping(integer) from anon;
grant execute on function public.chat_ping(integer) to authenticated;

-- ————— Historique —————
-- `p_after` = rattrapage après reconnexion (ordre croissant).
-- `p_before` = remonter l'historique (ordre croissant aussi).
-- `p_room_id` nul = « Tous les salons », agrégat en lecture seule.
create or replace function public.chat_history(
  p_room_id integer default null,
  p_before bigint default null,
  p_after bigint default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
  v_count integer;
  v_has_more boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  with picked as (
    select m.*
      from public.chat_messages m
     where (p_room_id is null or m.room_id = p_room_id)
       and m.deleted_at is null
       and not public.chat_is_blocked(m.user_id)
       and (
         (p_after is not null and m.id > p_after)
         or (p_after is null and (p_before is null or m.id < p_before))
       )
     order by
       case when p_after is not null then m.id end asc,
       case when p_after is null then m.id end desc
     limit v_limit + 1
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', picked.id,
        'room_id', picked.room_id,
        'kind', picked.kind,
        'body', picked.body,
        'payload', picked.payload,
        'created_at', picked.created_at,
        'user_id', picked.user_id,
        'username', pr.username,
        'avatar_card_id', pr.avatar_card_id,
        'frame', pr.frame,
        'mine', picked.user_id = v_uid,
        'owned', coalesce((
          select c.quantity
            from public.collection c
           where c.user_id = v_uid
             and c.card_id = picked.payload ->> 'card_id'
        ), 0),
        'announcement', (
          select jsonb_build_object(
                   'id', a.id,
                   'kind', a.kind,
                   'status', a.status,
                   'expires_at', a.expires_at
                 )
            from public.chat_announcements a
           where a.message_id = picked.id
        )
      ) order by picked.id
    ), '[]'::jsonb),
    count(*)
    into v_rows, v_count
    from picked
    left join public.profiles pr on pr.id = picked.user_id;

  v_has_more := v_count > v_limit;

  if v_has_more then
    if p_after is not null then
      -- Rattrapage : on garde les plus anciens, la suite viendra au tour suivant.
      v_rows := v_rows - (v_count - 1);
    else
      -- Remontée d'historique : on garde les plus récents.
      v_rows := v_rows - 0;
    end if;
  end if;

  return jsonb_build_object('messages', v_rows, 'has_more', v_has_more);
end;
$$;

revoke all on function public.chat_history(integer, bigint, bigint, integer) from public;
revoke all on function public.chat_history(integer, bigint, bigint, integer) from anon;
grant execute on function public.chat_history(integer, bigint, bigint, integer) to authenticated;

-- ————— Envoi d'un message de texte —————
create or replace function public.chat_send(p_room_id integer, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_clean jsonb;
  v_gate jsonb;
  v_can jsonb;
  v_body text;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_sweep();

  if not exists (select 1 from public.chat_rooms r where r.id = p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_room');
  end if;

  if (select r.read_only from public.chat_rooms r where r.id = p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'read_only');
  end if;

  v_can := public.chat_can_write();
  if not coalesce((v_can ->> 'ok')::boolean, false) then
    return v_can;
  end if;

  v_clean := public.chat_clean_body(p_body, false);
  if not coalesce((v_clean ->> 'ok')::boolean, false) then
    return v_clean;
  end if;
  v_body := v_clean ->> 'body';

  v_gate := public.chat_rate_gate(v_body);
  if not coalesce((v_gate ->> 'ok')::boolean, false) then
    return v_gate;
  end if;

  v_body := public.chat_soften_shouting(v_body);
  v_body := public.chat_mask_words(v_body);

  insert into public.chat_messages (room_id, user_id, kind, body)
  values (p_room_id, v_uid, 'text', v_body)
  returning id into v_id;

  insert into public.chat_presence (room_id, user_id, seen_at)
  values (p_room_id, v_uid, now())
  on conflict (room_id, user_id)
    do update set seen_at = now();

  return jsonb_build_object('ok', true, 'id', v_id, 'body', v_body);
end;
$$;

revoke all on function public.chat_send(integer, text) from public;
revoke all on function public.chat_send(integer, text) from anon;
grant execute on function public.chat_send(integer, text) to authenticated;

-- ————— Annonce « J'échange » / « Je cherche » —————
-- « J'échange » exige un doublon ; « Je cherche » une carte absente ou
-- présente dans les envies. Trois annonces actives au maximum, trente
-- minutes de vie.
create or replace function public.chat_announce(
  p_kind text,
  p_card_id text,
  p_room_id integer,
  p_body text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text := nullif(btrim(p_kind), '');
  v_card text := nullif(btrim(p_card_id), '');
  v_clean jsonb;
  v_gate jsonb;
  v_can jsonb;
  v_body text := '';
  v_owned integer := 0;
  v_wish boolean := false;
  v_active integer := 0;
  v_max integer := greatest(1, public.chat_setting('chat_max_announcements', 3)::int);
  v_minutes integer := greatest(1, public.chat_setting('chat_announcement_minutes', 30)::int);
  v_message bigint;
  v_announcement bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_sweep();

  if v_kind is null or v_kind not in ('have', 'want') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  end if;

  if not exists (select 1 from public.chat_rooms r where r.id = p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_room');
  end if;

  if (select r.read_only from public.chat_rooms r where r.id = p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'read_only');
  end if;

  v_can := public.chat_can_write();
  if not coalesce((v_can ->> 'ok')::boolean, false) then
    return v_can;
  end if;

  if v_card is null or not exists (
    select 1 from public.cards k where k.id = v_card and k.active
  ) then
    return jsonb_build_object('ok', false, 'reason', 'card_unavailable');
  end if;

  select coalesce(c.quantity, 0) into v_owned
    from (select 1) as one
    left join public.collection c
      on c.user_id = v_uid and c.card_id = v_card;

  v_wish := exists (
    select 1 from public.wishlist w where w.user_id = v_uid and w.card_id = v_card
  );

  if v_kind = 'have' and coalesce(v_owned, 0) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'need_duplicate');
  end if;

  if v_kind = 'want' and coalesce(v_owned, 0) > 0 and not v_wish then
    return jsonb_build_object('ok', false, 'reason', 'already_owned');
  end if;

  v_clean := public.chat_clean_body(p_body, true);
  if not coalesce((v_clean ->> 'ok')::boolean, false) then
    return v_clean;
  end if;
  v_body := coalesce(v_clean ->> 'body', '');

  v_gate := public.chat_rate_gate(v_body);
  if not coalesce((v_gate ->> 'ok')::boolean, false) then
    return v_gate;
  end if;

  select count(*) into v_active
    from public.chat_announcements a
   where a.user_id = v_uid
     and a.status = 'active'
     and a.expires_at > now();

  if v_active >= v_max then
    return jsonb_build_object('ok', false, 'reason', 'too_many', 'max', v_max);
  end if;

  v_body := public.chat_mask_words(public.chat_soften_shouting(v_body));

  insert into public.chat_messages (room_id, user_id, kind, body, payload)
  values (p_room_id, v_uid, v_kind, v_body, jsonb_build_object('card_id', v_card))
  returning id into v_message;

  insert into public.chat_announcements (message_id, user_id, card_id, kind, expires_at)
  values (v_message, v_uid, v_card, v_kind, now() + make_interval(mins => v_minutes))
  returning id into v_announcement;

  insert into public.chat_presence (room_id, user_id, seen_at)
  values (p_room_id, v_uid, now())
  on conflict (room_id, user_id)
    do update set seen_at = now();

  return jsonb_build_object(
    'ok', true,
    'id', v_message,
    'announcement_id', v_announcement,
    'expires_in', v_minutes
  );
end;
$$;

revoke all on function public.chat_announce(text, text, integer, text) from public;
revoke all on function public.chat_announce(text, text, integer, text) from anon;
grant execute on function public.chat_announce(text, text, integer, text) to authenticated;

-- ————— Retirer une annonce —————
-- Le message disparaît (l'auteur peut toujours retirer ce qu'il a écrit),
-- l'annonce passe en « withdrawn ».
create or replace function public.chat_withdraw_announcement(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.chat_announcements%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_row
    from public.chat_announcements a
   where a.id = p_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  if v_row.user_id <> v_uid and not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if v_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  update public.chat_announcements
     set status = 'withdrawn'
   where id = p_id;

  update public.chat_messages
     set deleted_at = now(), deleted_by = v_uid
   where id = v_row.message_id and deleted_at is null;

  if v_row.user_id <> v_uid then
    insert into public.chat_audit (actor_id, action, target_user_id, message_id, reason)
    values (v_uid, 'announcement_withdrawn', v_row.user_id, v_row.message_id, 'moderation');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_withdraw_announcement(bigint) from public;
revoke all on function public.chat_withdraw_announcement(bigint) from anon;
grant execute on function public.chat_withdraw_announcement(bigint) to authenticated;

-- ————— Supprimer son propre message —————
create or replace function public.chat_delete_message(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.chat_messages%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_row from public.chat_messages m where m.id = p_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  if v_row.user_id is distinct from v_uid and not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  update public.chat_messages
     set deleted_at = now(), deleted_by = v_uid
   where id = p_id and deleted_at is null;

  update public.chat_announcements
     set status = 'withdrawn'
   where message_id = p_id and status = 'active';

  if v_row.user_id is distinct from v_uid then
    insert into public.chat_audit (actor_id, action, target_user_id, message_id, reason)
    values (v_uid, 'message_deleted', v_row.user_id, p_id, 'admin');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_delete_message(bigint) from public;
revoke all on function public.chat_delete_message(bigint) from anon;
grant execute on function public.chat_delete_message(bigint) to authenticated;

-- ————— Signalement —————
create or replace function public.chat_report(
  p_message_id bigint,
  p_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_reason is null or v_reason not in ('spam', 'harassment', 'inappropriate', 'scam', 'other') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_reason');
  end if;

  if not exists (select 1 from public.chat_messages m where m.id = p_message_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  insert into public.chat_reports (message_id, reporter_id, reason, note)
  values (p_message_id, v_uid, v_reason, nullif(btrim(p_note), ''))
  on conflict (message_id, reporter_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_report(bigint, text, text) from public;
revoke all on function public.chat_report(bigint, text, text) from anon;
grant execute on function public.chat_report(bigint, text, text) to authenticated;

-- ————— Bloquer / débloquer —————
create or replace function public.chat_block(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_user_id is null or p_user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'invalid_user');
  end if;

  insert into public.chat_blocks (blocker_id, blocked_id)
  values (v_uid, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.chat_unblock(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.chat_blocks b
   where b.blocker_id = v_uid and b.blocked_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_block(uuid) from public;
revoke all on function public.chat_block(uuid) from anon;
revoke all on function public.chat_unblock(uuid) from public;
revoke all on function public.chat_unblock(uuid) from anon;
grant execute on function public.chat_block(uuid) to authenticated;
grant execute on function public.chat_unblock(uuid) to authenticated;

-- ————— Masquer les annonces —————
create or replace function public.chat_set_hide_announcements(p_hide boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.chat_preferences (user_id, hide_announcements)
  values (v_uid, coalesce(p_hide, false))
  on conflict (user_id)
    do update set hide_announcements = coalesce(p_hide, false), updated_at = now();

  return jsonb_build_object('ok', true, 'hide', coalesce(p_hide, false));
end;
$$;

revoke all on function public.chat_set_hide_announcements(boolean) from public;
revoke all on function public.chat_set_hide_announcements(boolean) from anon;
grant execute on function public.chat_set_hide_announcements(boolean) to authenticated;

-- ————— Non-lus (pastille de l'en-tête) —————
create or replace function public.chat_unread_count()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((
    select count(*)::int
      from public.chat_messages m
      join public.chat_preferences p on p.room_id = m.room_id and p.user_id = auth.uid()
     where m.id > p.last_read_message_id
       and m.user_id is distinct from auth.uid()
       and m.deleted_at is null
       and not public.chat_is_blocked(m.user_id)
  ), 0);
$$;

revoke all on function public.chat_unread_count() from public;
revoke all on function public.chat_unread_count() from anon;
grant execute on function public.chat_unread_count() to authenticated;

-- ————— Modération : supprimer un message —————
create or replace function public.chat_moderate_delete(p_message_id bigint, p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.chat_messages%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select * into v_row from public.chat_messages m where m.id = p_message_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  update public.chat_messages
     set deleted_at = now(), deleted_by = v_uid
   where id = p_message_id and deleted_at is null;

  update public.chat_announcements
     set status = 'removed'
   where message_id = p_message_id and status = 'active';

  update public.chat_reports
     set status = 'handled', reviewed_by = v_uid, reviewed_at = now()
   where message_id = p_message_id and status = 'open';

  insert into public.chat_audit (actor_id, action, target_user_id, message_id, room_id, reason)
  values (v_uid, 'message_deleted', v_row.user_id, p_message_id, v_row.room_id, nullif(btrim(p_reason), ''));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_moderate_delete(bigint, text) from public;
revoke all on function public.chat_moderate_delete(bigint, text) from anon;
grant execute on function public.chat_moderate_delete(bigint, text) to authenticated;

-- ————— Modération : réduire au silence —————
-- `p_minutes` nul = définitif. Toute sanction est journalisée.
create or replace function public.chat_mute(
  p_user_id uuid,
  p_minutes integer default 10,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_until timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  if p_user_id is null or p_user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'invalid_user');
  end if;

  if p_minutes is not null then
    v_until := now() + make_interval(mins => least(greatest(p_minutes, 1), 43200));
  end if;

  insert into public.chat_sanctions (user_id, moderator_id, kind, until, reason)
  values (p_user_id, v_uid, 'mute', v_until, left(coalesce(p_reason, ''), 200));

  insert into public.chat_audit (actor_id, action, target_user_id, reason, details)
  values (v_uid, 'mute', p_user_id, nullif(btrim(p_reason), ''),
          jsonb_build_object('until', v_until));

  return jsonb_build_object('ok', true, 'until', v_until);
end;
$$;

create or replace function public.chat_unmute(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  update public.chat_sanctions
     set lifted_at = now(), lifted_by = v_uid
   where user_id = p_user_id
     and lifted_at is null
     and (until is null or until > now());

  insert into public.chat_audit (actor_id, action, target_user_id, reason)
  values (v_uid, 'unmute', p_user_id, 'lifted');

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_mute(uuid, integer, text) from public;
revoke all on function public.chat_mute(uuid, integer, text) from anon;
revoke all on function public.chat_unmute(uuid) from public;
revoke all on function public.chat_unmute(uuid) from anon;
grant execute on function public.chat_mute(uuid, integer, text) to authenticated;
grant execute on function public.chat_unmute(uuid) to authenticated;

-- ————— Modération : retirer les annonces d'un joueur —————
create or replace function public.chat_clear_announcements(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  with removed as (
    update public.chat_announcements
       set status = 'removed'
     where user_id = p_user_id and status = 'active'
    returning message_id
  )
  update public.chat_messages m
     set deleted_at = now(), deleted_by = v_uid
    from removed r
   where m.id = r.message_id and m.deleted_at is null;
  get diagnostics v_count = row_count;

  insert into public.chat_audit (actor_id, action, target_user_id, reason, details)
  values (v_uid, 'announcements_cleared', p_user_id, 'moderation',
          jsonb_build_object('count', v_count));

  return jsonb_build_object('ok', true, 'removed', v_count);
end;
$$;

revoke all on function public.chat_clear_announcements(uuid) from public;
revoke all on function public.chat_clear_announcements(uuid) from anon;
grant execute on function public.chat_clear_announcements(uuid) to authenticated;

-- ————— Modération : salon en lecture seule —————
create or replace function public.chat_set_read_only(p_room_id integer, p_read_only boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  if not exists (select 1 from public.chat_rooms r where r.id = p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_room');
  end if;

  update public.chat_rooms r
     set read_only = coalesce(p_read_only, false)
   where r.id = p_room_id;

  insert into public.chat_audit (actor_id, action, room_id, details)
  values (v_uid, 'room_read_only', p_room_id,
          jsonb_build_object('read_only', coalesce(p_read_only, false)));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_set_read_only(integer, boolean) from public;
revoke all on function public.chat_set_read_only(integer, boolean) from anon;
grant execute on function public.chat_set_read_only(integer, boolean) to authenticated;

-- ————— Modération : traiter un signalement sans supprimer —————
create or replace function public.chat_resolve_report(p_report_id bigint, p_status text default 'handled')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text := coalesce(nullif(btrim(p_status), ''), 'handled');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  if v_status not in ('handled', 'dismissed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  update public.chat_reports
     set status = v_status, reviewed_by = v_uid, reviewed_at = now()
   where id = p_report_id and status = 'open';

  insert into public.chat_audit (actor_id, action, details)
  values (v_uid, 'report_' || v_status, jsonb_build_object('report_id', p_report_id));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.chat_resolve_report(bigint, text) from public;
revoke all on function public.chat_resolve_report(bigint, text) from anon;
grant execute on function public.chat_resolve_report(bigint, text) to authenticated;

-- ————— Modération : historique d'un joueur —————
-- Les derniers messages d'un joueur, y compris ceux qu'il a supprimés :
-- l'outil de modération doit pouvoir lire ce qui a été retiré.
create or replace function public.chat_admin_user_history(
  p_user_id uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  return jsonb_build_object(
    'ok', true,
    'username', (select p.username from public.profiles p where p.id = p_user_id),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'room_id', m.room_id,
               'kind', m.kind,
               'body', m.body,
               'created_at', m.created_at,
               'deleted_at', m.deleted_at
             ) order by m.id desc)
        from (
          select * from public.chat_messages
           where user_id = p_user_id
           order by id desc
           limit v_limit
        ) m
    ), '[]'::jsonb),
    'sanctions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'until', s.until,
               'reason', s.reason,
               'created_at', s.created_at,
               'lifted_at', s.lifted_at
             ) order by s.created_at desc)
        from public.chat_sanctions s
       where s.user_id = p_user_id
    ), '[]'::jsonb),
    'reports', coalesce((
      select count(*)::int from public.chat_reports r
       where r.message_id in (
         select m.id from public.chat_messages m where m.user_id = p_user_id
       )
    ), 0)
  );
end;
$$;

revoke all on function public.chat_admin_user_history(uuid, integer) from public;
revoke all on function public.chat_admin_user_history(uuid, integer) from anon;
grant execute on function public.chat_admin_user_history(uuid, integer) to authenticated;

-- ————— File de modération —————
-- Réservée aux administrateurs. Pour chaque signalement ouvert : le message,
-- les cinq messages qui l'entourent et le pseudo du rapporteur.
create or replace function public.chat_admin_queue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  return jsonb_build_object(
    'ok', true,
    'reports', coalesce((
      select jsonb_agg(entry order by entry ->> 'created_at' desc)
        from (
          select jsonb_build_object(
            'id', r.id,
            'reason', r.reason,
            'note', r.note,
            'created_at', r.created_at,
            'status', r.status,
            'reporter', rp.username,
            'message', (
              select jsonb_build_object(
                'id', m.id,
                'room_id', m.room_id,
                'kind', m.kind,
                'body', m.body,
                'created_at', m.created_at,
                'user_id', m.user_id,
                'username', mp.username,
                'avatar_card_id', mp.avatar_card_id,
                'deleted_at', m.deleted_at
              )
                from public.chat_messages m
                left join public.profiles mp on mp.id = m.user_id
               where m.id = r.message_id
            ),
            'before', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'id', t.id, 'username', t.username, 'body', t.body, 'kind', t.kind
                     ) order by t.id)
                from (
                  select m2.id, p2.username, m2.body, m2.kind
                    from public.chat_messages m2
                    left join public.profiles p2 on p2.id = m2.user_id
                    join public.chat_messages mref on mref.id = r.message_id
                   where m2.room_id = mref.room_id and m2.id < mref.id
                   order by m2.id desc
                   limit 5
                ) t
            ), '[]'::jsonb),
            'after', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'id', t.id, 'username', t.username, 'body', t.body, 'kind', t.kind
                     ) order by t.id)
                from (
                  select m2.id, p2.username, m2.body, m2.kind
                    from public.chat_messages m2
                    left join public.profiles p2 on p2.id = m2.user_id
                    join public.chat_messages mref on mref.id = r.message_id
                   where m2.room_id = mref.room_id and m2.id > mref.id
                   order by m2.id asc
                   limit 5
                ) t
            ), '[]'::jsonb)
          ) as entry
            from public.chat_reports r
            left join public.profiles rp on rp.id = r.reporter_id
           where r.status = 'open'
           order by r.created_at desc
           limit 30
        ) ranked
    ), '[]'::jsonb),
    'sanctions', coalesce((
      select jsonb_agg(entry order by entry ->> 'created_at' desc)
        from (
          select jsonb_build_object(
                   'id', s.id,
                   'user_id', s.user_id,
                   'username', p.username,
                   'until', s.until,
                   'reason', s.reason,
                   'created_at', s.created_at
                 ) as entry
            from public.chat_sanctions s
            left join public.profiles p on p.id = s.user_id
           where s.lifted_at is null
             and (s.until is null or s.until > now())
           order by s.created_at desc
           limit 50
        ) ranked
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(entry order by entry ->> 'created_at' desc)
        from (
          select jsonb_build_object(
                   'id', a.id,
                   'actor', p.username,
                   'action', a.action,
                   'target', tp.username,
                   'reason', a.reason,
                   'details', a.details,
                   'created_at', a.created_at
                 ) as entry
            from public.chat_audit a
            left join public.profiles p on p.id = a.actor_id
            left join public.profiles tp on tp.id = a.target_user_id
           order by a.created_at desc
           limit 50
        ) ranked
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.chat_admin_queue() from public;
revoke all on function public.chat_admin_queue() from anon;
grant execute on function public.chat_admin_queue() to authenticated;

-- ————— Diffuser les nouveaux messages —————
-- Realtime lit `chat_messages` : l'ajout à la publication est ce qui rend
-- la diffusion possible. Idempotent.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'chat_messages'
     ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;

-- ————— Contrôles finaux —————
do $$
declare
  v_policy integer;
begin
  if not exists (select 1 from pg_proc where proname = 'chat_send') then
    raise exception 'fonction chat_send absente';
  end if;

  if not exists (select 1 from pg_proc where proname = 'chat_history') then
    raise exception 'fonction chat_history absente';
  end if;

  if not exists (select 1 from pg_proc where proname = 'chat_admin_queue') then
    raise exception 'file de modération absente';
  end if;

  select count(*) into v_policy
    from pg_policies
   where schemaname = 'public' and tablename = 'chat_messages';
  if v_policy = 0 then
    raise exception 'policy de lecture des messages absente';
  end if;

  if has_table_privilege('authenticated', 'public.chat_messages', 'insert') then
    raise exception 'les joueurs peuvent écrire directement dans chat_messages';
  end if;

  if not has_table_privilege('authenticated', 'public.chat_messages', 'select') then
    raise exception 'Realtime ne pourra pas lire chat_messages';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'chat_messages'
  ) then
    raise notice 'publication supabase_realtime absente : diffusion à activer à la main.';
  end if;

  raise notice 'Agora en place : % salons, % message(s).',
    (select count(*) from public.chat_rooms),
    (select count(*) from public.chat_messages);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  do $$
--  begin
--    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
--      alter publication supabase_realtime drop table public.chat_messages;
--    end if;
--  end;
--  $$;
--
--  drop function if exists public.chat_admin_user_history(uuid, integer);
--  drop function if exists public.chat_resolve_report(bigint, text);
--  drop function if exists public.chat_admin_queue();
--  drop function if exists public.chat_set_read_only(integer, boolean);
--  drop function if exists public.chat_clear_announcements(uuid);
--  drop function if exists public.chat_unmute(uuid);
--  drop function if exists public.chat_mute(uuid, integer, text);
--  drop function if exists public.chat_moderate_delete(bigint, text);
--  drop function if exists public.chat_unread_count();
--  drop function if exists public.chat_set_hide_announcements(boolean);
--  drop function if exists public.chat_unblock(uuid);
--  drop function if exists public.chat_block(uuid);
--  drop function if exists public.chat_report(bigint, text, text);
--  drop function if exists public.chat_delete_message(bigint);
--  drop function if exists public.chat_withdraw_announcement(bigint);
--  drop function if exists public.chat_announce(text, text, integer, text);
--  drop function if exists public.chat_send(integer, text);
--  drop function if exists public.chat_history(integer, bigint, bigint, integer);
--  drop function if exists public.chat_ping(integer);
--  drop function if exists public.chat_set_room(integer);
--  drop function if exists public.chat_join(text, integer);
--  drop function if exists public.chat_state();
--  drop function if exists public.chat_enter_room(uuid, integer);
--  drop function if exists public.chat_rate_gate(text);
--  drop function if exists public.chat_mask_words(text);
--  drop function if exists public.chat_soften_shouting(text);
--  drop function if exists public.chat_clean_body(text, boolean);
--  drop function if exists public.chat_can_write();
--  drop function if exists public.chat_sweep();
--  drop function if exists public.chat_is_blocked(uuid);
--  drop function if exists public.chat_setting(text, numeric);
--
--  drop table if exists public.chat_banned_words;
--  drop table if exists public.chat_audit;
--  drop table if exists public.chat_sanctions;
--  drop table if exists public.chat_blocks;
--  drop table if exists public.chat_reports;
--  drop table if exists public.chat_preferences;
--  drop table if exists public.chat_presence;
--  drop table if exists public.chat_announcements;
--  drop table if exists public.chat_messages;
--  drop table if exists public.chat_rooms;
--
--  delete from public.game_config where key like 'chat_%';
-- ============================================================
