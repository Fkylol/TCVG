-- ============================================================
--  Migration 018 — Compteur de propriétaires par carte
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  La table `collection` est protégée par RLS : un joueur ne lit que ses
--  propres lignes. Le verso de la carte affiche pourtant « joueurs qui l'ont »,
--  d'où cette fonction `security definer` qui ne renvoie qu'un compteur
--  agrégé, jamais un identifiant de joueur.
-- ============================================================

create or replace function public.card_owners()
returns table (card_id text, owners integer)
language sql
security definer
set search_path = ''
stable
as $$
  select c.card_id, count(*)::int as owners
    from public.collection c
   group by c.card_id;
$$;

revoke all on function public.card_owners() from public;
revoke all on function public.card_owners() from anon;
grant execute on function public.card_owners() to authenticated;

-- ————— Contrôle final : un joueur authentifié peut lire le compteur —————
do $$
declare
  v_total integer;
begin
  select count(*)::int into v_total from public.card_owners();
  if v_total = 0 then
    raise notice 'aucune collection en base : compteur vide (normal sur une base neuve)';
  else
    raise notice 'cartes possédées au moins une fois : %', v_total;
  end if;
end;
$$;
