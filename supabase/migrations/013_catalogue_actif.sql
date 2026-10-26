-- ============================================================
--  Migration 013 — Catalogue actif, retrait réversible, variantes
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque (idempotente).
--
--  Objectif : pouvoir retirer une carte ou une franchise sans jamais
--  supprimer de ligne (les collections et l'historique restent intacts),
--  ajouter la correspondance unique des raretés et exposer la vue
--  « cartes jouables » utilisée par le tirage des boosters.
--
--  Réversibilité : le bloc ROLLBACK en fin de fichier annule tout.
-- ============================================================

-- ————— 1. Franchises : statut de retrait —————
-- Une franchise retirée désactive toutes ses cartes d'un coup (voir la vue
-- playable_cards) sans toucher aux cartes elles-mêmes.
alter table public.franchises
  add column if not exists active boolean not null default true,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_reason text;

-- ————— 2. Cartes : statut de retrait —————
-- Aucun champ image : les visuels restent des URL externes (src/data/portraits.json),
-- hotlinkées, jamais copiées ni servies par l'application.
alter table public.cards
  add column if not exists active boolean not null default true,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_reason text;

-- Une carte ne peut pas être « inactive » sans date ni raison : le retrait
-- doit toujours être traçable.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_retired_trace_check') then
    alter table public.cards
      add constraint cards_retired_trace_check
      check (active or retired_reason is not null);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'franchises_retired_trace_check') then
    alter table public.franchises
      add constraint franchises_retired_trace_check
      check (active or retired_reason is not null);
  end if;
end;
$$;

-- ————— 3. Collection : variante cosmétique (misprint) —————
-- NULL = carte normale. Aucun effet sur le gameplay : c'est purement visuel.
alter table public.collection
  add column if not exists variant text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'collection_variant_check') then
    alter table public.collection
      add constraint collection_variant_check
      check (variant is null or variant in ('holo_bleed', 'off_center', 'ghosting'));
  end if;
end;
$$;

-- ————— 4. Correspondance unique des raretés —————
-- Une seule table fait autorité pour le nom affiché, la lettre du badge et
-- le token de couleur. Les clés historiques (C/R/SR/UR/L) sont conservées :
-- les renommer casserait les collections déjà enregistrées.
create table if not exists public.rarity_labels (
  key text primary key,
  name text not null,
  letter text not null,
  token text not null
);

insert into public.rarity_labels (key, name, letter, token) values
  ('C',  'Commun',    'C', 'rarity-C'),
  ('R',  'Rare',      'R', 'rarity-R'),
  ('SR', 'Épique',    'E', 'rarity-E'),
  ('UR', 'Légendaire', 'L', 'rarity-L'),
  ('L',  'Mythique',  'M', 'rarity-M')
on conflict (key) do update
  set name = excluded.name,
      letter = excluded.letter,
      token = excluded.token;

alter table public.rarity_labels enable row level security;

drop policy if exists "rarity_labels: lecture publique" on public.rarity_labels;
create policy "rarity_labels: lecture publique"
  on public.rarity_labels for select using (true);

revoke all on public.rarity_labels from anon, authenticated;
grant select on public.rarity_labels to anon, authenticated;

-- ————— 5. Vue « cartes jouables » —————
-- Une carte est jouable seulement si elle ET sa franchise sont actives.
-- C'est la seule définition du pool de tirage : le code ne décide jamais
-- d'une exception.
create or replace view public.playable_cards
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.rarity,
  c.number,
  c.franchise_id
  from public.cards c
  join public.franchises f on f.id = c.franchise_id
 where c.active
   and f.active;

grant select on public.playable_cards to anon, authenticated;

-- ————— 6. Contrôles finaux —————
do $$
declare
  v_cards integer;
  v_active integer;
  v_playable integer;
  v_labels integer;
begin
  select count(*) into v_cards from public.cards;
  select count(*) into v_active from public.cards where active;
  select count(*) into v_playable from public.playable_cards;
  select count(*) into v_labels from public.rarity_labels;

  if v_labels <> 5 then
    raise exception 'rarity_labels : % lignes au lieu de 5', v_labels;
  end if;

  -- Aucune carte ne doit être désactivée par accident au moment de la migration.
  if v_active <> v_cards then
    raise exception 'cartes inactives inattendues : % actives sur %', v_active, v_cards;
  end if;

  raise notice 'catalogue : % cartes, % jouables, % raretés', v_cards, v_playable, v_labels;
end;
$$;

-- ============================================================
--  ROLLBACK (exécuter à la main si retour arrière nécessaire)
-- ============================================================
-- drop view if exists public.playable_cards;
--
-- drop policy if exists "rarity_labels: lecture publique" on public.rarity_labels;
-- drop table if exists public.rarity_labels;
--
-- alter table public.collection drop constraint if exists collection_variant_check;
-- alter table public.collection drop column if exists variant;
--
-- alter table public.cards drop constraint if exists cards_retired_trace_check;
-- alter table public.cards
--   drop column if exists image_path,
--   drop column if exists retired_reason,
--   drop column if exists retired_at,
--   drop column if exists active;
--
-- alter table public.franchises drop constraint if exists franchises_retired_trace_check;
-- alter table public.franchises
--   drop column if exists retired_reason,
--   drop column if exists retired_at,
--   drop column if exists active;
