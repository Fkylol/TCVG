-- ============================================================
--  Migration 011 — ÉTAPE 5 : marché entre joueurs
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Règles appliquées :
--    • seuls les doublons se vendent : une copie reste toujours au vendeur ;
--    • cartes normales et holos vendables, les holos dans une fourchette 3 × ;
--    • bornes dynamiques : médiane des ventes récentes de la carte, encadrée
--      par un plancher et un plafond par rareté (modifiables en base) ;
--    • commission de 5 % prélevée à la vente, versée à personne (puits) ;
--    • achat, annulation et création d'annonce sont atomiques ;
--    • une carte en vente est retirée de la collection (escrow) et y revient
--      si l'annonce est annulée.
-- ============================================================

-- ————— Valeurs par rareté (garde-fous et base de départ) —————
create table if not exists public.market_prices (
  rarity text primary key check (rarity in ('C', 'R', 'SR', 'UR', 'L')),
  -- Valeur de référence tant qu'il n'y a pas assez de ventes.
  base_pixels integer not null check (base_pixels > 0),
  -- Multiplicateur appliqué aux holos pour la base et les garde-fous.
  holo_multiplier numeric not null default 3 check (holo_multiplier >= 1),
  min_pixels integer not null check (min_pixels > 0),
  max_pixels integer not null check (max_pixels >= min_pixels),
  updated_at timestamptz not null default now()
);

insert into public.market_prices (rarity, base_pixels, min_pixels, max_pixels) values
  ('C', 8, 2, 25),
  ('R', 25, 5, 75),
  ('SR', 80, 15, 250),
  ('UR', 300, 60, 1000),
  ('L', 1000, 200, 3000)
on conflict (rarity) do nothing;

alter table public.market_prices enable row level security;

drop policy if exists "market_prices: lecture publique" on public.market_prices;
create policy "market_prices: lecture publique"
  on public.market_prices for select
  using (true);

revoke all on public.market_prices from anon, authenticated;
grant select on public.market_prices to authenticated;

-- ————— Réglages du marché —————
insert into public.game_config (key, value) values
  ('market_commission', '0.05'::jsonb),
  ('market_spread_low', '0.5'::jsonb),
  ('market_spread_high', '2'::jsonb),
  ('market_history_days', '30'::jsonb),
  ('market_min_sales', '3'::jsonb),
  ('market_max_active', '10'::jsonb)
on conflict (key) do nothing;

-- ————— Annonces —————
-- `price_pixels` est le prix payé par l'acheteur. `fee_pixels` (5 %) et
-- `seller_payout` sont figés à la vente pour garder l'historique exact.
create table if not exists public.market_listings (
  id bigint generated always as identity primary key,
  seller_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.cards (id) on delete cascade,
  holo boolean not null default false,
  price_pixels integer not null check (price_pixels > 0),
  status text not null default 'active'
    check (status in ('active', 'sold', 'cancelled')),
  buyer_id uuid references auth.users (id) on delete set null,
  fee_pixels integer check (fee_pixels is null or fee_pixels >= 0),
  seller_payout integer check (seller_payout is null or seller_payout >= 0),
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  cancelled_at timestamptz,
  constraint market_listings_status_fields check (
    (status = 'active' and sold_at is null and cancelled_at is null) or
    (status = 'sold' and sold_at is not null and cancelled_at is null) or
    (status = 'cancelled' and sold_at is null and cancelled_at is not null)
  )
);

create index if not exists market_listings_active_idx
  on public.market_listings (status, created_at desc);

create index if not exists market_listings_card_sales_idx
  on public.market_listings (card_id, holo, sold_at desc)
  where status = 'sold';

create index if not exists market_listings_seller_idx
  on public.market_listings (seller_id, created_at desc);

alter table public.market_listings enable row level security;

-- Un joueur voit toutes les annonces actives et vendues, plus ses propres
-- annonces annulées. Les écritures passent uniquement par les fonctions.
drop policy if exists "market_listings: lecture" on public.market_listings;
create policy "market_listings: lecture"
  on public.market_listings for select
  using (status in ('active', 'sold') or seller_id = auth.uid());

revoke all on public.market_listings from anon, authenticated;
grant select on public.market_listings to authenticated;

