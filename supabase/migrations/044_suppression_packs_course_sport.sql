-- ============================================================
--  044 — Retrait des boosters Course et Sport
--
--  Les deux packs n'avaient pas de catalogue à la hauteur (Course : 6
--  personnages, Sport : 1) et disparaissent, avec leur genre, leurs chances
--  par carte et leurs franchises devenues vides.
--
--  Les cartes elles-mêmes ne sont pas supprimées ici : le catalogue fait foi
--  dans `src/lib/cards.ts`, et c'est `npm run db:cards` qui retire de la base
--  les cartes sorties du catalogue (avec collections, annonces et envies, en
--  cascade). Cette migration ne touche qu'aux tables de packs et de genres.
--
--  Retour arrière : `044_suppression_packs_course_sport.down.sql` recrée les
--  deux genres et les deux types de booster, sans leurs chances par carte
--  (elles se recalculent avec `npm run db:genres`).
-- ============================================================

-- Aucune chance par carte n'est stockée (`card_booster_chances()` les calcule
-- depuis les tables de packs) : retirer le type de booster suffit.
delete from public.booster_types where slug in ('course', 'sport');

-- Le genre emporte ses rattachements de cartes (`card_genres`, en cascade).
delete from public.genres where slug in ('course', 'sport');

-- Franchises sans aucune carte : Need for Speed, Top Gear et DiRT n'étaient
-- peuplées que par les cartes retirées.
delete from public.franchises f
 where not exists (select 1 from public.cards c where c.franchise_id = f.id)
   and f.slug in ('nfs', 'topgear', 'dirt');

-- Contrôles finaux
do $$
begin
  if exists (select 1 from public.booster_types where slug in ('course', 'sport')) then
    raise exception 'booster Course/Sport encore présent';
  end if;
  if exists (select 1 from public.genres where slug in ('course', 'sport')) then
    raise exception 'genre Course/Sport encore présent';
  end if;
end $$;
