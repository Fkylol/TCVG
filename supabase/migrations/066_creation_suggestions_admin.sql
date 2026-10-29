-- Migration 066 — création des suggestions via une RPC admin
-- La table card_suggestions reste en écriture interdite aux clients ; cette
-- fonction vérifie l'admin puis n'insère que les colonnes prévues.

create or replace function public.admin_create_card_suggestion(p_card jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := nullif(btrim(coalesce(p_card->>'id', '')), '');
  v_card_id text := nullif(btrim(coalesce(p_card->>'card_id', '')), '');
  v_name text := nullif(btrim(coalesce(p_card->>'name', '')), '');
  v_universe text := nullif(btrim(coalesce(p_card->>'universe', '')), '');
  v_universe_label text := nullif(btrim(coalesce(p_card->>'universe_label', '')), '');
  v_rarity text := nullif(btrim(coalesce(p_card->>'rarity', '')), '');
  v_genres text[];
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_id is null or v_card_id is null or v_card_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Identifiant de suggestion ou de carte invalide.' using errcode = '22023';
  end if;
  if v_name is null or length(v_name) > 60 or v_universe is null or v_rarity not in ('C', 'UC', 'R', 'SR', 'UR', 'L') then
    raise exception 'Nom, franchise ou rareté invalide.' using errcode = '22023';
  end if;
  if v_universe !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_universe) > 80
     or (v_universe_label is not null and length(v_universe_label) > 80) then
    raise exception 'Identifiant ou nom de franchise invalide.' using errcode = '22023';
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
  if nullif(btrim(coalesce(p_card->>'emoji', '')), '') is null
     or nullif(btrim(coalesce(p_card->>'tagline', '')), '') is null
     or nullif(btrim(coalesce(p_card->>'bio', '')), '') is null then
    raise exception 'Emoji, accroche et biographie sont obligatoires.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_card->'genres') <> 'array' or jsonb_array_length(p_card->'genres') = 0 then
    raise exception 'Choisis au moins un genre.' using errcode = '22023';
  end if;
  select array_agg(distinct input.value) into v_genres
    from jsonb_array_elements_text(p_card->'genres') as input(value);
  if exists (select 1 from unnest(v_genres) g where not exists (select 1 from public.genres known where known.slug = g)) then
    raise exception 'Genre inconnu.' using errcode = '22023';
  end if;
  if exists (select 1 from public.cards c where c.id = v_card_id
    or (c.universe = v_universe and lower(btrim(c.name)) = lower(v_name))) then
    raise exception 'Ce personnage existe déjà dans le catalogue.' using errcode = '22023';
  end if;
  if nullif(p_card->>'image_url', '') is not null and p_card->>'image_url' !~* '^https?://' then
    raise exception 'Le portrait doit utiliser une URL http(s).' using errcode = '22023';
  end if;
  if nullif(p_card->>'image_url', '') is not null and (
    coalesce((p_card->>'image_width')::integer, 0) <= 0 or coalesce((p_card->>'image_height')::integer, 0) <= 0
  ) then
    raise exception 'Dimensions du portrait manquantes.' using errcode = '22023';
  end if;

  insert into public.card_suggestions (
    id, card_id, name, universe, universe_label, rarity, emoji, genres,
    tagline, bio, quote, power, image_url, image_source_name, image_source_page,
    image_file, image_width, image_height, image_credit, image_license, created_by
  ) values (
    v_id, v_card_id, v_name, v_universe, v_universe_label, v_rarity,
    btrim(p_card->>'emoji'), v_genres, btrim(p_card->>'tagline'), btrim(p_card->>'bio'),
    nullif(btrim(coalesce(p_card->>'quote', '')), ''),
    nullif(btrim(coalesce(p_card->>'power', '')), ''),
    nullif(btrim(coalesce(p_card->>'image_url', '')), ''),
    nullif(btrim(coalesce(p_card->>'image_source_name', '')), ''),
    nullif(btrim(coalesce(p_card->>'image_source_page', '')), ''),
    nullif(btrim(coalesce(p_card->>'image_file', '')), ''),
    nullif(p_card->>'image_width', '')::integer,
    nullif(p_card->>'image_height', '')::integer,
    nullif(btrim(coalesce(p_card->>'image_credit', '')), ''),
    nullif(btrim(coalesce(p_card->>'image_license', '')), ''),
    auth.uid()
  );
end;
$$;

revoke all on function public.admin_create_card_suggestion(jsonb) from public, anon;
grant execute on function public.admin_create_card_suggestion(jsonb) to authenticated;
