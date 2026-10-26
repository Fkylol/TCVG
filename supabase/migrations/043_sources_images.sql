-- ============================================================
--  043 — Provenance des visuels de carte
--
--  Les visuels restent hotlinkés : aucune image n'est stockée, seule son URL
--  et sa provenance le sont. Ces colonnes servent à l'audit (`images:check`),
--  au rapport et à l'écran d'administration ; le rendu lit toujours le
--  manifeste statique `src/data/portraits.json` (pas d'écart d'hydratation).
--
--  `image_status` :
--    ok      — image vérifiée (dimensions, format, hotlink)
--    missing — recherche complète sans image valide → carte supprimée
--    retry   — recherche impossible (réseau, 403, 429) → carte conservée
-- ============================================================

alter table public.cards
  add column if not exists image_url text,
  add column if not exists image_source_name text,
  add column if not exists image_source_page text,
  add column if not exists image_license text,
  add column if not exists image_width integer,
  add column if not exists image_height integer,
  add column if not exists image_checked_at timestamptz,
  add column if not exists image_status text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_image_status_check') then
    alter table public.cards
      add constraint cards_image_status_check
      check (image_status is null or image_status in ('ok', 'missing', 'retry'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cards_image_url_check') then
    alter table public.cards
      add constraint cards_image_url_check
      check (image_url is null or image_url like 'http://%' or image_url like 'https://%');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cards_image_size_check') then
    alter table public.cards
      add constraint cards_image_size_check
      check (
        (image_width is null and image_height is null)
        or (image_width > 0 and image_height > 0)
      );
  end if;
end $$;

create index if not exists cards_image_status_idx
  on public.cards (image_status)
  where image_status is not null;

comment on column public.cards.image_url is
  'URL hotlinkée du visuel, vérifiée par npm run images:fix (aucune copie locale).';
comment on column public.cards.image_source_name is
  'Source du visuel : Wikidata (P18), hôte Fandom, ou Wikipédia.';
comment on column public.cards.image_status is
  'ok = vérifiée · missing = aucune image trouvée (carte supprimée) · retry = recherche impossible.';

-- Contrôles finaux
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cards' and column_name = 'image_url'
  ) then
    raise exception 'colonne image_url absente';
  end if;
end $$;
