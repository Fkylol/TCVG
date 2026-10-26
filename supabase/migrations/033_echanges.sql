-- ============================================================
--  Migration 033 — L'AGORA, C4 : ÉCHANGES CARTE CONTRE CARTE
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Périmètre : propositions d'échange entre deux joueurs, contre-proposition,
--  séquestre de la carte offerte, acceptation atomique, expiration à 24 h,
--  historique immuable (`trades_swaps`) et notifications.
--
--  Principes :
--    • la carte offerte est retirée de la collection dès la proposition
--      (même séquestre que le marché : `collection.quantity` diminue) ;
--      elle revient automatiquement au refus, au retrait ou à l'expiration ;
--    • l'acceptation est UNE transaction : les deux copies changent de
--      propriétaire, ou rien ne bouge ;
--    • `trades_swaps` est immuable (aucune mise à jour, aucune suppression) et
--      `unique (offer_id)` empêche un double-clic de créer deux échanges ;
--    • aucun Pixels dans le chat : uniquement carte contre carte ;
--    • une carte retirée du catalogue annule les offres en cours et rend la
--      copie séquestrée.
--
--  Tables : chat_offers, trades_swaps, plus une préférence e-mail dans
--  `chat_preferences` et quatre nouveaux types de notifications.
-- ============================================================

-- ————— Réglages (modifiables en base, sans redéploiement) —————
insert into public.game_config (key, value) values
  ('chat_offer_hours', '24'::jsonb),
  ('chat_offers_active_max', '5'::jsonb),
  ('chat_offers_per_day', '10'::jsonb)
on conflict (key) do nothing;

-- ————— Préférence d'e-mail pour les propositions —————
-- L'e-mail reste facultatif : sans préférence, seule la notification in-site
-- est créée. Le destinataire n'est jamais exposé au client.
alter table public.chat_preferences
  add column if not exists offer_email boolean not null default false;

-- ————— Propositions d'échange —————
-- `announcement_id` passe à `null` si l'annonce disparaît : l'offre doit
-- survivre pour rendre la copie séquestrée.
create table if not exists public.chat_offers (
  id bigint generated always as identity primary key,
  announcement_id bigint references public.chat_announcements (id) on delete set null,
  proposer_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  offered_card_id text not null references public.cards (id) on delete cascade,
  offered_holo boolean not null default false,
  -- Misprint et date d'obtention de la copie séquestrée : rendus tels quels
  -- si la copie revient au joueur.
  offered_variant text,
  offered_first_at timestamptz,
  -- Nul quand l'offre répond à une annonce « Je cherche » : le chercheur
  -- n'a pas encore dit ce qu'il donne, il le fera en contre-proposant.
  requested_card_id text references public.cards (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 100),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'countered', 'expired', 'cancelled', 'removed')),
  -- Clé d'idempotence : un double-clic renvoie l'offre déjà créée.
  client_key uuid not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  constraint chat_offers_distinct_players check (proposer_id <> owner_id),
  constraint chat_offers_responded_fields check (
    (status = 'pending' and responded_at is null) or
    (status <> 'pending' and responded_at is not null)
  )
);

create index if not exists chat_offers_owner_idx
  on public.chat_offers (owner_id, status, created_at desc);

create index if not exists chat_offers_proposer_idx
  on public.chat_offers (proposer_id, status, created_at desc);

create index if not exists chat_offers_pending_idx
  on public.chat_offers (expires_at)
  where status = 'pending';

alter table public.chat_offers enable row level security;

revoke all on public.chat_offers from public;
revoke all on public.chat_offers from anon;
revoke all on public.chat_offers from authenticated;

-- ————— Historique des échanges —————
-- Même rôle que `trades` pour le marché : une ligne par échange accepté,
-- jamais modifiée ni supprimée.
create table if not exists public.trades_swaps (
  id bigint generated always as identity primary key,
  offer_id bigint not null unique references public.chat_offers (id) on delete cascade,
  proposer_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  proposer_card_id text not null,
  proposer_holo boolean not null default false,
  owner_card_id text not null,
  owner_holo boolean not null default false,
  accepted_at timestamptz not null default now()
);

