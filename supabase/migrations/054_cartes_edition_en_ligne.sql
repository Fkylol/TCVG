-- ============================================================
--  Migration 054 — CATALOGUE ÉDITABLE EN LIGNE
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Le catalogue du site vit dans le code (`src/lib/cards.ts`), poussé vers
--  `public.cards` par `npm run db:cards`. Un Worker n'a pas de disque : pour
--  modifier ou retirer une carte depuis le site, il faut donc une couche en
--  base, relue à chaque rendu.
--
--  `card_edits` porte cette couche, par-dessus le catalogue :
--    • `name`, `rarity`, `universe`, `emoji`, `image_url` remplacent les
--      valeurs du code quand elles sont renseignées ;
--    • `hidden` retire la carte du jeu (tombstone : elle survit à la
--      suppression de la ligne `cards`, sinon `db:cards` la réinsérerait).
--
--  Écriture réservée à l'atelier, par liste nominative (`fkyzu`,
--  `deathsky74`, `asperge`) : la table n'est lisible que par les joueurs, et
--  les deux fonctions ci-dessous sont les seules à pouvoir écrire.
-- ============================================================

-- ————— 1. La couche d'édition —————
create table if not exists public.card_edits (
  -- Pas de clé étrangère : la trace de suppression doit survivre à la carte.
  card_id text primary key,
  name text,
  rarity text check (rarity is null or rarity in ('C', 'UC', 'R', 'SR', 'UR', 'L')),
  universe text,
  emoji text,
  image_url text,
  hidden boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.card_edits enable row level security;

revoke all on public.card_edits from anon, authenticated;
grant select on public.card_edits to authenticated, anon;

drop policy if exists "card_edits: lecture publique" on public.card_edits;
create policy "card_edits: lecture publique"
  on public.card_edits for select
  using (true);

-- ————— 2. Qui a le droit d'écrire —————
create or replace function public.is_atelier()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and lower(p.username) in ('fkyzu', 'deathsky74', 'asperge')
  );
$$;

revoke all on function public.is_atelier() from public, anon;
grant execute on function public.is_atelier() to authenticated;

-- ————— 3. Modifier une carte (publication immédiate) —————
create or replace function public.atelier_save_card_edit(
  p_card_id text,
  p_name text,
  p_rarity text,
  p_universe text,
  p_emoji text,
  p_image_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_universe text := nullif(btrim(coalesce(p_universe, '')), '');
  v_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
  v_image text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_rarity text := nullif(btrim(coalesce(p_rarity, '')), '');
begin
  if not public.is_atelier() then
    raise exception 'Atelier : accès refusé.' using errcode = '42501';
  end if;

  if p_card_id is null or p_card_id = '' then
    raise exception 'Carte inconnue.';
  end if;

  if v_rarity is not null and v_rarity not in ('C', 'UC', 'R', 'SR', 'UR', 'L') then
    raise exception 'Rareté inconnue : %', v_rarity;
  end if;

  if v_image is not null and v_image !~* '^https?://' then
    raise exception 'Le visuel doit être une URL http(s).';
  end if;

  insert into public.card_edits (card_id, name, rarity, universe, emoji, image_url, updated_by, updated_at)
  values (p_card_id, v_name, v_rarity, v_universe, v_emoji, v_image, auth.uid(), now())
  on conflict (card_id) do update
    set name = excluded.name,
        rarity = excluded.rarity,
        universe = excluded.universe,
        emoji = excluded.emoji,
        image_url = excluded.image_url,
        updated_by = excluded.updated_by,
        updated_at = now();

  -- La base suit, pour le tirage des boosters et les jointures du marché.
  update public.cards
     set name = coalesce(v_name, name),
         rarity = coalesce(v_rarity, rarity),
         universe = coalesce(v_universe, universe),
         updated_at = now()
   where id = p_card_id;
end;
$$;

revoke all on function public.atelier_save_card_edit(text, text, text, text, text, text) from public, anon;
grant execute on function public.atelier_save_card_edit(text, text, text, text, text, text) to authenticated;

-- ————— 4. Supprimer complètement une carte —————
--  Tout ce qui s'y rattache s'en va : copies des joueurs, annonces, ordres,
--  envies, fiches et signalements. Le catalogue garde une tombe (`hidden`)
--  pour que le site ne la ressuscite pas et que `db:cards` puisse la
--  réinsérer sans la faire réapparaître.
create or replace function public.atelier_delete_card(p_card_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_atelier() then
    raise exception 'Atelier : accès refusé.' using errcode = '42501';
  end if;

  if p_card_id is null or p_card_id = '' then
    raise exception 'Carte inconnue.';
  end if;

  delete from public.collection where card_id = p_card_id;
  delete from public.market_listings where card_id = p_card_id;
  delete from public.buy_orders where card_id = p_card_id;
  delete from public.wishlist where card_id = p_card_id;
  delete from public.card_reports where card_id = p_card_id;

  -- Les tables éditoriales tombent avec la carte (clés en cascade).
  delete from public.cards where id = p_card_id;

  insert into public.card_edits (card_id, hidden, updated_by, updated_at)
  values (p_card_id, true, auth.uid(), now())
  on conflict (card_id) do update
    set hidden = true, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

revoke all on function public.atelier_delete_card(text) from public, anon;
grant execute on function public.atelier_delete_card(text) to authenticated;

-- ————— 5. Contrôles finaux —————
do $$
begin
  if to_regclass('public.card_edits') is null then
    raise exception 'card_edits absente après migration';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('atelier_save_card_edit', 'atelier_delete_card')
     group by n.nspname
    having count(*) = 2
  ) then
    raise exception 'Fonctions d''édition absentes après migration';
  end if;

  raise notice 'Catalogue éditable en ligne : % ligne(s) d''édition.',
    (select count(*) from public.card_edits);
end
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop function if exists public.atelier_delete_card(text);
--  drop function if exists public.atelier_save_card_edit(text, text, text, text, text, text);
--  drop function if exists public.is_atelier();
--  drop table if exists public.card_edits;
-- ============================================================
