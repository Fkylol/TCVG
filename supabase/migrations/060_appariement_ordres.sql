-- Un ordre prioritaire peut ne pas trouver d'annonce même si un ordre moins
-- élevé le peut : le vendeur ne peut pas acheter sa propre annonce, ou une
-- annonce compatible est verrouillée par une autre transaction. Ne pas arrêter
-- le traitement de tous les ordres dans ces cas.
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
  v_skipped bigint[] := '{}';
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
       and not (id = any (v_skipped))
     order by max_price desc, created_at asc
     limit 1
       for update skip locked;

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

    if not found then
      v_skipped := array_append(v_skipped, v_order.id);
      continue;
    end if;

    v_fee := ceil(v_listing.price_pixels * v_commission)::int;
    v_payout := v_listing.price_pixels - v_fee;
    v_surplus := v_order.reserved_pixels - v_listing.price_pixels;

    insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
    values (v_order.buyer_id, v_listing.card_id, 1, case when v_listing.holo then 1 else 0 end)
    on conflict (user_id, card_id) do update
      set quantity = col.quantity + 1,
          holo_quantity = col.holo_quantity + case when v_listing.holo then 1 else 0 end;

    update public.market_listings
       set status = 'sold', buyer_id = v_order.buyer_id, sold_at = now(),
           fee_pixels = v_fee, seller_payout = v_payout
     where id = v_listing.id;

    update public.buy_orders
       set status = 'filled', filled_at = now(), filled_listing_id = v_listing.id,
           reserved_pixels = 0
     where id = v_order.id;

    if v_surplus > 0 then
      update public.profiles set pixels = pixels + v_surplus where id = v_order.buyer_id;
      insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
      values (v_order.buyer_id, v_surplus, 'remboursement_ordre', 'buy_order', v_order.id);
    end if;

    update public.profiles set pixels = pixels + v_payout where id = v_listing.seller_id;
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

revoke all on function public.match_card_orders(text, boolean) from public, anon, authenticated;
