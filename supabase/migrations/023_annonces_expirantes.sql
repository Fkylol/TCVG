-- ============================================================
--  Migration 023 — MARCHÉ : annonces expirantes et prix modifiable
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Principe :
--    • une annonce expire après `market_listing_days` jours (7 par défaut) et
--      la copie revient automatiquement au vendeur ;
--    • l'expiration est vérifiée paresseusement : `market_expire_listings()`
--      balaie les annonces échues, et l'achat comme l'appariement refusent une
--      annonce expirée même si le balayage n'est pas encore passé ;
--    • le vendeur peut changer le prix d'une annonce active, dans les mêmes
--      bornes que `market_quote()` ; si un ordre d'achat attend et que le
--      nouveau prix y entre, la vente est exécutée dans la même transaction.
-- ============================================================

-- ————— Réglages —————
insert into public.game_config (key, value) values
  ('market_listing_days', '7'::jsonb)
on conflict (key) do nothing;

-- ————— Colonnes d'expiration —————
-- `expires_at` nul = annonce sans échéance (anciennes lignes non balayées).
-- `cancel_reason` distingue un retrait volontaire d'une expiration ou d'une
-- purge de carte retirée : le marché et le journal parlent le même langage.
alter table public.market_listings
  add column if not exists expires_at timestamptz,
  add column if not exists cancel_reason text;

create index if not exists market_listings_expiry_idx
  on public.market_listings (status, expires_at)
  where status = 'active';

-- Les annonces déjà en ligne reçoivent une échéance calculée depuis leur mise
-- en vente : rien n'expire d'un coup au moment de la migration.
update public.market_listings
   set expires_at = created_at + make_interval(days => coalesce(
         (select (value #>> '{}')::int from public.game_config where key = 'market_listing_days'), 7
       ))
 where expires_at is null;

-- ————— Échéance posée à la création —————
create or replace function public.market_listing_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
begin
  if new.expires_at is not null then
    return new;
  end if;

  v_days := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'market_listing_days'), 7
  );

  -- Une valeur aberrante (0 ou négative) reviendrait à expirer instantanément.
  new.expires_at := now() + make_interval(days => greatest(v_days, 1));
  return new;
end;
$$;

drop trigger if exists market_listing_expiry on public.market_listings;
create trigger market_listing_expiry
  before insert on public.market_listings
  for each row execute function public.market_listing_expiry();

-- ————— Balayage des annonces échues —————
-- Idempotent : deux appels concurrents se partagent le travail (`skip locked`)
-- et chaque annonce n'est rendue qu'une fois. Appelé au chargement du marché
-- et de la fiche d'une carte.
create or replace function public.market_expire_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing record;
  v_count integer := 0;
begin
  for v_listing in
    select l.id, l.seller_id, l.card_id, l.holo
      from public.market_listings l
     where l.status = 'active'
       and l.expires_at is not null
       and l.expires_at <= now()
       for update skip locked
  loop
    update public.market_listings
       set status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = 'expired'
     where id = v_listing.id;

    insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
    values (v_listing.seller_id, v_listing.card_id, 1, case when v_listing.holo then 1 else 0 end)
    on conflict (user_id, card_id) do update
      set quantity = col.quantity + 1,
          holo_quantity = col.holo_quantity + case when v_listing.holo then 1 else 0 end;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.market_expire_listings() from public;
revoke all on function public.market_expire_listings() from anon;
grant execute on function public.market_expire_listings() to authenticated;

