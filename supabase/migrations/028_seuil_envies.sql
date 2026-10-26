-- ============================================================
--  Migration 028 — ENVIES : « préviens-moi sous ◆ X »
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  `wishlist.max_price` est un seuil facultatif, par envie :
--    • nul   → toute mise en vente et toute baisse de prix alertent ;
--    • rempli → l'alerte part seulement à l'arrivée sous le seuil, ou au
--      franchissement du seuil à la baisse. Une baisse qui reste sous le
--      seuil ne renotifie pas : pas de cloche à chaque Pixel.
--
--  Le seuil n'est jamais modifiable directement : `update` sur `wishlist`
--  n'est pas accordé au client, tout passe par `set_wishlist_alert()`.
-- ============================================================

alter table public.wishlist
  add column if not exists max_price integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wishlist_max_price_check'
  ) then
    alter table public.wishlist
      add constraint wishlist_max_price_check
      check (max_price is null or max_price > 0);
  end if;
end;
$$;

-- ————— Trigger d'alerte, recalibré sur le seuil —————
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

  -- Une mise à jour ne compte que si le prix baisse.
  if tg_op = 'UPDATE' and not (new.price_pixels < old.price_pixels) then
    return null;
  end if;

  insert into public.notifications (user_id, kind, card_id, listing_id, amount)
  select w.user_id, 'wishlist_listing', new.card_id, new.id, new.price_pixels
    from public.wishlist w
   where w.card_id = new.card_id
     and w.user_id <> new.seller_id
     and case
           -- Sans seuil : toute annonce, toute baisse.
           when w.max_price is null then true
           -- Au-dessus du seuil : rien à signaler.
           when new.price_pixels > w.max_price then false
           -- Sous le seuil : alerte à l'apparition, puis seulement au
           -- franchissement (une baisse qui reste sous le seuil est muette).
           else tg_op = 'INSERT' or old.price_pixels > w.max_price
         end
  on conflict do nothing;

  return null;
end;
$$;

revoke all on function public.notify_wishlist_listing() from public;
revoke all on function public.notify_wishlist_listing() from anon;
revoke all on function public.notify_wishlist_listing() from authenticated;

-- ————— Régler son seuil —————
create or replace function public.set_wishlist_alert(
  p_card_id text,
  p_max_price integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_max_price is not null and p_max_price < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_price');
  end if;

  update public.wishlist
     set max_price = p_max_price
   where user_id = v_uid and card_id = p_card_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_wishlisted');
  end if;

  return jsonb_build_object('ok', true, 'max_price', p_max_price);
end;
$$;

revoke all on function public.set_wishlist_alert(text, integer) from public;
revoke all on function public.set_wishlist_alert(text, integer) from anon;
grant execute on function public.set_wishlist_alert(text, integer) to authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'wishlist' and column_name = 'max_price'
  ) then
    raise exception 'colonne max_price absente';
  end if;

  if not exists (select 1 from pg_proc where proname = 'set_wishlist_alert') then
    raise exception 'fonction set_wishlist_alert absente';
  end if;

  if has_column_privilege('authenticated', 'public.wishlist', 'max_price', 'update') then
    raise exception 'le joueur peut modifier son seuil directement';
  end if;

  raise notice 'Seuils d''envies en place (% envies, % avec seuil).',
    (select count(*) from public.wishlist),
    (select count(*) from public.wishlist where max_price is not null);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop function if exists public.set_wishlist_alert(text, integer);
--  alter table public.wishlist drop constraint if exists wishlist_max_price_check;
--  alter table public.wishlist drop column if exists max_price;
--  -- `notify_wishlist_listing()` retrouve sa version de 027 en la rejouant.
-- ============================================================
