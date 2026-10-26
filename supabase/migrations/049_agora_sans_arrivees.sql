-- 049 — Agora : plus de messages d'arrivée
--
-- Chaque entrée dans un salon produisait un message système « X entre dans le
-- salon. ». Avec « Tous les salons » (qui agrège les salons) et les allers-
-- retours, cela noyait les vraies annonces. La présence continue d'être mise à
-- jour, mais plus aucun message n'est écrit.

-- Purge de l'existant : messages système d'arrivée uniquement.
delete from public.chat_messages
 where kind = 'system'
   and payload ->> 'event' = 'join';

-- Entrée dans un salon : présence seulement.
create or replace function public.chat_enter_room(p_uid uuid, p_room_id integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_presence (room_id, user_id, seen_at)
  values (p_room_id, p_uid, now())
  on conflict (room_id, user_id)
    do update set seen_at = now();
end;
$$;

revoke all on function public.chat_enter_room(uuid, integer) from public;
revoke all on function public.chat_enter_room(uuid, integer) from anon;
revoke all on function public.chat_enter_room(uuid, integer) from authenticated;

-- Historique : filtre de sécurité pour d'éventuels messages d'arrivée
-- écrits par une version antérieure de la fonction.
create or replace function public.chat_history(
  p_room_id integer default null,
  p_before bigint default null,
  p_after bigint default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
  v_count integer;
  v_has_more boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  with picked as (
    select m.*
      from public.chat_messages m
     where (p_room_id is null or m.room_id = p_room_id)
       and m.deleted_at is null
       and not public.chat_is_blocked(m.user_id)
       and not (m.kind = 'system' and m.payload ->> 'event' = 'join')
       and (
         (p_after is not null and m.id > p_after)
         or (p_after is null and (p_before is null or m.id < p_before))
       )
     order by
       case when p_after is not null then m.id end asc,
       case when p_after is null then m.id end desc
     limit v_limit + 1
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', picked.id,
        'room_id', picked.room_id,
        'kind', picked.kind,
        'body', picked.body,
        'payload', picked.payload,
        'created_at', picked.created_at,
        'user_id', picked.user_id,
        'username', pr.username,
        'avatar_card_id', pr.avatar_card_id,
        'frame', pr.frame,
        'mine', picked.user_id = v_uid,
        'owned', coalesce((
          select c.quantity
            from public.collection c
           where c.user_id = v_uid
             and c.card_id = picked.payload ->> 'card_id'
        ), 0),
        'announcement', (
          select jsonb_build_object(
                   'id', a.id,
                   'kind', a.kind,
                   'status', a.status,
                   'expires_at', a.expires_at
                 )
            from public.chat_announcements a
           where a.message_id = picked.id
        )
      ) order by picked.id
    ), '[]'::jsonb),
    count(*)
    into v_rows, v_count
    from picked
    left join public.profiles pr on pr.id = picked.user_id;

  v_has_more := v_count > v_limit;

  if v_has_more then
    if p_after is not null then
      -- Rattrapage : on garde les plus anciens, la suite viendra au tour suivant.
      v_rows := v_rows - (v_count - 1);
    else
      -- Remontée d'historique : on garde les plus récents.
      v_rows := v_rows - 0;
    end if;
  end if;

  return jsonb_build_object('messages', v_rows, 'has_more', v_has_more);
end;
$$;

revoke all on function public.chat_history(integer, bigint, bigint, integer) from public;
revoke all on function public.chat_history(integer, bigint, bigint, integer) from anon;
grant execute on function public.chat_history(integer, bigint, bigint, integer) to authenticated;
