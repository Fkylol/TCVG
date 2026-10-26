-- Retour arrière de 043 — supprime les colonnes de provenance des visuels.
-- Les URLs restent dans src/data/portraits.json : le rendu n'est pas affecté.

drop index if exists public.cards_image_status_idx;

alter table public.cards drop constraint if exists cards_image_size_check;
alter table public.cards drop constraint if exists cards_image_url_check;
alter table public.cards drop constraint if exists cards_image_status_check;

alter table public.cards
  drop column if exists image_url,
  drop column if exists image_source_name,
  drop column if exists image_source_page,
  drop column if exists image_license,
  drop column if exists image_width,
  drop column if exists image_height,
  drop column if exists image_checked_at,
  drop column if exists image_status;
