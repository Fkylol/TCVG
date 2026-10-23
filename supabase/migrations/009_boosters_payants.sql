-- ============================================================
--  Migration 009 — ÉTAPE 3 : boosters payants en Pixels
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Tirage, débit et crédit se font dans buy_booster(), en une seule
--  transaction : le navigateur ne choisit ni les cartes ni le prix.
-- ============================================================

-- ————— Compteurs de pity (par joueur) —————
-- Nombre d'ouvertures consécutives sans rareté Rare+ / Légendaire+.
alter table public.profiles
  add column if not exists pity_rare integer not null default 0,
  add column if not exists pity_legendary integer not null default 0;

-- ————— Variantes holo —————
-- `quantity` compte toujours toutes les copies ; `holo_quantity` combien
-- d'entre elles sont brillantes. Une holo reste donc une carte possédée.
alter table public.collection
  add column if not exists holo_quantity integer not null default 0;

-- ————— Configuration modifiable sans redéploiement —————
insert into public.game_config (key, value) values
  -- Mêmes poids que le catalogue côté site (somme = 1000).
  ('booster_drop_rates', '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb),
  ('booster_pity_rare', '10'::jsonb),
  ('booster_pity_legendary', '50'::jsonb),
  ('booster_holo_chance', '0.02'::jsonb),
  ('booster_genre_min_cards', '20'::jsonb)
on conflict (key) do nothing;

-- ————— Types de boosters —————
create table if not exists public.booster_types (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  price_pixels integer not null check (price_pixels >= 0),
  -- NULL = booster Mix, toutes les cartes du catalogue.
  genre_id uuid references public.genres (id) on delete cascade,
  cards_count integer not null check (cards_count between 1 and 10),
  -- NULL = taux par défaut de game_config.
  drop_rates jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists booster_types_genre_idx
  on public.booster_types (genre_id);

alter table public.booster_types enable row level security;

drop policy if exists "booster_types: lecture publique" on public.booster_types;
create policy "booster_types: lecture publique"
  on public.booster_types for select
  using (true);

revoke all on public.booster_types from anon, authenticated;
grant select on public.booster_types to anon, authenticated;

-- Mix : 5 cartes pour 20 Pixels.
insert into public.booster_types (slug, name, price_pixels, genre_id, cards_count)
values ('mix', 'Booster Mix', 20, null, 5)
on conflict (slug) do nothing;

-- Un booster par genre d'au moins 20 cartes, à 30 Pixels : le pool est plus
-- étroit, donc la même carte vaut plus cher qu'en Mix.
insert into public.booster_types (slug, name, price_pixels, genre_id, cards_count)
select
  'genre-' || g.slug,
  'Booster ' || g.name,
  30,
  g.id,
  5
  from public.genres g
 where (select count(*) from public.card_genres cg where cg.genre_id = g.id) >= 20
on conflict (slug) do nothing;

-- ————— Nombre de cartes par genre (lecture publique) —————
create or replace view public.genre_card_counts
with (security_invoker = true) as
select
  g.id,
  g.slug,
  g.name,
  g.description,
  count(cg.card_id)::int as cards
  from public.genres g
  left join public.card_genres cg on cg.genre_id = g.id
 group by g.id, g.slug, g.name, g.description;

grant select on public.genre_card_counts to anon, authenticated;

-- ————— Tirage pondéré, testable isolément —————
create or replace function public.roll_rarity(
  p_rates jsonb,
  p_allowed text[],
  p_roll double precision
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_total numeric := 0;
  v_ticket numeric;
  v_last text;
  v_row record;
begin
  for v_row in
    select r.key, r.value::numeric as weight
      from jsonb_each_text(p_rates) as r(key, value)
     where p_allowed is null or r.key = any (p_allowed)
  loop
    v_total := v_total + v_row.weight;
    v_last := v_row.key;
  end loop;

  if v_total <= 0 then
    return null;
  end if;

  v_ticket := greatest(0, least(coalesce(p_roll, 0), 0.999999)) * v_total;

  for v_row in
    select r.key, r.value::numeric as weight
      from jsonb_each_text(p_rates) as r(key, value)
     where p_allowed is null or r.key = any (p_allowed)
  loop
    v_ticket := v_ticket - v_row.weight;
    if v_ticket < 0 then
      return v_row.key;
    end if;
  end loop;

  return v_last;
end;
$$;

-- ————— Achat et ouverture —————
create or replace function public.buy_booster(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pixels integer;
  v_pity_rare integer;
  v_pity_legendary integer;
  v_type public.booster_types%rowtype;
  v_rates jsonb;
  v_pool text[];
  v_every_rare integer;
  v_every_legendary integer;
  v_holo_chance numeric;
  v_force_rare boolean;
  v_force_legendary boolean;
  v_cards jsonb := '[]'::jsonb;
  v_drawn text[] := '{}';
  v_rarity text;
  v_card_id text;
  v_holo boolean;
  v_is_new boolean;
  v_has_rare boolean := false;
  v_has_legendary boolean := false;
  v_index integer;
  v_pity_rare_next integer;
  v_pity_legendary_next integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Verrou de ligne : deux achats simultanés ne peuvent pas lire le même solde.
  select pixels, pity_rare, pity_legendary
    into v_pixels, v_pity_rare, v_pity_legendary
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  select * into v_type
    from public.booster_types
   where slug = p_slug and active = true;

  if not found then
    raise exception 'unknown_booster' using errcode = 'P0002';
  end if;

  -- Pool : tout le catalogue pour le Mix, un seul genre sinon.
  if v_type.genre_id is null then
    select array_agg(id) into v_pool from public.cards;
  else
    select array_agg(card_id) into v_pool
      from public.card_genres
     where genre_id = v_type.genre_id;
  end if;

  if v_pool is null or array_length(v_pool, 1) = 0 then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  if v_type.genre_id is not null
     and array_length(v_pool, 1) < coalesce(
       (select (value #>> '{}')::int from public.game_config where key = 'booster_genre_min_cards'),
       20
     ) then
    raise exception 'genre_too_small' using errcode = '22023';
  end if;

  if v_pixels < v_type.price_pixels then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_pixels',
      'pixels', v_pixels,
      'price', v_type.price_pixels
    );
  end if;

  v_rates := coalesce(
    v_type.drop_rates,
    (select value from public.game_config where key = 'booster_drop_rates'),
    '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
  );

  -- Une rareté absente du pool (genre sans mythique, par exemple) ne doit pas
  -- être tirée : sinon le paquet retomberait sur une carte au hasard.
  select coalesce(jsonb_object_agg(rates.key, rates.value), '{}'::jsonb)
    into v_rates
    from jsonb_each(v_rates) as rates(key, value)
   where exists (
     select 1 from public.cards c
      where c.id = any (v_pool) and c.rarity = rates.key
   );

  if v_rates = '{}'::jsonb then
    raise exception 'booster_empty' using errcode = '22023';
  end if;

  select
    coalesce((select (value #>> '{}')::int from public.game_config where key = 'booster_pity_rare'), 10),
    coalesce((select (value #>> '{}')::int from public.game_config where key = 'booster_pity_legendary'), 50),
    coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'booster_holo_chance'), 0.02)
    into v_every_rare, v_every_legendary, v_holo_chance;

  -- « une rare garantie toutes les 10 ouvertures » : la 10e est forcée.
  v_force_legendary := (v_pity_legendary + 1) >= v_every_legendary;
  v_force_rare := (v_pity_rare + 1) >= v_every_rare;

  for v_index in 1..v_type.cards_count loop
    if v_index = 1 and v_force_legendary then
      v_rarity := public.roll_rarity(v_rates, array['UR', 'L'], random());
    elsif v_index = 1 and v_force_rare then
      v_rarity := public.roll_rarity(v_rates, array['R', 'SR', 'UR', 'L'], random());
    else
      v_rarity := public.roll_rarity(v_rates, null, random());
    end if;

    if v_rarity is null then
      v_rarity := public.roll_rarity(v_rates, null, random());
    end if;

    select c.id into v_card_id
      from public.cards c
     where c.id = any (v_pool)
       and c.rarity = v_rarity
       and not (c.id = any (v_drawn))
     order by random()
     limit 1;

    -- Rareté épuisée dans ce pool (dernière carte du genre déjà sortie).
    if v_card_id is null then
      select c.id into v_card_id
        from public.cards c
       where c.id = any (v_pool)
         and not (c.id = any (v_drawn))
       order by random()
       limit 1;
    end if;

    -- Pool plus petit que le paquet : on tolère un doublon interne.
    if v_card_id is null then
      select c.id into v_card_id
        from public.cards c
       where c.id = any (v_pool)
       order by random()
       limit 1;
    end if;

    if v_card_id is null then
      raise exception 'booster_empty' using errcode = '22023';
    end if;

    v_drawn := array_append(v_drawn, v_card_id);
    v_holo := random() < v_holo_chance;

    select not exists (
      select 1 from public.collection where user_id = v_uid and card_id = v_card_id
    ) into v_is_new;

    insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
    values (v_uid, v_card_id, 1, case when v_holo then 1 else 0 end)
    on conflict (user_id, card_id) do update
      set quantity = col.quantity + 1,
          holo_quantity = col.holo_quantity + case when v_holo then 1 else 0 end;

    v_has_rare := v_has_rare or v_rarity in ('R', 'SR', 'UR', 'L');
    v_has_legendary := v_has_legendary or v_rarity in ('UR', 'L');

    v_cards := v_cards || jsonb_build_object(
      'id', v_card_id,
      'rarity', v_rarity,
      'holo', v_holo,
      'new', v_is_new
    );
  end loop;

  v_pity_rare_next := case when v_has_rare then 0 else v_pity_rare + 1 end;
  v_pity_legendary_next := case when v_has_legendary then 0 else v_pity_legendary + 1 end;

  update public.profiles
     set pixels = pixels - v_type.price_pixels,
         pity_rare = v_pity_rare_next,
         pity_legendary = v_pity_legendary_next,
         boosters_opened = boosters_opened + 1
   where id = v_uid
  returning pixels into v_pixels;

  insert into public.pixel_transactions (user_id, amount, reason)
  values (v_uid, -v_type.price_pixels, 'achat_booster');

  return jsonb_build_object(
    'ok', true,
    'booster', v_type.slug,
    'cards', v_cards,
    'pixels', v_pixels,
    'price', v_type.price_pixels,
    'pity_rare', v_pity_rare_next,
    'pity_legendary', v_pity_legendary_next
  );
end;
$$;

revoke all on function public.buy_booster(text) from public;
revoke all on function public.buy_booster(text) from anon;
grant execute on function public.buy_booster(text) to authenticated;

revoke all on function public.roll_rarity(jsonb, text[], double precision) from public;
revoke all on function public.roll_rarity(jsonb, text[], double precision) from anon;
grant execute on function public.roll_rarity(jsonb, text[], double precision) to authenticated;

-- ————— Contrôles finaux —————
do $$
declare
  v_types integer;
  v_config integer;
begin
  select count(*) into v_types from public.booster_types where active;
  if v_types = 0 then
    raise exception 'aucun booster créé';
  end if;

  select count(*) into v_config
    from public.game_config
   where key in ('booster_drop_rates', 'booster_pity_rare', 'booster_pity_legendary', 'booster_holo_chance');
  if v_config < 4 then
    raise exception 'configuration des boosters incomplète';
  end if;

  raise notice 'Boosters payants : % type(s) actif(s).', v_types;
end;
$$;
