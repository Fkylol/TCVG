-- ============================================================
--  Migration 016 — Taux de drop des raretés
--  À RELIRE AVANT EXÉCUTION. Rejouable sans risque.
--
--  Les chances affichées (« Chance par booster ») sont calculées par
--  `pack_stats()` à partir de ces poids, avec 5 cartes par booster :
--      P(au moins une) = 1 - (1 - p)^5
--
--  Poids retenus (somme = 1000), soit par carte :
--      C 52,52 % · R 43,21 % · Épique 3,80 % · Légendaire 0,404 % · Mythique 0,066 %
--  Chances obtenues par booster, vérifiées en base :
--      Rare       94,1 %
--      Épique     17,6 %
--      Légendaire  2,0 %
--      Mythique    0,33 %
-- ============================================================

update public.game_config
   set value = '{"C":525.2,"R":432.1,"SR":38,"UR":4.04,"L":0.66}'::jsonb
 where key = 'booster_drop_rates';

-- Contrôle : les chances calculées doivent correspondre aux valeurs visées.
do $$
declare
  v_chances jsonb;
  v_r double precision;
  v_sr double precision;
  v_ur double precision;
  v_l double precision;
begin
  select chances into v_chances
    from public.pack_stats()
   where slug = 'mix';

  v_r := (v_chances ->> 'R')::double precision;
  v_sr := (v_chances ->> 'SR')::double precision;
  v_ur := (v_chances ->> 'UR')::double precision;
  v_l := (v_chances ->> 'L')::double precision;

  if abs(v_r - 0.941) > 0.001
     or abs(v_sr - 0.176) > 0.001
     or abs(v_ur - 0.020) > 0.001
     or abs(v_l - 0.0033) > 0.0005 then
    raise exception 'chances inattendues : R=% SR=% UR=% L=%', v_r, v_sr, v_ur, v_l;
  end if;

  raise notice 'chances par booster : R=% SR=% UR=% L=%', v_r, v_sr, v_ur, v_l;
end;
$$;

-- ============================================================
--  ROLLBACK
-- ============================================================
-- update public.game_config
--    set value = '{"C":600,"R":250,"SR":100,"UR":40,"L":10}'::jsonb
--  where key = 'booster_drop_rates';
