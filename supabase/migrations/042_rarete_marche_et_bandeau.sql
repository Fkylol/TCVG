-- ============================================================
--  Migration 042 — Marché et bandeau du chantier « rareté par popularité »
--  Rejouable sans risque. Retour arrière : 042_rarete_marche_et_bandeau.down.sql
--
--  Trois ajouts, tous nécessaires à l'application d'une nouvelle rareté :
--
--   1. `_market_quote()` : le calcul de fourchette, extrait de `market_quote()`
--      pour être appelable par un script de maintenance (qui n'a pas de JWT).
--      `market_quote()` garde exactement le même comportement pour les joueurs.
--   2. Deux motifs de notification (« annonce annulée », « ordre annulé »),
--      utilisés quand la rareté d'une carte change et que le prix sort de la
--      nouvelle fourchette.
--   3. La clé `rarity_update` de `game_config`, lue par le bandeau de 7 jours.
-- ============================================================

-- ————— 1. Devis de marché partagé —————
create or replace function public._market_quote(
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

  v_reference := least(greatest(v_reference, v_floor_min), v_floor_max);
  v_min := greatest(v_floor_min, ceil(v_reference * v_low)::int);
  v_max := least(v_floor_max, floor(v_reference * v_high)::int);
  if v_max < v_min then
    v_max := v_min;
  end if;

  return jsonb_build_object(
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

revoke all on function public._market_quote(text, boolean) from public;
revoke all on function public._market_quote(text, boolean) from anon;
revoke all on function public._market_quote(text, boolean) from authenticated;

-- `market_quote()` garde son contrat : authentification, puis même calcul.
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
  v_uid uuid := auth.uid();
  v_quote jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_quote := public._market_quote(p_card_id, p_holo);

  return jsonb_build_object('ok', true) || v_quote;
end;
$$;

revoke all on function public.market_quote(text, boolean) from public;
revoke all on function public.market_quote(text, boolean) from anon;
grant execute on function public.market_quote(text, boolean) to authenticated;

-- ————— 2. Notifications d'annulation —————
alter table public.notifications drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing',
    'swap_offer', 'swap_accepted', 'swap_declined', 'swap_expired',
    'listing_cancelled', 'order_cancelled'
  ));

-- ————— 3. Bandeau « les raretés ont changé » —————
-- La clé `rarity_update` n'est créée qu'au moment de l'application des raretés
-- (`rarity:apply`), qui y écrit la date et le bilan. Créer la clé ici avec
-- `'null'::jsonb` insérait en réalité un NULL SQL, refusé par la contrainte
-- `not null` de `game_config` lors d'une restauration d'instantané.

comment on column public.cards.rarity_version is
  'Incrémenté à chaque application du calcul de popularité ; 0 = jamais appliqué.';

-- ————— Contrôles finaux —————
do $$
declare
  v_kind text;
  v_body text;
begin
  select pg_get_constraintdef(oid) into v_kind
    from pg_constraint
   where conname = 'notifications_kind_check'
     and conrelid = 'public.notifications'::regclass;

  if v_kind is null or position('listing_cancelled' in v_kind) = 0 then
    raise exception 'la contrainte notifications_kind_check ne connaît pas listing_cancelled';
  end if;

  select prosrc into v_body from pg_proc where proname = 'market_quote';
  if v_body is null or position('_market_quote' in v_body) = 0 then
    raise exception 'market_quote() ne délègue pas à _market_quote()';
  end if;

  raise notice 'Rareté : devis partagé, notifications d''annulation et bandeau en place.';
end;
$$;