-- ————— Journal : la raison d'annulation est écrite —————
create or replace function public.market_audit_listings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.market_audit
      (actor_id, action, card_id, listing_id, amount, details)
    values (
      new.seller_id, 'listing_created', new.card_id, new.id, new.price_pixels,
      jsonb_build_object('holo', new.holo, 'expires_at', new.expires_at)
    );
    return null;
  end if;

  if new.status is distinct from old.status or new.price_pixels is distinct from old.price_pixels then
    insert into public.market_audit
      (actor_id, action, card_id, listing_id, amount, details)
    values (
      case when new.status = 'sold' then new.buyer_id else new.seller_id end,
      case
        when new.status is distinct from old.status then 'listing_' || new.status
        else 'listing_price'
      end,
      new.card_id,
      new.id,
      new.price_pixels,
      jsonb_build_object(
        'holo', new.holo,
        'fee', new.fee_pixels,
        'payout', new.seller_payout,
        'seller_id', new.seller_id,
        'cancel_reason', new.cancel_reason,
        'previous_price', old.price_pixels
      )
    );
  end if;

  return null;
end;
$$;

-- ————— Annonces lisibles : échéance et raison —————
-- Le type de retour change : la fonction doit être recréée. Une annonce échue
-- n'est plus publique, même avant le balayage ; le vendeur la voit toujours.
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

