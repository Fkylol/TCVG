-- ============================================================
-- Migration 065 — Suggestions et publication des personnages
--
-- Les propositions sont visibles et modifiables uniquement par un admin.
-- La publication crée la carte, ses genres et sa fiche en une transaction ;
-- les clients reçoivent uniquement les données publiques via card_edits, tandis
-- que le lore reste derrière card_profile() et le contrôle de possession.
-- ============================================================

alter table public.card_profiles
  add column if not exists quote text,
  add column if not exists power text;

alter table public.card_edits
  add column if not exists published_card jsonb,
  add column if not exists published_genres text[],
  add column if not exists image_width integer,
  add column if not exists image_height integer,
  add column if not exists image_source_name text,
  add column if not exists image_source_page text,
  add column if not exists image_file text,
  add column if not exists image_credit text,
  add column if not exists image_license text;

create table if not exists public.card_suggestions (
  id text primary key,
  card_id text not null unique,
  name text not null,
  universe text not null,
  universe_label text,
  rarity text not null check (rarity in ('C', 'UC', 'R', 'SR', 'UR', 'L')),
  emoji text not null,
  genres text[] not null,
  tagline text not null,
  bio text not null,
  quote text,
  power text,
  image_url text,
  image_source_name text,
  image_source_page text,
  image_file text,
  image_width integer,
  image_height integer,
  image_credit text,
  image_license text,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint card_suggestions_image_url_check check (image_url is null or image_url ~* '^https?://'),
  constraint card_suggestions_image_size_check check (
    (image_width is null and image_height is null) or (image_width > 0 and image_height > 0)
  )
);

alter table public.card_suggestions
  add column if not exists universe_label text;

alter table public.card_suggestions enable row level security;
revoke all on public.card_suggestions from public, anon, authenticated;
grant select on public.card_suggestions to authenticated;
drop policy if exists "card_suggestions_admin_read" on public.card_suggestions;
create policy "card_suggestions_admin_read"
  on public.card_suggestions for select to authenticated
  using (public.is_admin());

create index if not exists card_suggestions_status_created_idx
  on public.card_suggestions (status, created_at);

-- Les textes sont des résumés éditoriaux, éditables avant publication.
insert into public.card_suggestions (
  id, card_id, name, universe, rarity, emoji, genres, tagline, bio,
  image_url, image_source_name, image_source_page, image_file, image_width, image_height
) values
  (
    'suggestion-tingle', 'tingle', 'Tingle', 'zelda', 'UC', '🗺️',
    array['action-aventure'],
    'Cartographe excentrique qui rêve de devenir une fée',
    'Tingle est un adulte fantasque passionné par les fées et la cartographie. Il apparaît dans plusieurs aventures de la série The Legend of Zelda, où il aide Link avec ses cartes et ses services hauts en couleur.',
    'https://static.wikia.nocookie.net/zelda_gamepedia_en/images/4/40/Tingle_Balloon.png/revision/latest?cb=20110220225739',
    'zelda.fandom.com', 'https://zelda.fandom.com/wiki/File:Tingle_Balloon.png', 'Tingle Balloon.png', 714, 939
  ),
  (
    'suggestion-amy-rose', 'amy-rose', 'Amy Rose', 'sonic', 'R', '🌹',
    array['plateforme'],
    'Hérissonne déterminée au marteau redoutable',
    'Amy Rose est une hérissonne rose de l’univers Sonic, connue pour son énergie et sa détermination. Elle accompagne régulièrement Sonic dans ses aventures et se bat avec son marteau Piko Piko.',
    'https://static.wikia.nocookie.net/sonic/images/8/8c/Amy_Rose_2.png/revision/latest/scale-to-width-down/800?cb=20260320134635',
    'sonic.fandom.com', 'https://sonic.fandom.com/wiki/File:Amy_Rose_2.png', 'Amy Rose 2.png', 800, 1158
  ),
  (
    'suggestion-glados', 'glados', 'GLaDOS', 'portal', 'UR', '🤖',
    array['action-aventure'],
    'L’intelligence artificielle qui règne sur Aperture Science',
    'GLaDOS est l’intelligence artificielle qui contrôle le centre d’enrichissement d’Aperture Science. Elle met Chell à l’épreuve dans Portal et Portal 2, mêlant protocoles de test, humour glacial et intentions inquiétantes.',
    'https://static.wikia.nocookie.net/half-life/images/e/e0/GLaDOS.png/revision/latest?cb=20120621172457&path-prefix=en',
    'half-life.fandom.com', 'https://half-life.fandom.com/wiki/File:GLaDOS.png', 'GLaDOS.png', 749, 573
  )