-- ————— Devis dynamique d'une carte —————
-- Référence = médiane des ventes des `market_history_days` derniers jours
-- (au moins `market_min_sales` ventes), sinon la base de la rareté.
-- La fourchette vaut [référence × spread_low, référence × spread_high],
-- bornée par le plancher et le plafond de la rareté. Une holo multiplie la
-- base et les garde-fous par `holo_multiplier`.
create or replace function public.market_quote(
  p_card_id text,
  p_holo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_rarity text;
  v_config public.market_prices%rowtype;
  v_holo boolean := coalesce(p_holo, false);
  v_history integer;
  v_min_sales integer;
  v_low numeric;
  v_high numeric;
  v_sales integer;
  v_median double precision;
  v_reference numeric;
  v_floor_min integer;
  v_floor_max integer;
  v_min integer;
  v_max integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select rarity into v_rarity from public.cards where id = p_card_id;
  if not found then
    raise exception 'unknown_card' using errcode = 'P0002';
  end if;

  select * into v_config from public.market_prices where rarity = v_rarity;
  if not found then
    raise exception 'rarity_not_priced' using errcode = 'P0002';
  end if;

  v_history := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'market_history_days'), 30
  );
  v_min_sales := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'market_min_sales'), 3
  );
  v_low := coalesce(
    (select (value #>> '{}')::numeric from public.game_config where key = 'market_spread_low'), 0.5
  );
  v_high := coalesce(
    (select (value #>> '{}')::numeric from public.game_config where key = 'market_spread_high'), 2
  );

  select
    count(*)::int,
    percentile_cont(0.5) within group (order by l.price_pixels)
    into v_sales, v_median
    from public.market_listings l
   where l.card_id = p_card_id
     and l.holo = v_holo
     and l.status = 'sold'
     and l.sold_at >= now() - make_interval(days => v_history);

  if v_sales >= v_min_sales and v_median is not null then
    v_reference := v_median;
  else
    v_reference := v_config.base_pixels
      * case when v_holo then v_config.holo_multiplier else 1 end;
  end if;

  if v_holo then
    v_floor_min := ceil(v_config.min_pixels * v_config.holo_multiplier)::int;
    v_floor_max := floor(v_config.max_pixels * v_config.holo_multiplier)::int;
  else
    v_floor_min := v_config.min_pixels;
    v_floor_max := v_config.max_pixels;
  end if;

  -- La référence reste dans les garde-fous avant d'appliquer l'écart.
  v_reference := least(greatest(v_reference, v_floor_min), v_floor_max);
  v_min := greatest(v_floor_min, ceil(v_reference * v_low)::int);
  v_max := least(v_floor_max, floor(v_reference * v_high)::int);
  if v_max < v_min then
    v_max := v_min;
  end if;

  return jsonb_build_object(
    'ok', true,
    'card_id', p_card_id,
    'rarity', v_rarity,
    'holo', v_holo,
    'reference', round(v_reference)::int,
    'min', v_min,
    'max', v_max,
    'sales', v_sales
  );
end;
$$;

revoke all on function public.market_quote(text, boolean) from public;
revoke all on function public.market_quote(text, boolean) from anon;
grant execute on function public.market_quote(text, boolean) to authenticated;

-- ————— Annonces lisibles : actives + les miennes —————
-- `profiles` n'est lisible que par son propriétaire : cette fonction expose
-- uniquement le pseudo du vendeur, jamais son email ni ses autres données.
create or replace function public.market_listings()
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
  genres text[]
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
    ) as genres
  from public.market_listings l
  join public.profiles p on p.id = l.seller_id
  where l.status = 'active' or l.seller_id = auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.market_listings() from public;
revoke all on function public.market_listings() from anon;
grant execute on function public.market_listings() to authenticated;

-- ————— Mettre une copie en vente —————
create or replace function public.create_listing(
  p_card_id text,
  p_holo boolean,
  p_price integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_holo boolean := coalesce(p_holo, false);
  v_qty integer;
  v_holo_qty integer;
  v_active integer;
  v_max_active integer;
  v_quote jsonb;
  v_min integer;
  v_max integer;
  v_reference integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_price is null or p_price < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_price');
  end if;

  if not exists (select 1 from public.cards where id = p_card_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_card');
  end if;

  -- Verrouille le profil, puis la collection : deux clics simultanés ne
  -- peuvent ni dépasser la limite d'annonces ni vendre deux fois la même copie.
  perform 1 from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  select quantity, holo_quantity
    into v_qty, v_holo_qty
    from public.collection
   where user_id = v_uid and card_id = p_card_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_owned');
  end if;

  if v_holo then
    -- Une holo ne part que s'il reste une autre copie de la carte.
    if v_holo_qty < 1 or v_qty < 2 then
      return jsonb_build_object('ok', false, 'reason', 'keep_one');
    end if;
  else
    -- Une copie normale reste toujours au joueur.
    if v_qty - v_holo_qty < 2 then
      return jsonb_build_object('ok', false, 'reason', 'keep_one');
    end if;
  end if;

  v_max_active := coalesce(
    (select (value #>> '{}')::int from public.game_config where key = 'market_max_active'), 10
  );

  select count(*)::int into v_active
    from public.market_listings
   where seller_id = v_uid and status = 'active';

  if v_active >= v_max_active then
    return jsonb_build_object(
      'ok', false, 'reason', 'too_many_listings', 'max', v_max_active
    );
  end if;

  v_quote := public.market_quote(p_card_id, v_holo);
  v_min := coalesce((v_quote ->> 'min')::int, 0);
  v_max := coalesce((v_quote ->> 'max')::int, 0);
  v_reference := coalesce((v_quote ->> 'reference')::int, 0);

  if v_min <= 0 or v_max < v_min then
    raise exception 'market_quote_invalid' using errcode = 'P0001';
  end if;

  if p_price < v_min or p_price > v_max then
    return jsonb_build_object(
      'ok', false, 'reason', 'price_out_of_bounds',
      'min', v_min, 'max', v_max, 'reference', v_reference
    );
  end if;

  update public.collection
     set quantity = quantity - 1,
         holo_quantity = holo_quantity - case when v_holo then 1 else 0 end
   where user_id = v_uid and card_id = p_card_id;

  insert into public.market_listings (seller_id, card_id, holo, price_pixels)
  values (v_uid, p_card_id, v_holo, p_price)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'price', p_price,
    'min', v_min,
    'max', v_max,
    'reference', v_reference
  );
end;
$$;

revoke all on function public.create_listing(text, boolean, integer) from public;
revoke all on function public.create_listing(text, boolean, integer) from anon;
grant execute on function public.create_listing(text, boolean, integer) to authenticated;

-- ————— Annuler une annonce —————
create or replace function public.cancel_listing(p_listing_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.market_listings%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_listing
    from public.market_listings
   where id = p_listing_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  if v_listing.seller_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  if v_listing.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  update public.market_listings
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_listing_id;

  insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
  values (v_uid, v_listing.card_id, 1, case when v_listing.holo then 1 else 0 end)
  on conflict (user_id, card_id) do update
    set quantity = col.quantity + 1,
        holo_quantity = col.holo_quantity + case when v_listing.holo then 1 else 0 end;

  return jsonb_build_object(
    'ok', true,
    'card_id', v_listing.card_id,
    'holo', v_listing.holo
  );
end;
$$;

revoke all on function public.cancel_listing(bigint) from public;
revoke all on function public.cancel_listing(bigint) from anon;
grant execute on function public.cancel_listing(bigint) to authenticated;

-- ————— Acheter une annonce —————
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

-- ————— Contrôles finaux —————
do $$
declare
  v_prices integer;
  v_config integer;
begin
  select count(*) into v_prices from public.market_prices;
  if v_prices < 5 then
    raise exception 'valeurs de marché incomplètes (% raretés)', v_prices;
  end if;

  select count(*) into v_config
    from public.game_config
   where key in (
     'market_commission', 'market_spread_low', 'market_spread_high',
     'market_history_days', 'market_min_sales', 'market_max_active'
   );
  if v_config < 6 then
    raise exception 'configuration du marché incomplète (% réglages)', v_config;
  end if;

  if not exists (select 1 from pg_proc where proname = 'market_quote')
     or not exists (select 1 from pg_proc where proname = 'market_listings')
     or not exists (select 1 from pg_proc where proname = 'create_listing')
     or not exists (select 1 from pg_proc where proname = 'cancel_listing')
     or not exists (select 1 from pg_proc where proname = 'buy_listing') then
    raise exception 'fonctions du marché absentes';
  end if;

  raise notice 'Marché en place : % raretés tarifées.', v_prices;
end;
$$;
