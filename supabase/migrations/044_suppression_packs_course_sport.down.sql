-- ============================================================
--  Retour arrière de la 044 : les genres et les boosters Course et Sport
--  reviennent, vides. Les cartes, elles, ne reviennent pas : elles ne sont
--  plus dans `src/lib/cards.ts`, et `npm run db:cards` les a retirées.
--  Rejouer `npm run db:genres` pour réalimenter `card_genres`.
-- ============================================================

insert into public.genres (slug, name, description)
values
  ('course', 'Course', 'Vitesse et trajectoires.'),
  ('sport', 'Sport', 'Simulation ou arcade d''une discipline sportive.')
on conflict (slug) do nothing;

insert into public.booster_types (slug, name, genre_id, cards_count)
select 'course', 'Booster Course', g.id, 5 from public.genres g where g.slug = 'course'
on conflict (slug) do nothing;

insert into public.booster_types (slug, name, genre_id, cards_count)
select 'sport', 'Booster Sport', g.id, 5 from public.genres g where g.slug = 'sport'
on conflict (slug) do nothing;
