-- ============================================================
--  Migration 007 — ÉTAPE 2 : Pixels
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Les Pixels ne s'achètent pas : ils se gagnent uniquement en jouant
--  (bonus de connexion quotidien aujourd'hui, recyclage des doublons à
--  l'étape 4). Aucun lien vers un paiement n'existe dans ce schéma.
-- ============================================================

-- ————— Solde —————
alter table public.profiles
  add column if not exists pixels integer not null default 0;

-- Un solde ne peut jamais devenir négatif. La contrainte protège même une
-- écriture faite par erreur depuis le dashboard.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pixels_non_negative'
  ) then
    alter table public.profiles
      add constraint profiles_pixels_non_negative check (pixels >= 0);
  end if;
end;
$$;

-- ————— Registre des mouvements —————
-- Une ligne par gain ou dépense : c'est la seule source de vérité comptable.
create table if not exists public.pixel_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Positif = gain (bonus, recyclage, vente), négatif = dépense (booster, marché).
  amount integer not null,
  -- 'bonus_quotidien' · 'recyclage' · 'achat_booster' · 'vente_marche' · 'achat_marche'
  reason text not null,
  created_at timestamptz not null default now(),
  constraint pixel_transactions_amount_non_zero check (amount <> 0)
);

create index if not exists pixel_transactions_user_idx
  on public.pixel_transactions (user_id, created_at desc);

alter table public.pixel_transactions enable row level security;

-- Le joueur lit son historique, il ne l'écrit jamais : tout passe par les
-- fonctions du serveur.
drop policy if exists "pixel_transactions: lecture de ses mouvements" on public.pixel_transactions;
create policy "pixel_transactions: lecture de ses mouvements"
  on public.pixel_transactions for select
  using (auth.uid() = user_id);

revoke all on public.pixel_transactions from anon, authenticated;
grant select on public.pixel_transactions to authenticated;

-- ————— Configuration du jeu —————
-- Valeurs réglables sans redéployer (montant du bonus, et plus tard les taux
-- de tirage des boosters et la valeur de recyclage).
create table if not exists public.game_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.game_config (key, value) values
  ('daily_bonus_pixels', '10'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table public.game_config enable row level security;

drop policy if exists "game_config: lecture publique" on public.game_config;
create policy "game_config: lecture publique"
  on public.game_config for select
  using (true);

revoke all on public.game_config from anon, authenticated;
grant select on public.game_config to anon, authenticated;

-- ————— Bonus de connexion quotidien —————
-- 10 Pixels par 24 h. L'attente est calculée sur le registre, pas sur une
-- colonne séparée : impossible d'avoir un solde et un historique incohérents.
create or replace function public.claim_daily_bonus()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount integer;
  v_pixels integer;
  v_last timestamptz;
  v_next timestamptz;
  v_cooldown interval := interval '24 hours';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select coalesce((value #>> '{}')::int, 10)
    into v_amount
    from public.game_config
   where key = 'daily_bonus_pixels';

  -- Verrouille le profil : deux clics simultanés ne peuvent pas créditer deux fois.
  select pixels into v_pixels
    from public.profiles
   where id = v_uid
     for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  select max(created_at) into v_last
    from public.pixel_transactions
   where user_id = v_uid
     and reason = 'bonus_quotidien';

  if v_last is not null and v_last + v_cooldown > now() then
    return jsonb_build_object(
      'ok', false,
      'pixels', v_pixels,
      'next_at', v_last + v_cooldown
    );
  end if;

  update public.profiles
     set pixels = pixels + v_amount
   where id = v_uid
  returning pixels into v_pixels;

  insert into public.pixel_transactions (user_id, amount, reason)
  values (v_uid, v_amount, 'bonus_quotidien');

  return jsonb_build_object(
    'ok', true,
    'amount', v_amount,
    'pixels', v_pixels,
    'next_at', now() + v_cooldown
  );
end;
$$;

revoke all on function public.claim_daily_bonus() from public;
revoke all on function public.claim_daily_bonus() from anon;
grant execute on function public.claim_daily_bonus() to authenticated;

-- ————— Contrôles finaux —————
do $$
declare
  v_config integer;
begin
  select count(*) into v_config from public.game_config where key = 'daily_bonus_pixels';
  if v_config = 0 then
    raise exception 'daily_bonus_pixels absent de game_config';
  end if;
  raise notice 'Pixels : colonne, registre et bonus quotidien en place.';
end;
$$;
