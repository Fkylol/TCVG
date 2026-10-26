-- ============================================================
--  Migration 014 — Ouverture des packs (tirage, stock, collection)
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Principes :
--    • le client n'envoie qu'un identifiant de pack, il ne choisit aucune carte ;
--    • l'aléa est cryptographique (extensions.gen_random_bytes) et vit en base :
--      une fonction appelée depuis le navigateur ne peut pas recevoir de cartes ;
--    • la consommation du stock est un UPDATE conditionnel unique (double-clic
--      ou deux onglets = une seule ouverture) ;
--    • les cartes sont écrites dans la collection avant le retour de la fonction,
--      donc avant la fin de l'animation côté client.
-- ============================================================

-- ————— 1. Réglages —————
insert into public.game_config (key, value) values
  ('cards_per_booster', '5'::jsonb),
  ('misprint_enabled', 'true'::jsonb),
  ('misprint_chance', '0.008'::jsonb)
on conflict (key) do nothing;

-- ————— 2. Les 11 packs remplacent les anciens boosters —————
-- Les anciens packs par genre (`genre-*`) disparaissent ; l'historique d'achat
-- vit dans pixel_transactions (aucune clé étrangère vers booster_types).
delete from public.booster_types where slug like 'genre-%';

insert into public.booster_types (slug, name, price_pixels, genre_id, cards_count, active)
values ('mix', 'Booster Mix', 20, null, 5, true)
on conflict (slug) do update
  set name = excluded.name,
      price_pixels = excluded.price_pixels,
      genre_id = excluded.genre_id,
      cards_count = excluded.cards_count,
      active = true;

insert into public.booster_types (slug, name, price_pixels, genre_id, cards_count, active)
select v.slug, v.name, v.price, g.id, 5, true
  from (values
    ('action-aventure', 'Booster Action-aventure', 30),
    ('plateforme',      'Booster Plateforme',      30),
    ('rpg',             'Booster RPG',             30),
    ('fps',             'Booster FPS',             30),
    ('course',          'Booster Course',          30),
    ('inde',            'Booster Indé',            30),
    ('combat',          'Booster Combat',          30),
    ('horreur',         'Booster Horreur',         30),
    ('strategie',       'Booster Stratégie',       30),
    ('sport',           'Booster Sport',           30)
  ) as v(slug, name, price)
  join public.genres g on g.slug = v.slug
on conflict (slug) do update
  set name = excluded.name,
      price_pixels = excluded.price_pixels,
      genre_id = excluded.genre_id,
      cards_count = excluded.cards_count,
      active = true;

