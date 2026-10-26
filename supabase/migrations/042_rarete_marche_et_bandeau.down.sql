-- ============================================================
--  Retour arrière de la migration 042.
--  Restaure `market_quote()` dans sa version autonome (migration 011) et
--  retire les deux motifs de notification ajoutés.
-- ============================================================

alter table public.notifications drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing',
    'swap_offer', 'swap_accepted', 'swap_declined', 'swap_expired'
  ));

drop function if exists public._market_quote(text, boolean);

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
  if v_uid is null then
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

delete from public.game_config where key = 'rarity_update';
