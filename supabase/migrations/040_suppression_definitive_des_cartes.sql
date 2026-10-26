-- ============================================================
--  Migration 040 — Une carte supprimée disparaît pour de bon
--  Rejouable sans risque.
--
--  Constat : `collection.card_id` n'avait aucune clé étrangère vers `cards`.
--  Supprimer une carte laissait donc ses copies orphelines, et le catalogue se
--  contentait de les désactiver (`active = false`, « Retirée du catalogue »).
--  Cinq cartes mortes traînaient ainsi en base et dans les collections.
--
--  Correctif (le jeu est en développement, aucune donnée à préserver) :
--    • les copies et traces d'audit orphelines sont effacées ;
--    • `collection` reçoit sa clé étrangère en cascade, comme les autres
--      tables qui portent un `card_id` ;
--    • les cartes déjà désactivées sont supprimées, et leurs copies avec.
--
--  Ce que la suppression efface, par cascade : collection, wishlist, annonces
--  du marché et du carnet d'ordres, échanges, genres, fiches éditoriales,
--  apparitions, annonces du chat et propositions d'échange. L'avatar d'un
--  profil et les notifications qui citaient la carte sont remis à NULL.
-- ============================================================

-- ————— 1. Copies et traces orphelines —————
delete from public.collection c
 where not exists (select 1 from public.cards k where k.id = c.card_id);

delete from public.market_audit a
 where a.card_id is not null
   and not exists (select 1 from public.cards k where k.id = a.card_id);

-- ————— 2. La collection suit désormais la carte —————
alter table public.collection
  drop constraint if exists collection_card_id_fkey;

alter table public.collection
  add constraint collection_card_id_fkey
  foreign key (card_id) references public.cards (id) on delete cascade;

-- ————— 3. Les cartes retirées quittent la base —————
-- Une carte « retirée du catalogue » n'a plus de ligne du tout : ni fiche, ni
-- copie, ni annonce. Le code ne la connaît plus non plus (npm run db:cards
-- supprime les identifiants absents de src/lib/cards.ts).
delete from public.cards where active = false;

-- ————— 4. Contrôles finaux —————
do $$
declare
  v_cards integer;
  v_orphans integer;
  v_inactive integer;
begin
  select count(*)::int into v_cards from public.cards;
  select count(*)::int into v_inactive from public.cards where active = false;
  select count(*)::int into v_orphans
    from public.collection c
   where not exists (select 1 from public.cards k where k.id = c.card_id);

  if v_inactive > 0 then
    raise exception 'cartes encore désactivées : %', v_inactive;
  end if;
  if v_orphans > 0 then
    raise exception 'copies orphelines restantes : %', v_orphans;
  end if;

  raise notice 'Catalogue : % cartes, aucune copie orpheline.', v_cards;
end;
$$;
