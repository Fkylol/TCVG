-- ============================================================
--  Migration 027 — ALERTES : une carte enviée arrive en vente
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Quatrième événement dans `notifications` : `wishlist_listing`, envoyé aux
--  joueurs qui ont la carte en envies — jamais au vendeur — quand :
--    • une annonce active apparaît pour cette carte ;
--    • son prix baisse.
--
--  Une seule alerte par couple (joueur, annonce, montant) : remonter un prix
--  puis le baisser à nouveau ne recrée pas de doublon. Les annonces échues ne
--  notifient personne.
-- ============================================================

-- ————— Le type d'événement s'ajoute à la liste —————
alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing'));

-- Anti-doublon : même joueur, même annonce, même montant.
create unique index if not exists notifications_wishlist_once_idx
  on public.notifications (user_id, listing_id, amount)
  where kind = 'wishlist_listing';

-- ————— Trigger —————
create or replace function public.notify_wishlist_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Seules les annonces réellement achetables préviennent.
  if new.status <> 'active' then
    return null;
  end if;

  if new.expires_at is not null and new.expires_at <= now() then
    return null;
  end if;

  -- Une mise à jour ne notifie que si le prix baisse.
  if tg_op = 'UPDATE' and not (new.price_pixels < old.price_pixels) then
    return null;
  end if;

  insert into public.notifications (user_id, kind, card_id, listing_id, amount)
  select w.user_id, 'wishlist_listing', new.card_id, new.id, new.price_pixels
    from public.wishlist w
   where w.card_id = new.card_id
     and w.user_id <> new.seller_id
  on conflict do nothing;

  return null;
end;
$$;

revoke all on function public.notify_wishlist_listing() from public;
revoke all on function public.notify_wishlist_listing() from anon;
revoke all on function public.notify_wishlist_listing() from authenticated;

drop trigger if exists notify_wishlist_listing on public.market_listings;
create trigger notify_wishlist_listing
  after insert or update of price_pixels on public.market_listings
  for each row execute function public.notify_wishlist_listing();

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'notifications_kind_check'
       and pg_get_constraintdef(oid) like '%wishlist_listing%'
  ) then
    raise exception 'contrainte de type sans wishlist_listing';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'notify_wishlist_listing') then
    raise exception 'trigger d''alerte envies absent';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'notifications_wishlist_once_idx'
  ) then
    raise exception 'index anti-doublon absent';
  end if;

  raise notice 'Alertes envies en place (% envies enregistrées).',
    (select count(*) from public.wishlist);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop trigger if exists notify_wishlist_listing on public.market_listings;
--  drop function if exists public.notify_wishlist_listing();
--  drop index if exists public.notifications_wishlist_once_idx;
--  delete from public.notifications where kind = 'wishlist_listing';
--  alter table public.notifications drop constraint if exists notifications_kind_check;
--  alter table public.notifications
--    add constraint notifications_kind_check
--    check (kind in ('listing_sold', 'order_filled', 'listing_expired'));
-- ============================================================
