-- ============================================================
--  Migration 029 — VISUELS LOCAUX
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  `cards.image_path` pointe un fichier servi par le site (`/cards/<id>.webp`).
--  Tant qu'il est nul, le rendu retombe sur le visuel hotlinké de
--  `src/data/portraits.json`, puis sur le dégradé + emoji : rien ne casse.
--
--  Le manifeste statique `src/data/card-images.json` est écrit par
--  `npm run images:sync`, qui lit `public/cards/` et met cette colonne à jour.
--  La colonne reste la source de vérité côté base (retrait de contenu, admin).
-- ============================================================

alter table public.cards
  add column if not exists image_path text;

-- Un chemin local uniquement : pas d'URL externe, pas de remontée de dossier.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cards_image_path_check'
  ) then
    alter table public.cards
      add constraint cards_image_path_check
      check (
        image_path is null
        or (
          image_path like '/cards/%'
          and image_path not like '%..%'
          and image_path not like '%://%'
        )
      );
  end if;
end;
$$;

create index if not exists cards_image_path_idx
  on public.cards (image_path)
  where image_path is not null;

-- ————— Contrôles finaux —————
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cards' and column_name = 'image_path'
  ) then
    raise exception 'colonne image_path absente';
  end if;

  raise notice 'Visuels locaux prêts : % carte(s) avec un fichier.',
    (select count(*) from public.cards where image_path is not null);
end;
$$;

-- ============================================================
--  ROLLBACK (à exécuter à la main si besoin)
--
--  drop index if exists public.cards_image_path_idx;
--  alter table public.cards drop constraint if exists cards_image_path_check;
--  alter table public.cards drop column if exists image_path;
-- ============================================================
