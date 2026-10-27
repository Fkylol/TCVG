-- ============================================================
--  Migration 050 — SIGNALEMENTS DE CARTE
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Depuis sa collection, un joueur signale une carte qui cloche (visuel cassé,
--  fiche fausse, rareté étrange…) avec un message. Le signalement est en
--  écriture seule côté joueur : il est relu dans l'atelier local
--  (`/atelier/signalements`), qui ouvre la carte à corriger.
--
--  La lecture et le traitement sont réservés aux administrateurs, par la clé
--  de service (tâches de fond) ou par une session dont `is_admin()` est vrai.
-- ============================================================

create table if not exists public.card_reports (
  id bigint generated always as identity primary key,
  -- Une carte retirée du catalogue emporte ses signalements : ils n'ont plus
  -- d'objet.
  card_id text not null references public.cards (id) on delete cascade,
  -- Nul si le compte a été supprimé : le message reste, l'auteur non.
  user_id uuid references auth.users (id) on delete set null,
  topic text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint card_reports_topic_valid check (topic in ('visuel', 'fiche', 'rarete', 'autre')),
  constraint card_reports_message_length check (char_length(message) between 5 and 1000),
  constraint card_reports_status_valid check (status in ('open', 'done'))
);

-- File d'attente de l'atelier : seuls les signalements ouverts sont lus.
create index if not exists card_reports_open_idx
  on public.card_reports (created_at desc)
  where status = 'open';

-- Historique d'une carte, pour savoir si elle a déjà été signalée.
create index if not exists card_reports_card_idx
  on public.card_reports (card_id, created_at desc);

alter table public.card_reports enable row level security;

-- Insertion seule, et seulement pour soi-même : personne ne signale au nom
-- d'un autre joueur.
drop policy if exists "card_reports: envoi d'un signalement" on public.card_reports;
create policy "card_reports: envoi d'un signalement"
  on public.card_reports for insert
  to authenticated
  with check (user_id = auth.uid());

-- Lecture et traitement par l'administration seulement (atelier local).
drop policy if exists "card_reports: lecture admin" on public.card_reports;
create policy "card_reports: lecture admin"
  on public.card_reports for select
  to authenticated
  using (public.is_admin());

drop policy if exists "card_reports: traitement admin" on public.card_reports;
create policy "card_reports: traitement admin"
  on public.card_reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.card_reports from anon, authenticated;
grant insert, select, update on public.card_reports to authenticated;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'card_reports') then
    raise exception 'policies de signalement absentes';
  end if;

  raise notice 'Signalements en place (% ouverts).',
    (select count(*) from public.card_reports where status = 'open');
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop table if exists public.card_reports;
-- ============================================================
