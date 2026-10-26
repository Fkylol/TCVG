-- ============================================================
--  ROLLBACK de la migration 046 — PARRAINAGE
--
--  Retire tous les objets ajoutés et remet `open_pack()` d'origine en place.
--  Les bonus et les codes de parrainage disparaissent (colonnes supprimées) :
--  l'opération n'est pas destinée à être rejouée sur une base en production
--  sans sauvegarde.
-- ============================================================

-- ————— 1. Rendre sa fonction d'origine à l'ouverture —————
drop function if exists public.open_pack(text);

do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = '_open_pack_stock'
  ) then
    alter function public._open_pack_stock(text) rename to open_pack;
  end if;
end;
$$;

revoke all on function public.open_pack(text) from public;
revoke all on function public.open_pack(text) from anon;
grant execute on function public.open_pack(text) to authenticated;

-- ————— 2. Notifications : retirer les événements de parrainage —————
delete from public.notifications where kind like 'referral\_%' escape '\';

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing',
    'swap_offer', 'swap_accepted', 'swap_declined', 'swap_expired',
    'listing_cancelled', 'order_cancelled'
  ));

alter table public.notifications
  drop column if exists referral_id,
  drop column if exists message;

-- ————— 3. Fonctions du parrainage —————
drop function if exists public.referral_cron_batch(integer);
drop function if exists public.purge_referral_fingerprints();
drop function if exists public.referral_admin_decide(bigint, boolean, text);
drop function if exists public.referral_admin_report(text);
drop function if exists public.referral_overview();
drop function if exists public.referral_record_mfa(uuid, boolean);
drop function if exists public.referral_reevaluate_self();
drop function if exists public.evaluate_referrals_for_referred(uuid);
drop function if exists public.evaluate_referral(bigint);
drop function if exists public.referral_create(text);
drop function if exists public.referral_rate_hit(text, integer, integer);
drop function if exists public.referral_preview(text);
drop function if exists public.record_activity_day();
drop function if exists public.record_fingerprint(uuid, text, text);
drop function if exists public._pay_referral(bigint);
drop function if exists public._refuse_referral(bigint, text);
drop function if exists public._referral_notify(uuid, text, text, bigint);
drop function if exists public._referral_log(bigint, uuid, text, jsonb);
drop function if exists public.referral_openings(uuid, timestamptz);
drop function if exists public.referral_config();

-- ————— 4. Tables ajoutées —————
drop table if exists public.referral_rate_limits;
drop table if exists public.referral_audit;
drop table if exists public.profile_activity_days;
drop table if exists public.booster_openings;
drop table if exists public.booster_grants;
drop table if exists public.referrals;

-- ————— 5. Profils —————
drop trigger if exists profiles_referral_code on public.profiles;
drop function if exists public.ensure_referral_code();
drop function if exists public.random_referral_code();

drop index if exists public.profiles_referral_code_key;
drop index if exists public.profiles_ip_hash_idx;

alter table public.profiles
  drop constraint if exists profiles_bonus_boosters_check;

alter table public.profiles
  drop column if exists referral_code,
  drop column if exists bonus_boosters,
  drop column if exists discord_mfa_enabled,
  drop column if exists discord_mfa_checked_at,
  drop column if exists ip_hash,
  drop column if exists ip_hash_at,
  drop column if exists ua_hash,
  drop column if exists ua_hash_at,
  drop column if exists suspended_at;
