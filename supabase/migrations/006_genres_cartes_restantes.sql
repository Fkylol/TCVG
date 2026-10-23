-- ============================================================
--  Migration 006 — genres des 9 cartes restantes
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
-- ============================================================

-- Attribution décidée par le propriétaire du projet :
--   Portal (chell, glados, wheatley)   → Plateforme
--   Cuphead (cuphead, king-dice)       → Plateforme
--   Minecraft (steve, creeper, ender-dragon) → Action-Aventure
--   Splatoon (inkling)                 → FPS
insert into public.card_genres (card_id, genre_id)
select c.id, g.id
  from (values
    ('chell', 'plateforme'),
    ('glados', 'plateforme'),
    ('wheatley', 'plateforme'),
    ('cuphead', 'plateforme'),
    ('king-dice', 'plateforme'),
    ('steve', 'action-aventure'),
    ('creeper', 'action-aventure'),
    ('ender-dragon', 'action-aventure'),
    ('inkling', 'fps')
  ) as m(card_slug, genre_slug)
  join public.cards c on c.id = m.card_slug
  join public.genres g on g.slug = m.genre_slug
on conflict do nothing;

-- Contrôle : plus aucune carte sans genre.
do $$
declare
  v_missing integer;
  v_list text;
begin
  select count(*), string_agg(c.id, ', ' order by c.id)
    into v_missing, v_list
    from public.cards c
   where not exists (select 1 from public.card_genres g where g.card_id = c.id);

  if v_missing > 0 then
    raise exception '% carte(s) sans genre : %', v_missing, v_list;
  end if;

  raise notice 'Toutes les cartes ont au moins un genre.';
end;
$$;
