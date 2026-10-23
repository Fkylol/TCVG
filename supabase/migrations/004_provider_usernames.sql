-- ============================================================
--  Migration 004 — pseudonyme repris du fournisseur de connexion
--  À coller dans : Dashboard > SQL Editor > New query > Run
--  Rejouable sans risque.
-- ============================================================

-- Avec Discord, Supabase remplit `user_name` / `full_name` et non `username` :
-- sans ceci, tous les comptes Discord s'appellent comme leur préfixe d'email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, last_booster_at, booster_stock)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'collectionneur'), '@', 1)
    ),
    now(),
    1
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Les comptes créés entre-temps avec un pseudo issu de l'email sont laissés tels
-- quels : le joueur peut le modifier depuis son profil.
