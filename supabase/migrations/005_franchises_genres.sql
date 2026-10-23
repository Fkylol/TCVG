-- ============================================================
--  Migration 005 — ÉTAPE 1 : franchises et genres
--  À RELIRE AVANT EXÉCUTION.
--  Rejouable sans risque (idempotente).
-- ============================================================

-- ————— Franchises —————
-- Une franchise = un univers du catalogue (God of War, Super Mario…).
-- Elle sert à l'album (progression par franchise), pas au tirage des boosters.

create table if not exists public.franchises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ————— Genres —————
create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.card_genres (
  card_id text not null references public.cards (id) on delete cascade,
  genre_id uuid not null references public.genres (id) on delete cascade,
  primary key (card_id, genre_id)
);

create index if not exists card_genres_genre_idx on public.card_genres (genre_id);

-- ————— RLS : lecture publique, écriture réservée au serveur —————
alter table public.franchises enable row level security;
alter table public.genres enable row level security;
alter table public.card_genres enable row level security;

drop policy if exists "franchises: lecture publique" on public.franchises;
create policy "franchises: lecture publique" on public.franchises for select using (true);

drop policy if exists "genres: lecture publique" on public.genres;
create policy "genres: lecture publique" on public.genres for select using (true);

drop policy if exists "card_genres: lecture publique" on public.card_genres;
create policy "card_genres: lecture publique" on public.card_genres for select using (true);

revoke all on public.franchises from anon, authenticated;
revoke all on public.genres from anon, authenticated;
revoke all on public.card_genres from anon, authenticated;
grant select on public.franchises to anon, authenticated;
grant select on public.genres to anon, authenticated;
grant select on public.card_genres to anon, authenticated;

-- ————— Seed : les 32 franchises du catalogue —————
insert into public.franchises (slug, name) values
  ('godofwar', 'God of War'),
  ('mario', 'Super Mario'),
  ('banjo', 'Banjo-Kazooie'),
  ('spyro', 'Spyro'),
  ('zelda', 'The Legend of Zelda'),
  ('sonic', 'Sonic'),
  ('ff7', 'Final Fantasy VII'),
  ('darksouls', 'Dark Souls'),
  ('hollowknight', 'Hollow Knight'),
  ('portal', 'Portal'),
  ('halo', 'Halo'),
  ('minecraft', 'Minecraft'),
  ('doom', 'DOOM'),
  ('witcher', 'The Witcher'),
  ('crash', 'Crash Bandicoot'),
  ('metroid', 'Metroid'),
  ('castlevania', 'Castlevania'),
  ('undertale', 'Undertale'),
  ('eldenring', 'Elden Ring'),
  ('overwatch', 'Overwatch'),
  ('kingdomhearts', 'Kingdom Hearts'),
  ('dmc', 'Devil May Cry'),
  ('residentevil', 'Resident Evil'),
  ('streetfighter', 'Street Fighter'),
  ('kirby', 'Kirby'),
  ('pokemon', 'Pokémon'),
  ('halflife', 'Half-Life'),
  ('cuphead', 'Cuphead'),
  ('celeste', 'Celeste'),
  ('splatoon', 'Splatoon'),
  ('persona', 'Persona'),
  ('nier', 'NieR')
on conflict (slug) do update set name = excluded.name;

-- ————— Seed : les 10 genres —————
insert into public.genres (slug, name, description) values
  ('rpg', 'RPG', 'Progression par niveaux, statistiques et longue histoire.'),
  ('action-aventure', 'Action-Aventure', 'Exploration, combats et narration au même niveau.'),
  ('plateforme', 'Plateforme', 'Sauts, précision et niveaux construits autour du mouvement.'),
  ('combat', 'Combat', 'Duels rapprochés, coups et enchaînements.'),
  ('fps', 'FPS', 'Tir à la première personne.'),
  ('course', 'Course', 'Vitesse et trajectoires.'),
  ('sport', 'Sport', 'Simulation ou arcade d''une discipline sportive.'),
  ('horreur', 'Horreur', 'Survie, tension et peur.'),
  ('strategie', 'Stratégie', 'Gestion, tactique et décisions à long terme.'),
  ('inde', 'Indé', 'Production indépendante, souvent expérimentale.')
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description;

-- ————— Rattachement des cartes à leur franchise —————
alter table public.cards
  add column if not exists franchise_id uuid;

update public.cards c
   set franchise_id = f.id
  from public.franchises f
 where f.slug = c.universe
   and c.franchise_id is null;

-- Refus explicite plutôt qu'un NOT NULL muet : on veut savoir quelles cartes
-- n'ont pas d'univers connu.
do $$
declare
  v_missing text;
begin
  select string_agg(id, ', ' order by id) into v_missing
    from public.cards
   where franchise_id is null;
  if v_missing is not null then
    raise exception 'Cartes sans franchise : %', v_missing;
  end if;