on conflict (id) do nothing;

create or replace function public.admin_save_card_suggestion(p_id text, p_card jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_card->>'name', '')), '');
  v_universe text := nullif(btrim(coalesce(p_card->>'universe', '')), '');
  v_universe_label text := nullif(btrim(coalesce(p_card->>'universe_label', '')), '');
  v_rarity text := nullif(btrim(coalesce(p_card->>'rarity', '')), '');
  v_genres text[];
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.card_suggestions s where s.id = p_id and s.status = 'pending') then
    raise exception 'suggestion_not_pending' using errcode = '22023';
  end if;
  if coalesce(p_card->>'card_id', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Identifiant invalide.' using errcode = '22023';
  end if;
  if v_name is null or length(v_name) > 60 or v_universe is null or v_rarity is null
     or v_rarity not in ('C', 'UC', 'R', 'SR', 'UR', 'L') then
    raise exception 'Nom, univers ou rareté invalide.' using errcode = '22023';
  end if;
  if length(v_universe) > 80 or (v_universe_label is not null and length(v_universe_label) > 80) then
    raise exception 'Nom de franchise trop long.' using errcode = '22023';
  end if;
  if v_universe !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Identifiant de franchise invalide.' using errcode = '22023';
  end if;
  if exists (select 1 from public.franchises f where f.slug = v_universe and v_universe_label is not null
    and lower(btrim(f.name)) <> lower(btrim(v_universe_label))) then
    raise exception 'La franchise ne correspond pas au slug sélectionné.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.franchises f where f.slug = v_universe)
     and (v_universe_label is null or length(v_universe_label) < 2) then
    raise exception 'Nom de la nouvelle franchise manquant.' using errcode = '22023';
  end if;
  if exists (select 1 from public.franchises f where lower(btrim(f.name)) = lower(btrim(v_universe_label)) and f.slug <> v_universe) then
    raise exception 'Une franchise portant ce nom existe déjà.' using errcode = '22023';
  end if;
  if nullif(btrim(p_card->>'emoji'), '') is null
     or nullif(btrim(p_card->>'tagline'), '') is null
     or nullif(btrim(p_card->>'bio'), '') is null then
    raise exception 'Emoji, accroche et biographie sont obligatoires.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_card->'genres') <> 'array' or jsonb_array_length(p_card->'genres') = 0 then
    raise exception 'Choisis au moins un genre.' using errcode = '22023';
  end if;
  select array_agg(distinct input.value) into v_genres from jsonb_array_elements_text(p_card->'genres') as input(value);
  if exists (select 1 from unnest(v_genres) g where not exists (select 1 from public.genres known where known.slug = g)) then
    raise exception 'Genre inconnu.' using errcode = '22023';
  end if;
  if exists (select 1 from public.cards c where c.id = p_card->>'card_id'
    or (c.universe = v_universe and lower(btrim(c.name)) = lower(v_name)))
    or exists (select 1 from public.card_suggestions other where other.id <> p_id and other.status = 'pending'
      and (other.card_id = p_card->>'card_id' or (other.universe = v_universe and lower(btrim(other.name)) = lower(v_name)))) then
    raise exception 'Ce personnage ou identifiant existe déjà dans le catalogue.' using errcode = '22023';
  end if;
  if nullif(p_card->>'image_url', '') is not null and p_card->>'image_url' !~* '^https?://' then
    raise exception 'Le portrait doit utiliser une URL http(s).' using errcode = '22023';
  end if;
  if nullif(p_card->>'image_url', '') is not null and (
    coalesce((p_card->>'image_width')::integer, 0) <= 0 or coalesce((p_card->>'image_height')::integer, 0) <= 0
  ) then
    raise exception 'Dimensions du portrait manquantes.' using errcode = '22023';
  end if;

  update public.card_suggestions set
    card_id = p_card->>'card_id', name = v_name, universe = v_universe,
    universe_label = v_universe_label,
    rarity = v_rarity, emoji = btrim(p_card->>'emoji'), genres = v_genres,
    tagline = btrim(p_card->>'tagline'), bio = btrim(p_card->>'bio'),
    quote = nullif(btrim(coalesce(p_card->>'quote', '')), ''),
    power = nullif(btrim(coalesce(p_card->>'power', '')), ''),
    updated_by = auth.uid(),
    image_url = nullif(btrim(coalesce(p_card->>'image_url', '')), ''),
    image_source_name = nullif(btrim(coalesce(p_card->>'image_source_name', '')), ''),
    image_source_page = nullif(btrim(coalesce(p_card->>'image_source_page', '')), ''),
    image_file = nullif(btrim(coalesce(p_card->>'image_file', '')), ''),
    image_width = nullif(p_card->>'image_width', '')::integer,
    image_height = nullif(p_card->>'image_height', '')::integer,
    image_credit = nullif(btrim(coalesce(p_card->>'image_credit', '')), ''),
    image_license = nullif(btrim(coalesce(p_card->>'image_license', '')), ''),
    updated_at = now()
  where id = p_id and status = 'pending';
end;
$$;

create or replace function public.admin_publish_card_suggestion(p_id text, p_card jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion public.card_suggestions;
  v_franchise_id uuid;
  v_number integer;
  v_quality integer := greatest(0, least(100, coalesce((p_card->>'quality')::integer, 50)));
  v_genres text[];
  v_card jsonb;
  v_universe_label text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.card_suggestions s where s.id = p_id and s.status = 'pending') then
    raise exception 'suggestion_not_pending' using errcode = '22023';
  end if;

  perform public.admin_save_card_suggestion(p_id, p_card);
  select * into v_suggestion from public.card_suggestions where id = p_id for update;
  v_genres := v_suggestion.genres;
  v_universe_label := coalesce(v_suggestion.universe_label, v_suggestion.universe);
  insert into public.franchises (slug, name)
  values (v_suggestion.universe, v_universe_label)
  on conflict (slug) do nothing
  returning id into v_franchise_id;
  if v_franchise_id is null then
    select f.id into v_franchise_id from public.franchises f
    where f.slug = v_suggestion.universe and lower(btrim(f.name)) = lower(btrim(v_universe_label))
    for update;
    if v_franchise_id is null then
      raise exception 'Le slug de franchise est déjà utilisé par une autre franchise.' using errcode = '22023';
    end if;
  end if;
  select coalesce(max(c.number), 0) + 1 into v_number from public.cards c;

  insert into public.cards (id, name, universe, rarity, number, quality, franchise_id, active,
    image_url, image_source_name, image_source_page, image_license, image_width, image_height, image_checked_at, image_status)
  values (v_suggestion.card_id, v_suggestion.name, v_suggestion.universe, v_suggestion.rarity,
    v_number, v_quality, v_franchise_id, true, v_suggestion.image_url, v_suggestion.image_source_name,
    v_suggestion.image_source_page, v_suggestion.image_license, v_suggestion.image_width,
    v_suggestion.image_height, now(), case when v_suggestion.image_url is null then null else 'ok' end);

  insert into public.card_genres (card_id, genre_id)
  select v_suggestion.card_id, g.id from public.genres g where g.slug = any(v_genres);

  insert into public.card_profiles (card_id, overview, bio, quote, power, source_name, source_url)
  values (v_suggestion.card_id, v_suggestion.tagline, v_suggestion.bio, v_suggestion.quote,
    v_suggestion.power, v_suggestion.image_source_name, v_suggestion.image_source_page);

  v_card := jsonb_build_object('id', v_suggestion.card_id, 'name', v_suggestion.name,
    'universe', v_suggestion.universe, 'emoji', v_suggestion.emoji, 'rarity', v_suggestion.rarity);
  insert into public.card_edits (card_id, image_url, published_card, published_genres,
    image_width, image_height, image_source_name, image_source_page, image_file, image_credit, image_license, hidden, updated_by, updated_at)
  values (v_suggestion.card_id, v_suggestion.image_url, v_card, v_genres,
    v_suggestion.image_width, v_suggestion.image_height, v_suggestion.image_source_name,
    v_suggestion.image_source_page, v_suggestion.image_file, v_suggestion.image_credit,
    v_suggestion.image_license, false, auth.uid(), now())
  on conflict (card_id) do update set
    image_url = excluded.image_url, published_card = excluded.published_card,
    published_genres = excluded.published_genres, image_width = excluded.image_width,
    image_height = excluded.image_height, image_source_name = excluded.image_source_name,
    image_source_page = excluded.image_source_page, image_file = excluded.image_file,
    image_credit = excluded.image_credit, image_license = excluded.image_license,
    hidden = false, updated_by = excluded.updated_by, updated_at = now();

  update public.card_suggestions set status = 'published', reviewed_by = auth.uid(),
    reviewed_at = now(), updated_at = now() where id = p_id;
  return v_suggestion.card_id;
end;
$$;

create or replace function public.admin_reject_card_suggestion(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.card_suggestions set status = 'rejected', reviewed_by = auth.uid(),
    reviewed_at = now(), updated_at = now()
  where id = p_id and status = 'pending';
  if not found then raise exception 'suggestion_not_pending' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.admin_save_card_suggestion(text, jsonb) from public, anon;
revoke all on function public.admin_publish_card_suggestion(text, jsonb) from public, anon;
revoke all on function public.admin_reject_card_suggestion(text) from public, anon;
grant execute on function public.admin_save_card_suggestion(text, jsonb) to authenticated;
grant execute on function public.admin_publish_card_suggestion(text, jsonb) to authenticated;
grant execute on function public.admin_reject_card_suggestion(text) to authenticated;

-- card_profile reste l'unique lecture du lore ; aucune fiche non possédée ne
-- reçoit l'accroche, la bio, la citation ou le pouvoir.
create or replace function public.card_profile(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.card_profiles;
  v_appearances jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.cards k where k.id = p_card_id and k.active) then
    return jsonb_build_object('unlocked', false, 'missing', true);
  end if;
  if not exists (select 1 from public.collection c where c.user_id = v_uid and c.card_id = p_card_id) then
    return jsonb_build_object('unlocked', false);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('media', a.media, 'title', a.title) order by a.position), '[]'::jsonb)
    into v_appearances from public.card_appearances a where a.card_id = p_card_id;
  select * into v_row from public.card_profiles where card_id = p_card_id;
  if v_row.card_id is null then return jsonb_build_object('unlocked', true, 'appearances', v_appearances); end if;
  return jsonb_build_object('unlocked', true, 'overview', v_row.overview, 'bio', v_row.bio,
    'quote', v_row.quote, 'power', v_row.power, 'appearances', v_appearances,
    'studio', v_row.studio, 'voice', v_row.voice, 'trivia', v_row.trivia,
    'source_name', v_row.source_name, 'source_url', v_row.source_url);
end;
$$;
revoke all on function public.card_profile(text) from public, anon;
grant execute on function public.card_profile(text) to authenticated;
