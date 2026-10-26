-- ============================================================
--  Migration 041 — Popularité et rareté calculée
--  Réversible : voir 041_popularite_rarete.down.sql
--
--  Ajoute le modèle de données nécessaire au calcul de rareté par popularité.
--  Aucune valeur existante n'est écrasée : `cards.rarity` reste la rareté
--  active, `cards.rarity_v1` conservera l'ancienne au moment de l'application.
--
--  Les clés de rareté (`C`, `UC`, `R`, `SR`, `UR`, `L`) ne changent pas : la
--  correspondance affichée (Commune … Mythique) vit dans `public.rarity_labels`
--  et `src/lib/rarity.ts`.
-- ============================================================

alter table public.cards
  add column if not exists wikidata_id text,
  add column if not exists wikipedia_titles jsonb,
  add column if not exists match_confidence numeric(4, 3),
  add column if not exists match_status text,
  add column if not exists match_notes jsonb,
  add column if not exists pageviews_median_12m jsonb,
  add column if not exists sitelinks_count integer,
  add column if not exists popularity_score numeric(6, 2),
  add column if not exists popularity_computed_at timestamptz,
  add column if not exists rarity_v1 text,
  add column if not exists rarity_override text,
  add column if not exists rarity_override_reason text,
  add column if not exists rarity_locked boolean not null default false,
  add column if not exists rarity_version integer not null default 0;

alter table public.cards
  drop constraint if exists cards_match_status_check,
  add constraint cards_match_status_check
    check (match_status is null or match_status in ('auto', 'repli', 'aucun')),
  drop constraint if exists cards_rarity_override_check,
  add constraint cards_rarity_override_check
    check (rarity_override is null or rarity_override in ('C', 'UC', 'R', 'SR', 'UR', 'L')),
  drop constraint if exists cards_rarity_v1_check,
  add constraint cards_rarity_v1_check
    check (rarity_v1 is null or rarity_v1 in ('C', 'UC', 'R', 'SR', 'UR', 'L')),
  drop constraint if exists cards_match_confidence_check,
  add constraint cards_match_confidence_check
    check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1));

comment on column public.cards.rarity_v1 is
  'Rareté d''avant le calcul de popularité. Conservée pour toujours (rollback et historique).';
comment on column public.cards.rarity_locked is
  'Une fois appliquée, la rareté d''une carte ne bouge plus sans décision explicite.';
comment on column public.cards.match_status is
  'auto : correspondance Wikidata fiable ; repli : score = 30 % de la franchise ; aucun : pas de donnée.';

alter table public.franchises
  add column if not exists wikidata_id text,
  add column if not exists popularity_score numeric(6, 2),
  add column if not exists popularity_computed_at timestamptz,
  add column if not exists popularity_sources jsonb;

create index if not exists cards_popularity_idx on public.cards (popularity_score desc nulls last);
create index if not exists cards_wikidata_idx on public.cards (wikidata_id);

-- Journal d'application : une ligne par exécution de rarity:apply.
create table if not exists public.rarity_runs (
  id bigserial primary key,
  applied_at timestamptz not null default now(),
  card_count integer not null,
  distribution jsonb not null,
  config jsonb not null,
  previous_rarities jsonb not null,
  applied_by text,
  -- Bilan de l'exécution : cartes changées, annonces et ordres annulés.
  summary jsonb not null default '{}'::jsonb,
  -- Renseigné par `rarity:rollback` : l'exécution a été annulée.
  rolled_back_at timestamptz
);

alter table public.rarity_runs enable row level security;
revoke all on public.rarity_runs from anon, authenticated;

do $$
declare
  v_columns integer;
begin
  select count(*)::int into v_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cards'
     and column_name in (
       'wikidata_id', 'wikipedia_titles', 'match_confidence', 'match_status',
       'match_notes', 'pageviews_median_12m', 'sitelinks_count',
       'popularity_score', 'popularity_computed_at', 'rarity_v1',
       'rarity_override', 'rarity_override_reason', 'rarity_locked',
       'rarity_version'
     );

  if v_columns <> 14 then
    raise exception 'colonnes de popularité incomplètes (% / 14)', v_columns;
  end if;

  raise notice 'Popularité : modèle de données en place (cards + franchises + rarity_runs).';
end;
$$;
