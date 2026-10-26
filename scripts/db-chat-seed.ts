/**
 * Données de test de L'Agora.
 *
 * Crée quatre faux joueurs, remplit les salons de messages, publie des
 * annonces actives et un signalement, pour vérifier tous les états de
 * l'interface (fil vide, cartes embarquées, file de modération).
 *
 * Usage : npm run db:chat:seed
 *
 * Idempotent : les messages de test portent `{"seed": …}` dans leur payload
 * et sont supprimés avant chaque exécution. Les comptes de test ont des
 * identifiants fixes ; leurs profils ne sont jamais promus administrateurs.
 */

import { openRunner } from "./lib/db-runner";

const USERS = [
  { id: "a9f0b4c2-1111-4a1a-9a01-000000000001", name: "Nova", email: "seed.nova@agora.test" },
  { id: "a9f0b4c2-2222-4a1a-9a02-000000000002", name: "Kaito", email: "seed.kaito@agora.test" },
  { id: "a9f0b4c2-3333-4a1a-9a03-000000000003", name: "Mira", email: "seed.mira@agora.test" },
  { id: "a9f0b4c2-4444-4a1a-9a04-000000000004", name: "Sacha", email: "seed.sacha@agora.test" },
];

function values(rows: string[]): string {
  return rows.join(",\n  ");
}

