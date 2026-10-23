-- ============================================================
--  Migration 010 — ÉTAPE 4 : recyclage des doublons
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Règles appliquées :
--    • un joueur garde toujours 1 exemplaire normale de chaque carte ;
--    • seuls les doublons au-delà de cet exemplaire sont recyclables ;
--    • « tout recycler » ne touche jamais aux holos ;
--    • une holo se recycle à la main, pour 3 × la valeur de sa rareté.
-- ============================================================

-- ————— Valeurs par rareté, modifiables en base —————
create table if not exists public.recycle_values (
  rarity text primary key,
  pixels integer not null check (pixels > 0),
  updated_at timestamptz not null default now()
);

insert into public.recycle_values (rarity, pixels) values
  ('C', 1),
  ('R', 3),
  ('SR', 10),
  ('UR', 40),
  ('L', 150)
on conflict (rarity) do nothing;

alter table public.recycle_values enable row level security;

drop policy if exists "recycle_values: lecture publique" on public.recycle_values;
create policy "recycle_values: lecture publique"
  on public.recycle_values for select
  using (true);

revoke all on public.recycle_values from anon, authenticated;
grant select on public.recycle_values to anon, authenticated;

-- ————— Recycler UN doublon (ou UNE holo à la main) —————
-- p_holo = false : retire une copie normale, à condition qu'il en reste une.
-- p_holo = true  : retire une copie brillante, à condition qu'il reste une
--                  autre copie (normale ou holo) de la carte.
create or replace function public.recycle_card(p_card_id text, p_holo boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pixels integer;
  v_rarity text;
  v_value integer;
  v_quantity integer;
  v_holo integer;
  v_recyclable integer;
  v_amount integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select rarity into v_rarity from public.cards where id = p_card_id;
  if not found then
    raise exception 'unknown_card' using errcode = 'P0002';
  end if;

  -- Verrou de ligne : deux clics simultanés ne peuvent pas recycler deux fois
  -- la même copie.
  select pixels into v_pixels from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  select quantity, holo_quantity
    into v_quantity, v_holo
    from public.collection
   where user_id = v_uid and card_id = p_card_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_owned', 'pixels', v_pixels);
  end if;

  select pixels into v_value from public.recycle_values where rarity = v_rarity;
  if not found then
    raise exception 'rarity_not_priced' using errcode = 'P0002';
  end if;

  if p_holo then
    -- La holo ne part que s'il reste une autre copie de la carte.
    if v_holo < 1 or v_quantity <= 1 then
      return jsonb_build_object(
        'ok', false, 'reason', 'keep_one', 'pixels', v_pixels,
        'quantity', v_quantity, 'holo', v_holo
      );
    end if;

    v_amount := v_value * 3;

    update public.collection
       set quantity = quantity - 1,
           holo_quantity = holo_quantity - 1
     where user_id = v_uid and card_id = p_card_id
    returning quantity, holo_quantity into v_quantity, v_holo;
  else
    v_recyclable := greatest(0, v_quantity - v_holo - 1);
    if v_recyclable < 1 then
      return jsonb_build_object(
        'ok', false, 'reason', 'keep_one', 'pixels', v_pixels,
        'quantity', v_quantity, 'holo', v_holo
      );
    end if;

    v_amount := v_value;

    update public.collection
       set quantity = quantity - 1
     where user_id = v_uid and card_id = p_card_id
    returning quantity, holo_quantity into v_quantity, v_holo;
  end if;

  update public.profiles
     set pixels = pixels + v_amount
   where id = v_uid
  returning pixels into v_pixels;

  insert into public.pixel_transactions (user_id, amount, reason)
  values (v_uid, v_amount, 'recyclage');

  return jsonb_build_object(
    'ok', true,
    'amount', v_amount,
    'pixels', v_pixels,
    'quantity', v_quantity,
    'holo', v_holo,
    'rarity', v_rarity
  );
end;
$$;

revoke all on function public.recycle_card(text, boolean) from public;
revoke all on function public.recycle_card(text, boolean) from anon;
grant execute on function public.recycle_card(text, boolean) to authenticated;

-- ————— Recycler tous les doublons normaux —————
-- Les holos sont laissées intactes : la formule ne retire que les copies
-- normales au-delà de la première (`quantity - holo_quantity - 1`).
create or replace function public.recycle_all_duplicates()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pixels integer;
  v_total integer := 0;
  v_cards integer := 0;
  v_lines integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select pixels into v_pixels from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  -- Un seul aller-retour : on calcule, on décrémente et on prix dans la même
  -- instruction, donc aucun doublon ne peut être compté deux fois.
  with extras as (
    select
      c.card_id,
      greatest(0, c.quantity - c.holo_quantity - 1)::int as extra
      from public.collection c
     where c.user_id = v_uid
  ),
  priced as (
    select e.card_id, e.extra, rv.pixels as value
      from extras e
      join public.cards cd on cd.id = e.card_id
      join public.recycle_values rv on rv.rarity = cd.rarity
     where e.extra > 0
  ),
  updated as (
    update public.collection c
       set quantity = c.quantity - p.extra
      from priced p
     where c.user_id = v_uid and c.card_id = p.card_id
    returning p.extra, p.value
  )
  select
    coalesce(sum(extra), 0)::int,
    coalesce(sum(extra * value), 0)::int,
    count(*)::int
    into v_cards, v_total, v_lines
    from updated;

  if v_total = 0 then
    return jsonb_build_object('ok', true, 'amount', 0, 'cards', 0, 'pixels', v_pixels);
  end if;

  update public.profiles
     set pixels = pixels + v_total
   where id = v_uid
  returning pixels into v_pixels;

  insert into public.pixel_transactions (user_id, amount, reason)
  values (v_uid, v_total, 'recyclage');

  return jsonb_build_object(
    'ok', true,
    'amount', v_total,
    'cards', v_cards,
    'lines', v_lines,
    'pixels', v_pixels
  );
end;
$$;

revoke all on function public.recycle_all_duplicates() from public;
revoke all on function public.recycle_all_duplicates() from anon;
grant execute on function public.recycle_all_duplicates() to authenticated;

-- ————— Contrôles finaux —————
do $$
declare
  v_values integer;
begin
  select count(*) into v_values from public.recycle_values;
  if v_values < 5 then
    raise exception 'valeurs de recyclage incomplètes (% lignes)', v_values;
  end if;

  if not exists (select 1 from pg_proc where proname = 'recycle_card')
     or not exists (select 1 from pg_proc where proname = 'recycle_all_duplicates') then
    raise exception 'fonctions de recyclage absentes';
  end if;

  raise notice 'Recyclage en place : % raretés tarifées.', v_values;
end;
$$;