-- ————— Achat : une annonce échue est refusée —————
create or replace function public.buy_listing(p_listing_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.market_listings%rowtype;
  v_commission numeric;
  v_fee integer;
  v_payout integer;
  v_buyer_pixels integer;
  v_seller_pixels integer;
  v_profile_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Verrouille l'annonce : deux acheteurs simultanés ne peuvent pas la gagner.
  select * into v_listing
    from public.market_listings
   where id = p_listing_id
     for update;

  if not found or v_listing.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  -- Échue mais pas encore balayée : la copie appartient toujours au vendeur.
  if v_listing.expires_at is not null and v_listing.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_listing.seller_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'own_listing');
  end if;

  -- Deux verrous de profils, toujours dans l'ordre des identifiants : deux
  -- achats croisés ne peuvent pas se bloquer mutuellement.
  for v_profile_id in
    select id from public.profiles
     where id in (v_uid, v_listing.seller_id)
     order by id
       for update
  loop
    null;
  end loop;

  select pixels into v_buyer_pixels from public.profiles where id = v_uid;
  select pixels into v_seller_pixels from public.profiles where id = v_listing.seller_id;

  if v_buyer_pixels is null or v_seller_pixels is null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  if v_buyer_pixels < v_listing.price_pixels then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_pixels',
      'pixels', v_buyer_pixels,
      'price', v_listing.price_pixels
    );
  end if;

  v_commission := coalesce(
    (select (value #>> '{}')::numeric from public.game_config where key = 'market_commission'), 0.05
  );
  v_fee := ceil(v_listing.price_pixels * v_commission)::int;
  v_payout := v_listing.price_pixels - v_fee;

  update public.profiles
     set pixels = pixels - v_listing.price_pixels
   where id = v_uid
  returning pixels into v_buyer_pixels;

  update public.profiles
     set pixels = pixels + v_payout
   where id = v_listing.seller_id;

  insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
  values (v_uid, v_listing.card_id, 1, case when v_listing.holo then 1 else 0 end)
  on conflict (user_id, card_id) do update
    set quantity = col.quantity + 1,
        holo_quantity = col.holo_quantity + case when v_listing.holo then 1 else 0 end;

  update public.market_listings
     set status = 'sold',
         buyer_id = v_uid,
         sold_at = now(),
         fee_pixels = v_fee,
         seller_payout = v_payout
   where id = p_listing_id;

  insert into public.pixel_transactions (user_id, amount, reason)
  values (v_uid, -v_listing.price_pixels, 'achat_marche');

  insert into public.pixel_transactions (user_id, amount, reason)
  values (v_listing.seller_id, v_payout, 'vente_marche');

  return jsonb_build_object(
    'ok', true,
    'card_id', v_listing.card_id,
    'holo', v_listing.holo,
    'price', v_listing.price_pixels,
    'fee', v_fee,
    'payout', v_payout,
    'pixels', v_buyer_pixels
  );
end;
$$;

revoke all on function public.buy_listing(bigint) from public;
revoke all on function public.buy_listing(bigint) from anon;
grant execute on function public.buy_listing(bigint) to authenticated;

-- ————— Appariement : jamais une annonce échue —————
create or replace function public.match_card_orders(p_card_id text, p_holo boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.buy_orders%rowtype;
  v_listing public.market_listings%rowtype;
  v_commission numeric;
  v_fee integer;
  v_payout integer;
  v_surplus integer;
  v_pixels integer;
  v_matched integer := 0;
begin
  v_commission := coalesce(
    (select (value #>> '{}')::numeric from public.game_config where key = 'market_commission'), 0.05
  );

  loop
    select * into v_order
      from public.buy_orders
     where card_id = p_card_id
       and holo = p_holo
       and status = 'active'
       and reserved_pixels > 0
     order by max_price desc, created_at asc
     limit 1
       for update skip locked;

    -- Plus aucun ordre libre : le reste attendra la prochaine annonce.
    if not found then
      exit;
    end if;

    select * into v_listing
      from public.market_listings
     where card_id = p_card_id
       and holo = p_holo
       and status = 'active'
       and price_pixels <= v_order.max_price
       and seller_id <> v_order.buyer_id
       and (expires_at is null or expires_at > now())
     order by price_pixels asc, created_at asc
     limit 1
       for update skip locked;

    -- L'ordre le plus généreux ne trouve rien : aucun ordre moins élevé non plus.
    if not found then
      exit;
    end if;

    v_fee := ceil(v_listing.price_pixels * v_commission)::int;
    v_payout := v_listing.price_pixels - v_fee;
    v_surplus := v_order.reserved_pixels - v_listing.price_pixels;

    -- La carte rejoint l'acheteur.
    insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
    values (v_order.buyer_id, v_listing.card_id, 1, case when v_listing.holo then 1 else 0 end)
    on conflict (user_id, card_id) do update
      set quantity = col.quantity + 1,
          holo_quantity = col.holo_quantity + case when v_listing.holo then 1 else 0 end;

    -- L'annonce est vendue, aux conditions de l'annonce (pas du prix max).
    update public.market_listings
       set status = 'sold',
           buyer_id = v_order.buyer_id,
           sold_at = now(),
           fee_pixels = v_fee,
           seller_payout = v_payout
     where id = v_listing.id;

    -- L'ordre est exécuté : plus rien n'est réservé pour lui.
    update public.buy_orders
       set status = 'filled',
           filled_at = now(),
           filled_listing_id = v_listing.id,
           reserved_pixels = 0
     where id = v_order.id;

    -- Le surplus de la réservation repart chez l'acheteur.
    if v_surplus > 0 then
      update public.profiles
         set pixels = pixels + v_surplus
       where id = v_order.buyer_id;

      insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
      values (v_order.buyer_id, v_surplus, 'remboursement_ordre', 'buy_order', v_order.id);
    end if;

    -- Le vendeur encaisse le net ; la commission est détruite (puits à Pixels).
    update public.profiles
       set pixels = pixels + v_payout
     where id = v_listing.seller_id;

    insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
    values (v_listing.seller_id, v_payout, 'vente_marche', 'listing', v_listing.id);

    insert into public.trades
      (card_id, holo, listing_id, order_id, buyer_id, seller_id, price, fee, seller_payout)
    values
      (v_listing.card_id, v_listing.holo, v_listing.id, v_order.id,
       v_order.buyer_id, v_listing.seller_id, v_listing.price_pixels, v_fee, v_payout);

    select pixels into v_pixels from public.profiles where id = v_order.buyer_id;

    v_matched := v_matched + 1;
  end loop;

  return v_matched;
end;
$$;

revoke all on function public.match_card_orders(text, boolean) from public;
revoke all on function public.match_card_orders(text, boolean) from anon;
revoke all on function public.match_card_orders(text, boolean) from authenticated;

-- ————— Changer le prix d'une annonce —————
-- Mêmes bornes que la mise en vente. Si un ordre d'achat attend et que le
-- nouveau prix y entre, la vente part immédiatement (même transaction).
create or replace function public.update_listing_price(
  p_listing_id bigint,
  p_price integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.market_listings%rowtype;
  v_quote jsonb;
  v_min integer;
  v_max integer;
  v_reference integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_price is null or p_price < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_price');
  end if;

  select * into v_listing
    from public.market_listings
   where id = p_listing_id
     for update;

  -- Pas de fuite d'information : l'annonce d'un autre joueur est « introuvable ».
  if not found or v_listing.seller_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  if v_listing.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  if v_listing.expires_at is not null and v_listing.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_listing.price_pixels = p_price then
    return jsonb_build_object(
      'ok', true, 'price', p_price, 'unchanged', true,
      'status', 'active', 'card_id', v_listing.card_id
    );
  end if;

  v_quote := public.market_quote(v_listing.card_id, v_listing.holo);
  v_min := coalesce((v_quote ->> 'min')::int, 0);
  v_max := coalesce((v_quote ->> 'max')::int, 0);
  v_reference := coalesce((v_quote ->> 'reference')::int, 0);

  if p_price < v_min or p_price > v_max then
    return jsonb_build_object(
      'ok', false, 'reason', 'price_out_of_bounds',
      'min', v_min, 'max', v_max, 'reference', v_reference
    );
  end if;

  update public.market_listings
     set price_pixels = p_price
   where id = p_listing_id;

  -- Le trigger d'audit écrit une ligne `listing_price` avec l'ancien prix.

  perform public.match_card_orders(v_listing.card_id, v_listing.holo);

  select status into v_status from public.market_listings where id = p_listing_id;

  return jsonb_build_object(
    'ok', true,
    'price', p_price,
    'card_id', v_listing.card_id,
    'min', v_min,
    'max', v_max,
    'reference', v_reference,
    'status', v_status,
    'sold', v_status = 'sold'
  );
end;
$$;

revoke all on function public.update_listing_price(bigint, integer) from public;
revoke all on function public.update_listing_price(bigint, integer) from anon;
grant execute on function public.update_listing_price(bigint, integer) to authenticated;

-- ————— Contrôles finaux —————
do $$
declare
  v_days integer;
begin
  select (value #>> '{}')::int into v_days
    from public.game_config where key = 'market_listing_days';
  if v_days is null or v_days < 1 then
    raise exception 'réglage market_listing_days absent ou invalide';
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'market_listings'
                    and column_name = 'expires_at') then
    raise exception 'colonne expires_at absente';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'market_listing_expiry') then
    raise exception 'trigger d''échéance absent';
  end if;

  if not exists (select 1 from pg_proc where proname = 'update_listing_price')
     or not exists (select 1 from pg_proc where proname = 'market_expire_listings') then
    raise exception 'fonctions d''expiration ou de prix absentes';
  end if;

  raise notice 'Annonces expirantes en place (% jours), % annonces actives.',
    v_days,
    (select count(*) from public.market_listings where status = 'active');
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop function if exists public.update_listing_price(bigint, integer);
--  drop function if exists public.market_expire_listings();
--  drop trigger if exists market_listing_expiry on public.market_listings;
--  drop function if exists public.market_listing_expiry();
--  delete from public.game_config where key = 'market_listing_days';
--  alter table public.market_listings
--    drop column if exists expires_at,
--    drop column if exists cancel_reason;
--  -- `market_listings()` retrouve sa signature de 011 (sans les deux colonnes)
--  -- en rejouant create or replace de la migration 011 ; `buy_listing` et
--  -- `match_card_orders` redeviennent permissifs en rejouant 011 / 021.
--  -- `market_audit_listings()` retrouve sa version de 022 en la rejouant.
-- ============================================================
