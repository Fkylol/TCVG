-- ============================================================
--  045 — Messages privés Discord
--
--  Les propositions d'échange ne partent plus par e-mail : le bot du jeu
--  envoie un message privé au destinataire. Il lui faut son identifiant
--  Discord, que la connexion Discord fournit déjà (`auth.identities.provider_id`
--  pour le fournisseur `discord`).
--
--  L'identifiant est stocké à part de `profiles`, dans une table que seuls le
--  serveur et les fonctions `security definer` peuvent lire : RLS activée sans
--  aucune politique, donc invisible depuis le navigateur (même pour le
--  propriétaire du compte).
--
--  Rejouable sans risque.
-- ============================================================

create table if not exists public.discord_links (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  discord_id text not null unique check (discord_id ~ '^[0-9]{15,25}$'),
  linked_at timestamptz not null default now()
);

alter table public.discord_links enable row level security;

revoke all on public.discord_links from anon, authenticated;

comment on table public.discord_links is
  'Identifiant Discord du joueur (message privé du bot). Illisible depuis le client.';

-- Nouveau lien (ou changement de compte Discord) : on enregistre l'identifiant
-- fourni par le fournisseur OAuth.
create or replace function public.handle_new_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'discord' and new.provider_id ~ '^[0-9]{15,25}$' then
    insert into public.discord_links (user_id, discord_id)
    values (new.user_id, new.provider_id)
    on conflict (user_id) do update
      set discord_id = excluded.discord_id,
          linked_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_identity_linked on auth.identities;
create trigger on_auth_identity_linked
  after insert or update of provider_id on auth.identities
  for each row execute function public.handle_new_identity();

-- Comptes déjà inscrits : on reprend l'identifiant Discord existant.
insert into public.discord_links (user_id, discord_id)
select i.user_id, i.provider_id
  from auth.identities i
 where i.provider = 'discord'
   and i.provider_id ~ '^[0-9]{15,25}$'
on conflict (user_id) do update
  set discord_id = excluded.discord_id,
      linked_at = now();

do $$
begin
  if not exists (select 1 from public.discord_links) then
    raise notice 'aucun compte Discord lié : les messages privés resteront muets';
  end if;
end $$;
