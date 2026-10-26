-- ============================================================
--  Migration 038 — Vendre sa dernière copie
--  Rejouable sans risque.
--
--  Constat : `create_listing()` refusait la vente tant que le joueur ne gardait
--  pas un exemplaire de la carte (`keep_one`). Un joueur qui possédait une seule
--  copie — cas de la grande majorité des cartes d'un album — ne pouvait donc
--  jamais la mettre en vente.
--
--  Correctif : la seule condition devient « posséder la variante annoncée ».
--  Une annonce normale exige une copie normale, une annonce holo une copie holo.
--  Quand la vente retire la dernière copie, la ligne de collection disparaît :
--  la contrainte `quantity > 0` reste donc vraie, et l'annulation ou l'expiration
--  de l'annonce réinsère la carte (les fonctions de restitution font déjà un
--  `insert ... on conflict`).
-- ============================================================

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

  -- Il faut posséder la variante annoncée, sans obligation d'en garder une :
  -- une carte peut partir même si c'est la seule copie du joueur.
  if v_holo then
    if v_holo_qty < 1 then
      return jsonb_build_object('ok', false, 'reason', 'not_owned');
    end if;
  else
    if v_qty - v_holo_qty < 1 then
      return jsonb_build_object('ok', false, 'reason', 'not_owned');
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

  -- Dernière copie : la ligne quitte la collection plutôt que de tomber à zéro
  -- (la table interdit `quantity = 0`, et l'annulation sait la recréer).
  if v_qty <= 1 then
    delete from public.collection
     where user_id = v_uid and card_id = p_card_id;
  else
    update public.collection
       set quantity = quantity - 1,
           holo_quantity = holo_quantity - case when v_holo then 1 else 0 end
     where user_id = v_uid and card_id = p_card_id;
  end if;

  insert into public.market_listings (seller_id, card_id, holo, price_pixels)
  values (v_uid, p_card_id, v_holo, p_price)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'price', p_price,
    'min', v_min,
    'max', v_max,
    'reference', v_reference,
    -- Copie restante après la mise en vente (0 = l'album ne contient plus la carte).
    'quantity', v_qty - 1,
    'holo_quantity', v_holo_qty - case when v_holo then 1 else 0 end
  );
end;
$$;

revoke all on function public.create_listing(text, boolean, integer) from public;
revoke all on function public.create_listing(text, boolean, integer) from anon;
grant execute on function public.create_listing(text, boolean, integer) to authenticated;

-- ————— Contrôles finaux —————
do $$
declare
  v_body text;
begin
  select prosrc into v_body from pg_proc where proname = 'create_listing';
  if v_body is null then
    raise exception 'create_listing() absente';
  end if;
  if v_body like '%keep_one%' then
    raise exception 'create_listing() refuse encore la dernière copie';
  end if;

  raise notice 'Marché : la dernière copie d''une carte peut être mise en vente.';
end;
$$;
