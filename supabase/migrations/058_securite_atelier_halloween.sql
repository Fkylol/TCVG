-- Sécurité : aucune identité n'est attribuée automatiquement à partir d'un
-- pseudo. Après vérification des comptes dans Supabase Auth, un opérateur
-- doit insérer leurs UUID dans atelier_members avec une connexion privilégiée.
-- Exemple (remplacer par un UUID confirmé dans Supabase Auth) :
-- insert into public.atelier_members(user_id) values ('00000000-0000-0000-0000-000000000000') on conflict do nothing.
-- La table démarre vide : l'atelier reste inaccessible jusqu'à cette étape.
create table if not exists public.atelier_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.atelier_members enable row level security;
revoke all on public.atelier_members from public, anon, authenticated;

create or replace function public.is_atelier()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.atelier_members where user_id = auth.uid());
$$;
revoke all on function public.is_atelier() from public, anon;
grant execute on function public.is_atelier() to authenticated;

-- La RPC était directement accessible et ne vérifiait pas la saison : la
-- restriction de la route HTTP pouvait être contournée via l'API Supabase.
-- Préserver le traitement atomique existant derrière une garde côté base.
do $$
begin
  if to_regprocedure('public._claim_halloween_booster_internal(text)') is null then
    alter function public.claim_halloween_booster(text) rename to _claim_halloween_booster_internal;
  end if;
end
$$;
revoke all on function public._claim_halloween_booster_internal(text) from public, anon, authenticated;

create or replace function public.claim_halloween_booster(p_ip text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_day integer := extract(month from now() at time zone 'Europe/Paris')::integer * 100
                 + extract(day from now() at time zone 'Europe/Paris')::integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_day < 1015 or v_day > 1102 then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;
  return public._claim_halloween_booster_internal(p_ip);
end;
$$;
revoke all on function public.claim_halloween_booster(text) from public, anon;
grant execute on function public.claim_halloween_booster(text) to authenticated;