end;
$$;

alter table public.cards alter column franchise_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cards_franchise_fk'
  ) then
    alter table public.cards
      add constraint cards_franchise_fk
      foreign key (franchise_id) references public.franchises (id) on delete restrict;
  end if;
end;
$$;

create index if not exists cards_franchise_rarity_idx
  on public.cards (franchise_id, rarity);

-- ————— Rattachement des cartes à leurs genres —————
-- Cartes dont le genre est évident. Les 9 cartes ambiguës (Portal ×3,
-- Minecraft ×3, Splatoon ×1, Cuphead ×2) sont volontairement laissées de côté
-- tant que le choix n'est pas validé : aucune n'est devinée ici.
insert into public.card_genres (card_id, genre_id)
select c.id, g.id
  from (values
    -- Action-Aventure
    ('kratos', 'action-aventure'), ('atreus', 'action-aventure'),
    ('baldur', 'action-aventure'), ('freya', 'action-aventure'),
    ('link', 'action-aventure'), ('zelda', 'action-aventure'),
    ('ganondorf', 'action-aventure'), ('majora', 'action-aventure'),
    ('samus', 'action-aventure'), ('ridley', 'action-aventure'),
    ('alucard', 'action-aventure'), ('dracula', 'action-aventure'),
    ('simon', 'action-aventure'), ('dante', 'action-aventure'),
    ('vergil', 'action-aventure'),
    ('le-chevalier', 'action-aventure'), ('hornet', 'action-aventure'),
    ('grimm', 'action-aventure'),
    -- RPG
    ('cloud', 'rpg'), ('sephiroth', 'rpg'), ('aerith', 'rpg'), ('tifa', 'rpg'),
    ('solaire', 'rpg'), ('artorias', 'rpg'), ('gwyn', 'rpg'),
    ('malenia', 'rpg'), ('radahn', 'rpg'),
    ('geralt', 'rpg'), ('ciri', 'rpg'), ('yennefer', 'rpg'),
    ('sora', 'rpg'), ('xehanort', 'rpg'),
    ('joker', 'rpg'), ('2b', 'rpg'),
    ('pikachu', 'rpg'), ('mewtwo', 'rpg'), ('charizard', 'rpg'),
    ('sans', 'rpg'), ('papyrus', 'rpg'), ('flowey', 'rpg'),
    -- RPG + Action-Aventure (souls-like)
    ('solaire', 'action-aventure'), ('artorias', 'action-aventure'),
    ('gwyn', 'action-aventure'), ('malenia', 'action-aventure'),
    ('radahn', 'action-aventure'),
    -- Plateforme
    ('mario', 'plateforme'), ('luigi', 'plateforme'), ('bowser', 'plateforme'),
    ('peach', 'plateforme'), ('yoshi', 'plateforme'),
    ('banjo-kazooie', 'plateforme'), ('gruntilda', 'plateforme'), ('mumbo', 'plateforme'),
    ('spyro', 'plateforme'), ('ripto', 'plateforme'), ('hunter', 'plateforme'),
    ('sonic', 'plateforme'), ('eggman', 'plateforme'), ('shadow', 'plateforme'),
    ('knuckles', 'plateforme'),
    ('crash', 'plateforme'), ('cortex', 'plateforme'),
    ('kirby', 'plateforme'), ('meta-knight', 'plateforme'), ('king-dedede', 'plateforme'),
    ('madeline', 'plateforme'),
    -- Combat
    ('ryu', 'combat'), ('chun-li', 'combat'), ('bison', 'combat'),
    -- FPS
    ('gordon', 'fps'), ('g-man', 'fps'),
    ('master-chief', 'fps'), ('cortana', 'fps'), ('arbiter', 'fps'),
    ('doom-slayer', 'fps'),
    ('tracer', 'fps'), ('reaper', 'fps'), ('mercy', 'fps'),
    -- Horreur
    ('leon', 'horreur'), ('nemesis', 'horreur'),
    -- Indé
    ('le-chevalier', 'inde'), ('hornet', 'inde'), ('grimm', 'inde'),
    ('sans', 'inde'), ('papyrus', 'inde'), ('flowey', 'inde'),
    ('madeline', 'inde')
  ) as m(card_slug, genre_slug)
  join public.cards c on c.id = m.card_slug
  join public.genres g on g.slug = m.genre_slug
on conflict (card_id, genre_id) do nothing;

-- ————— Contrôles finaux —————
do $$
declare
  v_cards integer;
  v_franchises integer;
  v_without_genre integer;
begin
  select count(*) into v_cards from public.cards;
  select count(*) into v_franchises from public.franchises;
  select count(*) into v_without_genre from public.cards c
   where not exists (select 1 from public.card_genres cg where cg.card_id = c.id);

  raise notice 'cartes : %, franchises : %, sans genre : %', v_cards, v_franchises, v_without_genre;
end;
$$;
