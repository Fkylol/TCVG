-- ============================================================
-- Migration 062 — rattacher le Murloc au booster MMO
-- Correction minimale : cette entrée manque dans public.card_genres.
-- Rejouable sans risque ; n'active pas et ne modifie pas la carte.
-- ============================================================

begin;

do $$
begin
  if not exists (
    select 1
      from public.cards
     where id = 'murloc'
       and universe = 'wow'
       and active = true
  ) then
    raise exception 'Murloc : carte active du catalogue WoW introuvable ; aucune modification effectuée';
  end if;

  if not exists (
    select 1 from public.genres where slug = 'mmo'
  ) then
    raise exception 'Genre MMO introuvable ; aucune modification effectuée';
  end if;
end;
$$;

insert into public.card_genres (card_id, genre_id)
select c.id, g.id
  from public.cards c
  cross join public.genres g
 where c.id = 'murloc'
   and c.universe = 'wow'
   and g.slug = 'mmo'
on conflict (card_id, genre_id) do nothing;

do $$
begin
  if not exists (
    select 1
      from public.card_genres cg
      join public.genres g on g.id = cg.genre_id
     where cg.card_id = 'murloc'
       and g.slug = 'mmo'
  ) then
    raise exception 'Murloc : rattachement au genre MMO absent après migration';
  end if;
end;
$$;

commit;

-- Retour arrière manuel, si nécessaire :
-- delete from public.card_genres cg
--  using public.genres g
--  where cg.genre_id = g.id
--    and cg.card_id = 'murloc'
--    and g.slug = 'mmo';
