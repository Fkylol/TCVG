-- La migration 055 a réintroduit l'ancien ordre à cinq paliers : lorsque la
-- rareté tirée est épuisée dans un paquet, le repli saute les Peu communes.
-- Modifier uniquement l'ordre dans la fonction existante préserve les autres
-- règles, notamment le tirage des variantes et les permissions déjà en place.
do $$
declare
  v_definition text;
  v_old text := 'v_order text[] := array[''L'', ''UR'', ''SR'', ''R'', ''C''];';
  v_new text := 'v_order text[] := array[''L'', ''UR'', ''SR'', ''R'', ''UC'', ''C''];';
begin
  select pg_get_functiondef('public._draw_cards(text[],integer,jsonb)'::regprocedure)
    into v_definition;

  if position(v_new in v_definition) > 0 then
    return;
  end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'Ordre de repli de _draw_cards inconnu : vérifier la fonction avant migration';
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$$;