create index if not exists trades_swaps_players_idx
  on public.trades_swaps (proposer_id, accepted_at desc);

alter table public.trades_swaps enable row level security;

revoke all on public.trades_swaps from public;
revoke all on public.trades_swaps from anon;
revoke all on public.trades_swaps from authenticated;

-- Refuse toute modification de l'historique, même depuis le SQL Editor.
create or replace function public.trades_swaps_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'trades_swaps est immuable' using errcode = 'P0001';
end;
$$;

revoke all on function public.trades_swaps_frozen() from public;
revoke all on function public.trades_swaps_frozen() from anon;
revoke all on function public.trades_swaps_frozen() from authenticated;

drop trigger if exists trades_swaps_frozen on public.trades_swaps;
create trigger trades_swaps_frozen
  before update or delete on public.trades_swaps
  for each row execute function public.trades_swaps_frozen();

-- ————— Notifications : quatre événements d'échange —————
alter table public.notifications
  add column if not exists swap_offer_id bigint references public.chat_offers (id) on delete set null;

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing',
    'swap_offer', 'swap_accepted', 'swap_declined', 'swap_expired'
  ));

-- ============================================================
--  Séquestre : deux primitives, utilisées par toutes les fonctions
-- ============================================================

-- Retire une copie de la collection. Sans copie disponible, renvoie
-- `{ ok: false, reason: 'need_copy' }` ; sinon la variante et la date
-- d'obtention, pour restitution exacte.
create or replace function public.chat_escrow_card(
  p_user uuid,
  p_card text,
  p_holo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty integer;
  v_holo_qty integer;
  v_variant text;
  v_first timestamptz;
begin
  select c.quantity, coalesce(c.holo_quantity, 0), c.variant, c.first_obtained_at
    into v_qty, v_holo_qty, v_variant, v_first
    from public.collection c
   where c.user_id = p_user and c.card_id = p_card
     for update;

  if not found or coalesce(v_qty, 0) < 1 then
    return jsonb_build_object('ok', false, 'reason', 'need_copy');
  end if;

  -- Une copie normale ne peut pas être une holo ; une holo doit en rester une.
  if coalesce(p_holo, false) then
    if v_holo_qty < 1 then
      return jsonb_build_object('ok', false, 'reason', 'need_copy');
    end if;
  elsif v_qty - v_holo_qty < 1 then
    return jsonb_build_object('ok', false, 'reason', 'need_copy');
  end if;

  if v_qty = 1 then
    -- Dernière copie : la contrainte `quantity > 0` interdit 0, on retire la
    -- ligne. La variante et la date voyagent dans l'offre pour la restitution.
    delete from public.collection where user_id = p_user and card_id = p_card;
  else
    update public.collection c
       set quantity = c.quantity - 1,
           holo_quantity = greatest(0, coalesce(c.holo_quantity, 0) - case when coalesce(p_holo, false) then 1 else 0 end)
     where c.user_id = p_user and c.card_id = p_card;
  end if;

  return jsonb_build_object(
    'ok', true,
    'variant', v_variant,
    'first_obtained_at', v_first
  );
end;
$$;

revoke all on function public.chat_escrow_card(uuid, text, boolean) from public;
revoke all on function public.chat_escrow_card(uuid, text, boolean) from anon;
revoke all on function public.chat_escrow_card(uuid, text, boolean) from authenticated;

-- Rend une copie séquestrée à son propriétaire, avec sa variante d'origine.
create or replace function public.chat_release_card(
  p_user uuid,
  p_card text,
  p_holo boolean,
  p_variant text,
  p_first timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.collection as col (user_id, card_id, quantity, holo_quantity, variant, first_obtained_at)
  values (
    p_user,
    p_card,
    1,
    case when coalesce(p_holo, false) then 1 else 0 end,
    p_variant,
    coalesce(p_first, now())
  )
  on conflict (user_id, card_id) do update
    set quantity = col.quantity + 1,
        holo_quantity = coalesce(col.holo_quantity, 0) + case when coalesce(p_holo, false) then 1 else 0 end,
        first_obtained_at = least(col.first_obtained_at, excluded.first_obtained_at),
        variant = coalesce(col.variant, excluded.variant);
end;
$$;

revoke all on function public.chat_release_card(uuid, text, boolean, text, timestamptz) from public;
revoke all on function public.chat_release_card(uuid, text, boolean, text, timestamptz) from anon;
revoke all on function public.chat_release_card(uuid, text, boolean, text, timestamptz) from authenticated;

-- ============================================================
--  Balayage : expiration, annonce close, carte retirée
-- ============================================================

/*
 * Rend les copies des offres devenues caduques et prévient les deux joueurs.
 * Appelée au début de chaque lecture ou action : l'état affiché est toujours
 * l'état réel, sans dépendre d'une tâche planifiée (voir README pour le cron
 * facultatif).
 */
create or replace function public.chat_offer_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.chat_offers%rowtype;
  v_reason text;
begin
  for v_offer in
    select o.* from public.chat_offers o
     where o.status = 'pending'
       for update skip locked
  loop
    v_reason := null;

    if v_offer.expires_at <= now() then
      v_reason := 'expired';
    elsif v_offer.announcement_id is null then
      v_reason := 'removed';
    elsif not exists (
      select 1 from public.chat_announcements a
       where a.id = v_offer.announcement_id and a.status = 'active'
    ) then
      v_reason := 'removed';
    elsif not exists (select 1 from public.cards k where k.id = v_offer.offered_card_id and k.active)
       or (
         v_offer.requested_card_id is not null
         and not exists (
           select 1 from public.cards k where k.id = v_offer.requested_card_id and k.active
         )
       )
    then
      v_reason := 'removed';
    end if;

    continue when v_reason is null;

    update public.chat_offers o
       set status = v_reason,
           responded_at = now()
     where o.id = v_offer.id;

    perform public.chat_release_card(
      v_offer.proposer_id,
      v_offer.offered_card_id,
      v_offer.offered_holo,
      v_offer.offered_variant,
      v_offer.offered_first_at
    );

    insert into public.notifications (user_id, kind, card_id, swap_offer_id)
    values
      (v_offer.proposer_id, 'swap_expired', v_offer.offered_card_id, v_offer.id),
      (v_offer.owner_id, 'swap_expired', v_offer.requested_card_id, v_offer.id);

    insert into public.chat_audit (actor_id, action, target_user_id, details)
    values (
      null,
      'swap_' || v_reason,
      v_offer.proposer_id,
      jsonb_build_object('offer_id', v_offer.id, 'owner', v_offer.owner_id)
    );
  end loop;
end;
$$;

revoke all on function public.chat_offer_sweep() from public;
revoke all on function public.chat_offer_sweep() from anon;
revoke all on function public.chat_offer_sweep() from authenticated;

-- ============================================================
--  Proposer un échange
-- ============================================================

/*
 * Le proposeur offre une de ses copies contre la carte d'une annonce
 * « J'échange ». Vérifications : annonce active et pas la sienne, aucun
 * blocage entre les deux, droit d'écrire (déblocage, sanction), carte
 * échangeable, limites par joueur, message de 100 caractères maximum.
 */
create or replace function public.chat_offer_create(
  p_announcement_id bigint,
  p_card_id text,
  p_holo boolean default false,
  p_message text default '',
  p_client_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ann public.chat_announcements%rowtype;
  v_existing public.chat_offers%rowtype;
  v_can jsonb;
  v_clean jsonb;
  v_escrow jsonb;
  v_card text := nullif(btrim(p_card_id), '');
  v_holo boolean := coalesce(p_holo, false);
  v_key uuid := coalesce(p_client_key, gen_random_uuid());
  v_body text := '';
  v_active integer;
  v_today integer;
  v_active_max integer;
  v_day_max integer;
  v_hours integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_offer_sweep();

  -- Idempotence : la même clé renvoie la même offre, sans nouveau séquestre.
  select * into v_existing from public.chat_offers o where o.client_key = v_key;
  if found then
    if v_existing.proposer_id <> v_uid then
      return jsonb_build_object('ok', false, 'reason', 'forbidden');
    end if;
    return jsonb_build_object('ok', true, 'id', v_existing.id, 'duplicate', true);
  end if;

  select * into v_ann from public.chat_announcements a where a.id = p_announcement_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  if v_ann.status <> 'active' or v_ann.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  if v_ann.user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'own_announcement');
  end if;

  if exists (
    select 1 from public.chat_blocks b
     where (b.blocker_id = v_ann.user_id and b.blocked_id = v_uid)
        or (b.blocker_id = v_uid and b.blocked_id = v_ann.user_id)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

  v_can := public.chat_can_write();
  if not coalesce((v_can ->> 'ok')::boolean, false) then
    return v_can;
  end if;

  if v_card is null or not exists (select 1 from public.cards k where k.id = v_card and k.active) then
    return jsonb_build_object('ok', false, 'reason', 'card_unavailable');
  end if;

  -- « J'échange » : on propose une autre carte contre celle de l'annonce.
  -- « Je cherche » : on apporte exactement la carte demandée, et c'est le
  -- chercheur qui choisira ce qu'il donne en retour.
  if v_ann.kind = 'have' then
    if v_card = v_ann.card_id then
      return jsonb_build_object('ok', false, 'reason', 'same_card');
    end if;
  elsif v_ann.kind = 'want' then
    if v_card <> v_ann.card_id then
      return jsonb_build_object('ok', false, 'reason', 'not_requested_card');
    end if;
  else
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  v_active_max := greatest(1, public.chat_setting('chat_offers_active_max', 5)::int);
  v_day_max := greatest(1, public.chat_setting('chat_offers_per_day', 10)::int);

  select count(*)::int into v_active
    from public.chat_offers o
   where o.proposer_id = v_uid and o.status = 'pending';

  if v_active >= v_active_max then
    return jsonb_build_object('ok', false, 'reason', 'too_many_offers', 'max', v_active_max);
  end if;

  select count(*)::int into v_today
    from public.chat_offers o
   where o.proposer_id = v_uid
     and o.created_at > now() - interval '24 hours';

  if v_today >= v_day_max then
    return jsonb_build_object('ok', false, 'reason', 'offer_daily_limit', 'max', v_day_max);
  end if;

  v_clean := public.chat_clean_body(p_message, true);
  if not coalesce((v_clean ->> 'ok')::boolean, false) then
    return v_clean;
  end if;
  v_body := coalesce(v_clean ->> 'body', '');

  if char_length(v_body) > 100 then
    return jsonb_build_object('ok', false, 'reason', 'offer_too_long');
  end if;

  v_escrow := public.chat_escrow_card(v_uid, v_card, v_holo);
  if not coalesce((v_escrow ->> 'ok')::boolean, false) then
    return v_escrow;
  end if;

  v_hours := greatest(1, public.chat_setting('chat_offer_hours', 24)::int);

  insert into public.chat_offers (
    announcement_id, proposer_id, owner_id,
    offered_card_id, offered_holo, offered_variant, offered_first_at,
    requested_card_id, message, client_key, expires_at
  )
  values (
    v_ann.id, v_uid, v_ann.user_id,
    v_card, v_holo, v_escrow ->> 'variant', (v_escrow ->> 'first_obtained_at')::timestamptz,
    case when v_ann.kind = 'have' then v_ann.card_id else null end,
    v_body, v_key, now() + make_interval(hours => v_hours)
  )
  returning id into v_id;

  insert into public.notifications (user_id, kind, card_id, swap_offer_id)
  values (v_ann.user_id, 'swap_offer', v_card, v_id);

  insert into public.chat_audit (actor_id, action, target_user_id, details)
  values (
    v_uid, 'swap_offer', v_ann.user_id,
    jsonb_build_object('offer_id', v_id, 'offered', v_card, 'requested', v_ann.card_id)
  );

  return jsonb_build_object('ok', true, 'id', v_id, 'owner', v_ann.user_id);
end;
$$;

revoke all on function public.chat_offer_create(bigint, text, boolean, text, uuid) from public;
revoke all on function public.chat_offer_create(bigint, text, boolean, text, uuid) from anon;
grant execute on function public.chat_offer_create(bigint, text, boolean, text, uuid) to authenticated;

-- ============================================================
--  Répondre : accepter, refuser, contre-proposer
-- ============================================================

/*
 * Seul le destinataire répond. L'acceptation est atomique : la copie du
 * propriétaire rejoint le proposeur, la copie séquestrée rejoint le
 * propriétaire, `trades_swaps` est écrite une seule fois. Le refus et la
 * contre-proposition rendent toujours la copie séquestrée.
 */
create or replace function public.chat_offer_respond(
  p_offer_id bigint,
  p_action text,
  p_counter_card_id text default null,
  p_counter_holo boolean default false,
  p_counter_message text default '',
  p_client_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.chat_offers%rowtype;
  v_existing public.chat_offers%rowtype;
  v_can jsonb;
  v_clean jsonb;
  v_take jsonb;
  v_card text := nullif(btrim(p_counter_card_id), '');
  v_holo boolean := false;
  v_body text := '';
  v_key uuid := coalesce(p_client_key, gen_random_uuid());
  v_hours integer;
  v_new_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_offer_sweep();

  select * into v_offer from public.chat_offers o where o.id = p_offer_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  if v_offer.owner_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if v_offer.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  if exists (
    select 1 from public.chat_blocks b
     where (b.blocker_id = v_offer.owner_id and b.blocked_id = v_offer.proposer_id)
        or (b.blocker_id = v_offer.proposer_id and b.blocked_id = v_offer.owner_id)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

  v_can := public.chat_can_write();
  if not coalesce((v_can ->> 'ok')::boolean, false) then
    return v_can;
  end if;

  -- Verrous de profils dans un ordre stable : deux échanges croisés entre les
  -- mêmes joueurs ne peuvent pas se bloquer mutuellement.
  perform 1 from public.profiles p
   where p.id in (v_offer.proposer_id, v_offer.owner_id)
   order by p.id
     for update;

  -- ————— Accepter —————
  if p_action = 'accept' then
    -- Une annonce « Je cherche » ne dit pas ce qui est donné en retour : le
    -- chercheur doit d'abord contre-proposer.
    if v_offer.requested_card_id is null then
      return jsonb_build_object('ok', false, 'reason', 'needs_counter');
    end if;

    if not exists (
      select 1 from public.cards k where k.id = v_offer.requested_card_id and k.active
    ) then
      return jsonb_build_object('ok', false, 'reason', 'card_unavailable');
    end if;

    -- Copie normale d'abord ; une holo seulement s'il n'y a rien d'autre.
    v_take := public.chat_escrow_card(v_uid, v_offer.requested_card_id, false);
    if coalesce((v_take ->> 'ok')::boolean, false) then
      v_holo := false;
    else
      v_take := public.chat_escrow_card(v_uid, v_offer.requested_card_id, true);
      if not coalesce((v_take ->> 'ok')::boolean, false) then
        return jsonb_build_object('ok', false, 'reason', 'need_copy');
      end if;
      v_holo := true;
    end if;

    -- Les deux copies changent de main dans la même transaction.
    perform public.chat_release_card(
      v_offer.proposer_id,
      v_offer.requested_card_id,
      v_holo,
      v_take ->> 'variant',
      (v_take ->> 'first_obtained_at')::timestamptz
    );

    perform public.chat_release_card(
      v_uid,
      v_offer.offered_card_id,
      v_offer.offered_holo,
      v_offer.offered_variant,
      v_offer.offered_first_at
    );

    insert into public.trades_swaps (
      offer_id, proposer_id, owner_id,
      proposer_card_id, proposer_holo, owner_card_id, owner_holo
    )
    values (
      v_offer.id, v_offer.proposer_id, v_uid,
      v_offer.offered_card_id, v_offer.offered_holo, v_offer.requested_card_id, v_holo
    );

    update public.chat_offers o
       set status = 'accepted', responded_at = now()
     where o.id = v_offer.id;

    insert into public.notifications (user_id, kind, card_id, swap_offer_id)
    values (v_offer.proposer_id, 'swap_accepted', v_offer.requested_card_id, v_offer.id);

    insert into public.chat_audit (actor_id, action, target_user_id, details)
    values (
      v_uid, 'swap_accept', v_offer.proposer_id,
      jsonb_build_object(
        'offer_id', v_offer.id,
        'gave', v_offer.requested_card_id,
        'gave_holo', v_holo,
        'got', v_offer.offered_card_id
      )
    );

    return jsonb_build_object(
      'ok', true,
      'id', v_offer.id,
      'gave', v_offer.requested_card_id,
      'got', v_offer.offered_card_id
    );
  end if;

  -- ————— Refuser —————
  if p_action = 'decline' then
    update public.chat_offers o
       set status = 'declined', responded_at = now()
     where o.id = v_offer.id;

    perform public.chat_release_card(
      v_offer.proposer_id,
      v_offer.offered_card_id,
      v_offer.offered_holo,
      v_offer.offered_variant,
      v_offer.offered_first_at
    );

    insert into public.notifications (user_id, kind, card_id, swap_offer_id)
    values (v_offer.proposer_id, 'swap_declined', v_offer.offered_card_id, v_offer.id);

    insert into public.chat_audit (actor_id, action, target_user_id, details)
    values (v_uid, 'swap_decline', v_offer.proposer_id, jsonb_build_object('offer_id', v_offer.id));

    return jsonb_build_object('ok', true, 'id', v_offer.id);
  end if;

  -- ————— Contre-proposer —————
  if p_action = 'counter' then
    if v_card is null or not exists (select 1 from public.cards k where k.id = v_card and k.active) then
      return jsonb_build_object('ok', false, 'reason', 'card_unavailable');
    end if;

    if v_card = v_offer.offered_card_id then
      return jsonb_build_object('ok', false, 'reason', 'same_card');
    end if;

    v_clean := public.chat_clean_body(p_counter_message, true);
    if not coalesce((v_clean ->> 'ok')::boolean, false) then
      return v_clean;
    end if;
    v_body := coalesce(v_clean ->> 'body', '');

    if char_length(v_body) > 100 then
      return jsonb_build_object('ok', false, 'reason', 'offer_too_long');
    end if;

    -- Idempotence : une contre-proposition déjà envoyée avec cette clé.
    select * into v_existing from public.chat_offers o where o.client_key = v_key;
    if found then
      if v_existing.proposer_id <> v_uid then
        return jsonb_build_object('ok', false, 'reason', 'forbidden');
      end if;
      return jsonb_build_object('ok', true, 'id', v_existing.id, 'duplicate', true);
    end if;

    v_take := public.chat_escrow_card(v_uid, v_card, coalesce(p_counter_holo, false));
    if not coalesce((v_take ->> 'ok')::boolean, false) then
      return v_take;
    end if;

    v_hours := greatest(1, public.chat_setting('chat_offer_hours', 24)::int);

    insert into public.chat_offers (
      announcement_id, proposer_id, owner_id,
      offered_card_id, offered_holo, offered_variant, offered_first_at,
      requested_card_id, message, client_key, expires_at
    )
    values (
      v_offer.announcement_id, v_uid, v_offer.proposer_id,
      v_card, coalesce(p_counter_holo, false), v_take ->> 'variant',
      (v_take ->> 'first_obtained_at')::timestamptz,
      v_offer.offered_card_id, v_body, v_key, now() + make_interval(hours => v_hours)
    )
    returning id into v_new_id;

    update public.chat_offers o
       set status = 'countered', responded_at = now()
     where o.id = v_offer.id;

    -- L'offre d'origine est close : la copie du premier proposeur revient.
    perform public.chat_release_card(
      v_offer.proposer_id,
      v_offer.offered_card_id,
      v_offer.offered_holo,
      v_offer.offered_variant,
      v_offer.offered_first_at
    );

    insert into public.notifications (user_id, kind, card_id, swap_offer_id)
    values (v_offer.proposer_id, 'swap_offer', v_card, v_new_id);

    insert into public.chat_audit (actor_id, action, target_user_id, details)
    values (
      v_uid, 'swap_counter', v_offer.proposer_id,
      jsonb_build_object('offer_id', v_offer.id, 'counter_id', v_new_id)
    );

    return jsonb_build_object('ok', true, 'id', v_new_id, 'counter', true);
  end if;

  return jsonb_build_object('ok', false, 'reason', 'invalid_action');
end;
$$;

revoke all on function public.chat_offer_respond(bigint, text, text, boolean, text, uuid) from public;
revoke all on function public.chat_offer_respond(bigint, text, text, boolean, text, uuid) from anon;
grant execute on function public.chat_offer_respond(bigint, text, text, boolean, text, uuid) to authenticated;

-- ————— Retirer sa propre proposition —————
create or replace function public.chat_offer_cancel(p_offer_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.chat_offers%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_offer_sweep();

  select * into v_offer from public.chat_offers o where o.id = p_offer_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  if v_offer.proposer_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if v_offer.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  update public.chat_offers o
     set status = 'cancelled', responded_at = now()
   where o.id = v_offer.id;

  perform public.chat_release_card(
    v_offer.proposer_id,
    v_offer.offered_card_id,
    v_offer.offered_holo,
    v_offer.offered_variant,
    v_offer.offered_first_at
  );

  insert into public.chat_audit (actor_id, action, target_user_id, details)
  values (
    v_uid, 'swap_cancel', v_offer.owner_id,
    jsonb_build_object('offer_id', v_offer.id)
  );

  return jsonb_build_object('ok', true, 'id', v_offer.id);
end;
$$;

revoke all on function public.chat_offer_cancel(bigint) from public;
revoke all on function public.chat_offer_cancel(bigint) from anon;
grant execute on function public.chat_offer_cancel(bigint) to authenticated;

-- ============================================================
--  Lecture pour l'interface
-- ============================================================

/*
 * Offres reçues et envoyées (les plus récentes), plus la préférence e-mail.
 * Les payloads ne contiennent que pseudo, avatar et identifiants de cartes :
 * aucune adresse, aucun identifiant privé.
 */
create or replace function public.chat_offer_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_incoming jsonb;
  v_outgoing jsonb;
  v_email boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.chat_offer_sweep();

  select coalesce(p.offer_email, false) into v_email
    from public.chat_preferences p
   where p.user_id = v_uid;

  select coalesce(jsonb_agg(entry order by entry ->> 'created_at' desc), '[]'::jsonb)
    into v_incoming
    from (
      select jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'message', o.message,
        'created_at', o.created_at,
        'expires_at', o.expires_at,
        'offered_card_id', o.offered_card_id,
        'offered_holo', o.offered_holo,
        'requested_card_id', o.requested_card_id,
        'proposer', coalesce(pr.username, 'Joueur'),
        'proposer_avatar', pr.avatar_card_id,
        'proposer_frame', coalesce(pr.frame, 'steel'),
        'owner', coalesce(po.username, 'Joueur'),
        'owner_avatar', po.avatar_card_id,
        'owner_frame', coalesce(po.frame, 'steel'),
        'direction', 'in'
      ) as entry
        from public.chat_offers o
        left join public.profiles pr on pr.id = o.proposer_id
        left join public.profiles po on po.id = o.owner_id
       where o.owner_id = v_uid
       order by o.created_at desc
       limit 40
    ) listed;

  select coalesce(jsonb_agg(entry order by entry ->> 'created_at' desc), '[]'::jsonb)
    into v_outgoing
    from (
      select jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'message', o.message,
        'created_at', o.created_at,
        'expires_at', o.expires_at,
        'offered_card_id', o.offered_card_id,
        'offered_holo', o.offered_holo,
        'requested_card_id', o.requested_card_id,
        'proposer', coalesce(pr.username, 'Joueur'),
        'proposer_avatar', pr.avatar_card_id,
        'proposer_frame', coalesce(pr.frame, 'steel'),
        'owner', coalesce(po.username, 'Joueur'),
        'owner_avatar', po.avatar_card_id,
        'owner_frame', coalesce(po.frame, 'steel'),
        'direction', 'out'
      ) as entry
        from public.chat_offers o
        left join public.profiles pr on pr.id = o.proposer_id
        left join public.profiles po on po.id = o.owner_id
       where o.proposer_id = v_uid
       order by o.created_at desc
       limit 40
    ) listed;

  return jsonb_build_object(
    'ok', true,
    'email', coalesce(v_email, false),
    'incoming', v_incoming,
    'outgoing', v_outgoing
  );
end;
$$;

revoke all on function public.chat_offer_list() from public;
revoke all on function public.chat_offer_list() from anon;
grant execute on function public.chat_offer_list() to authenticated;

-- ————— Préférence d'e-mail —————
create or replace function public.chat_set_offer_email(p_enabled boolean)
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

  insert into public.chat_preferences as pref (user_id, offer_email, updated_at)
  values (v_uid, coalesce(p_enabled, false), now())
  on conflict (user_id) do update
    set offer_email = excluded.offer_email,
        updated_at = now();

  return jsonb_build_object('ok', true, 'email', coalesce(p_enabled, false));
end;
$$;

revoke all on function public.chat_set_offer_email(boolean) from public;
revoke all on function public.chat_set_offer_email(boolean) from anon;
grant execute on function public.chat_set_offer_email(boolean) to authenticated;

/*
 * Destinataire d'un e-mail de proposition : réservé au proposeur, pour
 * l'offre qu'il vient de créer. `recipient` n'est utilisé que côté serveur
 * (recherche de l'adresse via l'API d'administration) et n'est jamais rendu
 * au navigateur.
 */
create or replace function public.chat_offer_notice(p_offer_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.chat_offers%rowtype;
  v_enabled boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_offer from public.chat_offers o where o.id = p_offer_id;

  if not found or v_offer.proposer_id <> v_uid or v_offer.status <> 'pending' then
    return jsonb_build_object('ok', false, 'email', false);
  end if;

  select coalesce(p.offer_email, false) into v_enabled
    from public.chat_preferences p
   where p.user_id = v_offer.owner_id;

  return jsonb_build_object(
    'ok', true,
    'email', coalesce(v_enabled, false),
    'recipient', v_offer.owner_id,
    'owner', (
      select coalesce(pr.username, 'Joueur') from public.profiles pr where pr.id = v_offer.owner_id
    ),
    'offered_card_id', v_offer.offered_card_id,
    'requested_card_id', v_offer.requested_card_id
  );
end;
$$;

revoke all on function public.chat_offer_notice(bigint) from public;
revoke all on function public.chat_offer_notice(bigint) from anon;
grant execute on function public.chat_offer_notice(bigint) to authenticated;

-- ============================================================
--  Vérification
-- ============================================================
do $$
begin
  if not exists (select 1 from public.chat_preferences limit 0) then
    raise notice 'chat_preferences introuvable : applique la migration 031 d''abord.';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'chat_offers'
  ) then
    raise exception 'table chat_offers absente';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'trades_swaps'
  ) then
    raise exception 'table trades_swaps absente';
  end if;

  raise notice 'Échanges en place : % offre(s) en attente, % échange(s) accepté(s).',
    (select count(*) from public.chat_offers where status = 'pending'),
    (select count(*) from public.trades_swaps);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop trigger if exists trades_swaps_frozen on public.trades_swaps;
--  drop function if exists public.trades_swaps_frozen();
--
--  drop function if exists public.chat_offer_notice(bigint);
--  drop function if exists public.chat_set_offer_email(boolean);
--  drop function if exists public.chat_offer_list();
--  drop function if exists public.chat_offer_cancel(bigint);
--  drop function if exists public.chat_offer_respond(bigint, text, text, boolean, text, uuid);
--  drop function if exists public.chat_offer_create(bigint, text, boolean, text, uuid);
--  drop function if exists public.chat_offer_sweep();
--  drop function if exists public.chat_release_card(uuid, text, boolean, text, timestamptz);
--  drop function if exists public.chat_escrow_card(uuid, text, boolean);
--
--  alter table public.notifications drop column if exists swap_offer_id;
--  alter table public.notifications drop constraint if exists notifications_kind_check;
--  alter table public.notifications add constraint notifications_kind_check
--    check (kind in ('listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing'));
--
--  alter table public.chat_preferences drop column if exists offer_email;
--
--  drop table if exists public.trades_swaps;
--  drop table if exists public.chat_offers;
--
--  delete from public.game_config where key like 'chat_offer%';
-- ============================================================
