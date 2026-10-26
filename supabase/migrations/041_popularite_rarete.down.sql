-- ============================================================
--  Retour arrière de la migration 041.
--  Ne touche pas à `cards.rarity` : pour revenir aux raretés d'avant le
--  calcul, utiliser `npm run rarity:rollback`.
-- ============================================================

drop table if exists public.rarity_runs;

drop index if exists public.cards_wikidata_idx;
drop index if exists public.cards_popularity_idx;

alter table public.cards
  drop constraint if exists cards_match_status_check,
  drop constraint if exists cards_rarity_override_check,
  drop constraint if exists cards_rarity_v1_check,
  drop constraint if exists cards_match_confidence_check;

alter table public.cards
  drop column if exists wikidata_id,
  drop column if exists wikipedia_titles,
  drop column if exists match_confidence,
  drop column if exists match_status,
  drop column if exists match_notes,
  drop column if exists pageviews_median_12m,
  drop column if exists sitelinks_count,
  drop column if exists popularity_score,
  drop column if exists popularity_computed_at,
  drop column if exists rarity_v1,
  drop column if exists rarity_override,
  drop column if exists rarity_override_reason,
  drop column if exists rarity_locked,
  drop column if exists rarity_version;

alter table public.franchises
  drop column if exists wikidata_id,
  drop column if exists popularity_score,
  drop column if exists popularity_computed_at,
  drop column if exists popularity_sources;