-- ————— 3. Aléa cryptographique —————
-- 24 bits tirés au hasard (gen_random_bytes) ramenés dans [0, 1[. Équivalent
-- de crypto.randomInt côté Node, mais exécuté là où le tirage ne peut pas être
-- influencé par l'appelant.
create or replace function public.random_unit()
returns double precision
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_bytes bytea := extensions.gen_random_bytes(3);
begin
  return (
    get_byte(v_bytes, 0) * 65536
    + get_byte(v_bytes, 1) * 256
    + get_byte(v_bytes, 2)
  )::double precision / 16777216.0;
end;
$$;

-- ————— 4. Choix d'une carte —————
-- p_rarity NULL = n'importe quelle rareté. p_exclude évite les doublons dans
-- un même booster tant que le pool le permet.
create or replace function public._pick_card(
  p_pool text[],
  p_rarity text,
  p_exclude text[]
)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_ids text[];
begin
  if p_pool is null or array_length(p_pool, 1) is null then
    return null;
  end if;

  select array_agg(id) into v_ids
    from public.playable_cards
   where id = any (p_pool)
     and (p_rarity is null or rarity = p_rarity)
     and (p_exclude is null or array_length(p_exclude, 1) is null or not (id = any (p_exclude)));

  if v_ids is null then
    return null;
  end if;

  return v_ids[1 + floor(public.random_unit() * array_length(v_ids, 1))::int];
end;
$$;

-- ————— 5. Tirage —————
-- Rareté pondérée par carte, puis repli : même rareté dans le genre, même
-- rareté au global, rareté inférieure (L → M), puis n'importe quelle carte
-- active. Ne renvoie jamais undefined : lève `booster_empty` si aucune carte
-- n'est active.
create or replace function public._draw_cards(
  p_pool text[],
  p_count integer,
  p_rates jsonb
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_global text[];
  v_order text[] := array['L', 'UR', 'SR', 'R', 'C'];
  v_rates jsonb := p_rates;
  v_exclude text[] := '{}';
  v_cards jsonb := '[]'::jsonb;
  v_rarity text;
  v_card text;
  v_real text;
  v_start integer;
  v_index integer;
  v_step integer;
  v_holo boolean;
  v_variant text;
  v_holo_chance numeric;
  v_misprint boolean;
  v_misprint_chance numeric;
begin
  select array_agg(id) into v_global from public.playable_cards;

  if v_global is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  if p_pool is null or array_length(p_pool, 1) is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  -- Une rareté absente du catalogue actif n'est jamais tirée.
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_rates
    from jsonb_each_text(v_rates) as e(key, value)
   where exists (
     select 1 from public.playable_cards c where c.id = any (v_global) and c.rarity = e.key
   );

  if v_rates = '{}'::jsonb then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  select
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'booster_holo_chance'), 0.02),
    coalesce((select (value #>> '{}')::boolean from public.game_config where key = 'misprint_enabled'), false),
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'misprint_chance'), 0.008)
    into v_holo_chance, v_misprint, v_misprint_chance;

  for v_index in 1..p_count loop
    v_rarity := public.roll_rarity(v_rates, null, public.random_unit());

    if v_rarity is null then
      v_rarity := 'C';
    end if;

    -- 1. la rareté demandée dans le genre du pack
    v_card := public._pick_card(p_pool, v_rarity, v_exclude);

    -- 2. la même rareté, mais partout dans le catalogue actif
    if v_card is null then
      v_card := public._pick_card(v_global, v_rarity, v_exclude);
    end if;

    -- 3. les raretés inférieures, genre puis global
    if v_card is null then
      v_start := array_position(v_order, v_rarity) + 1;
      if v_start is not null then
        for v_step in v_start..array_length(v_order, 1) loop
          v_card := public._pick_card(p_pool, v_order[v_step], v_exclude);
          if v_card is null then
            v_card := public._pick_card(v_global, v_order[v_step], v_exclude);
          end if;
          exit when v_card is not null;
        end loop;
      end if;
    end if;

    -- 4. n'importe quelle carte active
    if v_card is null then
      v_card := public._pick_card(v_global, null, v_exclude);
    end if;

    -- 5. pool plus petit que le paquet : doublon interne toléré
    if v_card is null then
      v_card := public._pick_card(p_pool, null, '{}');
      if v_card is null then
        v_card := public._pick_card(v_global, null, '{}');
      end if;
    end if;

    if v_card is null then
      raise exception 'booster_empty' using errcode = '22023';
    end if;

    v_exclude := v_exclude || v_card;

    -- La rareté annoncée est celle de la carte réellement tirée (le repli peut
    -- descendre d'une rareté).
    select rarity into v_real from public.playable_cards where id = v_card;

    v_holo := public.random_unit() < v_holo_chance;
    v_variant := null;
    if v_misprint and public.random_unit() < v_misprint_chance then
      v_variant := (array['holo_bleed', 'off_center', 'ghosting'])[
        1 + floor(public.random_unit() * 3)::int
      ];
    end if;

    v_cards := v_cards || jsonb_build_object(
      'id', v_card,
      'rarity', v_real,
      'holo', v_holo,
      'variant', v_variant
    );
  end loop;

  return v_cards;
end;
$$;

-- ————— 6. Enregistrement dans la collection —————
-- Une carte déjà possédée incrémente son compteur ; `is_new` n'est vrai que
-- pour la toute première copie. Les variantes sont cosmétiques : la première
-- rencontrée est conservée.
create or replace function public._store_cards(p_uid uuid, p_cards jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_holo boolean;
  v_variant text;
  v_quantity integer;
  v_out jsonb := '[]'::jsonb;
begin
  for v_entry in select * from jsonb_array_elements(p_cards) loop
    v_holo := coalesce((v_entry ->> 'holo')::boolean, false);
    v_variant := nullif(v_entry ->> 'variant', '');

    insert into public.collection as col (user_id, card_id, quantity, holo_quantity, variant)
    values (p_uid, v_entry ->> 'id', 1, case when v_holo then 1 else 0 end, v_variant)
    on conflict (user_id, card_id) do update
      set quantity = col.quantity + 1,
          holo_quantity = col.holo_quantity + case when v_holo then 1 else 0 end,
          variant = coalesce(col.variant, excluded.variant)
    returning quantity into v_quantity;

    v_out := v_out || (v_entry || jsonb_build_object(
      'is_new', v_quantity = 1,
      'quantity', v_quantity
    ));
  end loop;

  return v_out;
end;
$$;

-- ————— 7. Ouverture gratuite (stock) —————
-- Un seul paquet par appel. Le stock est commun à tous les packs : il
-- s'accumule d'une unité toutes les 10 minutes, plafonné à 10.
create or replace function public.open_pack(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pack public.booster_types%rowtype;
  v_pool text[];
  v_rates jsonb;
  v_stock integer;
  v_anchor timestamptz;
  v_accrued integer;
  v_after integer;
  v_new_stock integer;
  v_new_anchor timestamptz;
  v_cards jsonb;
  v_server_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_pack
    from public.booster_types
   where slug = p_slug and active = true;

  if not found then
    raise exception 'unknown_pack' using errcode = 'P0002';
  end if;

  -- Pool : toutes les cartes jouables pour le Mix, le genre du pack sinon.
  if v_pack.genre_id is null then
    select array_agg(id) into v_pool from public.playable_cards;
  else
    select array_agg(c.id) into v_pool
      from public.playable_cards c
      join public.card_genres cg on cg.card_id = c.id
     where cg.genre_id = v_pack.genre_id;
  end if;

  -- Genre sans carte jouable : le pack se rabat entièrement sur le pool
  -- global, comme le Mix, au lieu d'échouer.
  if v_pool is null then
    select array_agg(id) into v_pool from public.playable_cards;
  end if;

  if v_pool is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  v_rates := coalesce(
    v_pack.drop_rates,
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  -- Verrou de ligne : la lecture, le cumul et la consommation sont cohérents.
  select booster_stock, last_booster_at
    into v_stock, v_anchor
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  v_accrued := floor(
    extract(epoch from (v_server_now - coalesce(v_anchor, v_server_now))) / 600
  )::int;
  v_after := least(10, v_stock + v_accrued);

  if v_after < 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'no_stock',
      'stock', v_after,
      'anchor', v_anchor,
      'server_now', v_server_now
    );
  end if;

  -- Update conditionnel unique : un double-clic tombe sur `not found`.
  update public.profiles
     set booster_stock = v_after - 1,
         last_booster_at = case
           when v_after >= 10 then v_server_now
           else coalesce(v_anchor, v_server_now) + make_interval(secs => v_accrued * 600)
         end,
         boosters_opened = boosters_opened + 1
   where id = v_uid
     and booster_stock = v_stock
     and last_booster_at is not distinct from v_anchor
  returning booster_stock, last_booster_at into v_new_stock, v_new_anchor;

  if not found then
    raise exception 'concurrent_open' using errcode = '40001';
  end if;

  v_cards := public._draw_cards(v_pool, v_pack.cards_count, v_rates);
  v_cards := public._store_cards(v_uid, v_cards);

  return jsonb_build_object(
    'ok', true,
    'pack', v_pack.slug,
    'cards', v_cards,
    'stock', v_new_stock,
    'anchor', v_new_anchor,
    'server_now', v_server_now
  );
end;
$$;

-- ————— 8. Achat en Pixels —————
-- Même tirage, même config de packs ; seul le moyen d'obtenir le pack change.
create or replace function public.buy_booster(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pack public.booster_types%rowtype;
  v_pool text[];
  v_rates jsonb;
  v_pixels integer;
  v_cards jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_pack
    from public.booster_types
   where slug = p_slug and active = true;

  if not found then
    raise exception 'unknown_pack' using errcode = 'P0002';
  end if;

  select pixels into v_pixels
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  if v_pixels < v_pack.price_pixels then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_pixels',
      'pixels', v_pixels,
      'price', v_pack.price_pixels
    );
  end if;

  if v_pack.genre_id is null then
    select array_agg(id) into v_pool from public.playable_cards;
  else
    select array_agg(c.id) into v_pool
      from public.playable_cards c
      join public.card_genres cg on cg.card_id = c.id
     where cg.genre_id = v_pack.genre_id;
  end if;

  -- Genre sans carte jouable : le pack se rabat entièrement sur le pool
  -- global, comme le Mix, au lieu d'échouer.
  if v_pool is null then
    select array_agg(id) into v_pool from public.playable_cards;
  end if;

  if v_pool is null then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  v_rates := coalesce(
    v_pack.drop_rates,
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  v_cards := public._draw_cards(v_pool, v_pack.cards_count, v_rates);
  v_cards := public._store_cards(v_uid, v_cards);

  update public.profiles
     set pixels = pixels - v_pack.price_pixels,
         boosters_opened = boosters_opened + 1
   where id = v_uid
  returning pixels into v_pixels;

  insert into public.pixel_transactions (user_id, amount, reason)
  values (v_uid, -v_pack.price_pixels, 'achat_booster');

  return jsonb_build_object(
    'ok', true,
    'pack', v_pack.slug,
    'cards', v_cards,
    'pixels', v_pixels,
    'price', v_pack.price_pixels
  );
end;
$$;

-- ————— 9. Droits —————
-- L'ancienne ouverture recevait les cartes du client : elle disparaît.
drop function if exists public.open_boosters(text[], integer);

revoke all on function public.random_unit() from public;
revoke all on function public._pick_card(text[], text, text[]) from public;
revoke all on function public._draw_cards(text[], integer, jsonb) from public;
revoke all on function public._store_cards(uuid, jsonb) from public;

revoke all on function public.open_pack(text) from public;
revoke all on function public.open_pack(text) from anon;
grant execute on function public.open_pack(text) to authenticated;

revoke all on function public.buy_booster(text) from public;
revoke all on function public.buy_booster(text) from anon;
grant execute on function public.buy_booster(text) to authenticated;

-- ————— 10. Contrôles finaux —————
do $$
declare
  v_packs integer;
  v_five integer;
begin
  select count(*) into v_packs from public.booster_types where active;
  select count(*) into v_five from public.booster_types where active and cards_count = 5;

  if v_packs <> 11 then
    raise exception '11 packs attendus, % trouvés', v_packs;
  end if;

  if v_five <> v_packs then
    raise exception 'tous les packs doivent avoir 5 cartes';
  end if;

  if not exists (select 1 from public.game_config where key = 'cards_per_booster') then
    raise exception 'cards_per_booster absent de game_config';
  end if;

  raise notice 'packs : % actifs, 5 cartes chacun', v_packs;
end;
$$;

-- ============================================================
--  ROLLBACK
-- ============================================================
-- drop function if exists public.open_pack(text);
-- drop function if exists public._store_cards(uuid, jsonb);
-- drop function if exists public._draw_cards(text[], integer, jsonb);
-- drop function if exists public._pick_card(text[], text, text[]);
-- drop function if exists public.random_unit();
--
-- delete from public.booster_types
--  where slug in ('action-aventure','plateforme','rpg','fps','course','inde',
--                 'combat','horreur','strategie','sport');
-- update public.booster_types set price_pixels = 20 where slug = 'mix';
--
-- delete from public.game_config
--  where key in ('cards_per_booster', 'misprint_enabled', 'misprint_chance');
--
-- -- open_boosters(text[], integer) est à recréer depuis supabase/schema.sql.