async function main() {
  const runner = await openRunner();
  console.log(`→ connecté via ${runner.label}`);

  try {
    const tables = await runner.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name = 'chat_messages'`,
    );

    if (tables.length === 0) {
      throw new Error(
        "La migration 031_agora.sql n'est pas appliquée : le chat n'existe pas encore en base.",
      );
    }

    const [catalogue] = await runner.query(
      `select count(*)::int as total from public.cards where active`,
    );
    if (!catalogue || Number(catalogue.total) === 0) {
      throw new Error(
        "Le catalogue `cards` est vide : lance d'abord `npm run db:cards` (les annonces ont besoin de cartes).",
      );
    }

    // ————— Nettoyage des données de test précédentes —————
    await runner.query(`delete from public.chat_messages where payload ? 'seed';`);

    // ————— Joueurs —————
    // `auth.users` déclenche `handle_new_user`, qui crée le profil. Le compte
    // a trois jours pour passer le seuil d'ancienneté du chat.
    await runner.query(`
      insert into auth.users (id, email, email_confirmed_at, created_at, raw_user_meta_data)
      values
        ${values(
          USERS.map(
            (user) =>
              `('${user.id}', '${user.email}', now(), now() - interval '3 days', '{"username": "${user.name}"}'::jsonb)`,
          ),
        )}
      on conflict (id) do nothing;

      insert into public.profiles (id, username, boosters_opened)
      values
        ${values(USERS.map((user) => `('${user.id}', '${user.name}', 40)`))}
      on conflict (id) do update
        set boosters_opened = greatest(public.profiles.boosters_opened, excluded.boosters_opened),
            username = excluded.username;
    `);

    // ————— Doublons pour les annonces —————
    // Chaque joueur reçoit deux exemplaires de la même carte : condition
    // requise pour « J'échange ». Une deuxième carte reste à un exemplaire.
    await runner.query(`
      insert into public.collection (user_id, card_id, quantity)
      select u.id, c.id, 2
        from (values ${values(USERS.map((user) => `('${user.id}'::uuid)`))}) as u(id)
        cross join (
          select id from public.cards where active order by id limit 1
        ) as c
      on conflict (user_id, card_id)
        do update set quantity = greatest(public.collection.quantity, 2);

      insert into public.collection (user_id, card_id, quantity)
      select u.id, c.id, 1
        from (values ${values(USERS.map((user) => `('${user.id}'::uuid)`))}) as u(id)
        cross join (
          select id from public.cards where active order by id offset 1 limit 1
        ) as c
      on conflict (user_id, card_id) do nothing;
    `);

    // ————— Messages de discussion —————
    // Trois lignes par salon, réparties entre les faux joueurs, horodatées
    // pour que le fil ait un historique crédible.
    await runner.query(`
      with lines(body, minutes) as (
        values
          ('Salut ! Quelqu''un échange des cartes de cette franchise ?', 48),
          ('Je cherche un doublon précis, j''ai pas mal de choses à proposer.', 31),
          ('Bonne chance dans vos boosters, le chat est ouvert toute la journée.', 9)
      )
      insert into public.chat_messages (room_id, user_id, kind, body, payload, created_at)
      select r.id,
             (array[${values(USERS.map((user) => `'${user.id}'::uuid`))}])[
               1 + (row_number() over (order by r.id, lines.minutes)) % 4
             ],
             'text',
             lines.body,
             '{"seed": "text"}'::jsonb,
             now() - make_interval(mins => lines.minutes)
        from public.chat_rooms r
        cross join lines;
    `);

    // ————— Annonces actives —————
    // Une carte en doublon par joueur, annoncée « J'échange » dans le salon
    // français n°1, puis une recherche sur la deuxième carte.
    await runner.query(`
      with duo as (
        select id from public.cards where active order by id limit 1
      ), searched as (
        select id from public.cards where active order by id offset 1 limit 1
      ), inserted as (
        insert into public.chat_messages (room_id, user_id, kind, body, payload, created_at)
        select (select id from public.chat_rooms where language = 'fr' and number = 1),
               u.id,
               'have',
               'J''échange ce doublon contre une carte de mes envies.',
               jsonb_build_object('seed', 'announce', 'card_id', duo.id),
               now() - make_interval(mins => 6)
          from (values ${values(USERS.map((user) => `('${user.id}'::uuid)`))}) as u(id)
          cross join duo
        returning id, user_id, payload, room_id, created_at
      )
      insert into public.chat_announcements (message_id, user_id, card_id, kind, expires_at)
      select id, user_id, payload ->> 'card_id', 'have', created_at + interval '30 minutes'
        from inserted;

      with wanted as (
        select id from public.cards where active order by id offset 1 limit 1
      ), inserted as (
        insert into public.chat_messages (room_id, user_id, kind, body, payload, created_at)
        select (select id from public.chat_rooms where language = 'fr' and number = 1),
               u.id,
               'want',
               'Je cherche cette carte : dis-moi ce que tu veux en échange.',
               jsonb_build_object('seed', 'announce', 'card_id', wanted.id),
               now() - make_interval(mins => 4)
          from (values ${values(USERS.map((user) => `('${user.id}'::uuid)`))}) as u(id)
          cross join wanted
        returning id, user_id, payload, room_id, created_at
      )
      insert into public.chat_announcements (message_id, user_id, card_id, kind, expires_at)
      select id, user_id, payload ->> 'card_id', 'want', created_at + interval '30 minutes'
        from inserted;
    `);

    // ————— Signalement d'exemple —————
    await runner.query(`
      insert into public.chat_reports (message_id, reporter_id, reason, note)
      select m.id, '${USERS[1].id}', 'spam', 'Exemple de données de test.'
        from public.chat_messages m
       where m.payload ->> 'seed' = 'text'
         and m.user_id = '${USERS[0].id}'
       order by m.id
       limit 1
      on conflict (message_id, reporter_id) do nothing;
    `);

    const [summary] = await runner.query(`
      select
        (select count(*) from public.chat_messages where deleted_at is null)::int as messages,
        (select count(*) from public.chat_announcements where status = 'active')::int as annonces,
        (select count(*) from public.chat_reports where status = 'open')::int as signalements,
        (select count(*) from public.chat_rooms)::int as salons
    `);

    console.log(
      `✓ données de test : ${summary?.messages ?? 0} messages, ${summary?.annonces ?? 0} annonces, ` +
        `${summary?.signalements ?? 0} signalement(s), ${summary?.salons ?? 0} salons.`,
    );
    console.log(
      "  Les comptes de test sont Nova, Kaito, Mira et Sacha (mot de passe : aucun — " +
        "ils ne servent qu'à peupler le fil).",
    );
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
