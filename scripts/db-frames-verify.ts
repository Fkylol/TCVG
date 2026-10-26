/**
 * Vérification en base des cadres.
 *
 * Le script crée un compte de test, remplit sa collection, puis vérifie les
 * agrégats et l'idempotence. Tout est exécuté dans une transaction annulée à la
 * fin : aucune donnée de jeu n'est laissée derrière.
 *
 * Usage : npm run db:frames:verify
 */

import { Client } from "pg";
import {
  evaluateFrameSet,
  frameProgress,
  getFrame,
  resolveSelectedFrame,
  type FrameStats,
} from "../src/lib/frames.config";

const results: { label: string; ok: boolean; detail?: string }[] = [];

function check(label: string, ok: boolean, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function client(): Client {
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) throw new Error("SUPABASE_DB_URL absente");
  const url = new URL(raw.trim());
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  return new Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decode(url.username),
    password: decode(url.password).trim(),
    database: url.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
}

async function asUser(db: Client, userId: string) {
  await db.query("set role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" }),
  ]);
}

async function asAdmin(db: Client) {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
}

async function stats(db: Client, userId: string) {
  const { rows } = await db.query("select public.frame_stats($1) as stats", [userId]);
  return rows[0].stats as Record<string, unknown>;
}

async function main() {
  // Le Management API ne garde pas de transaction entre deux requêtes : la
  // vérification a besoin d'une vraie session Postgres.
  const db = client();
  await db.connect();

  const email = `frames-${Date.now()}@example.test`;
  const { rows: created } = await db.query(
    `insert into auth.users
       (instance_id, id, aud, role, email, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
             'authenticated', 'authenticated', $1, now(),
             '{"provider":"email","providers":["email"]}', '{"username":"frames-check"}',
             now(), now(), '', '', '', '')
     returning id`,
    [email],
  );
  const userId = created[0].id as string;

  // Second compte pour la vraie concurrence : deux sessions distinctes.
  const { rows: createdSecond } = await db.query(
    `insert into auth.users
       (instance_id, id, aud, role, email, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
             'authenticated', 'authenticated', $1, now(),
             '{"provider":"email","providers":["email"]}', '{"username":"frames-concurrent"}',
             now(), now(), '', '', '', '')
     returning id`,
    [`frames-concurrent-${Date.now()}@example.test`],
  );
  const concurrentUserId = createdSecond[0].id as string;

  const first = client();
  const second = client();
  await first.connect();
  await second.connect();

  try {
    const invoke = async (connection: Client) => {
      await connection.query("begin");
      const { rows } = await connection.query(
        "select public.frame_apply($1, $2::jsonb) as applied",
        [concurrentUserId, JSON.stringify([{ id: "jade", name: "Jade" }])],
      );
      await connection.query("commit");
      return (rows[0].applied as string[]).length;
    };

    const [firstCount, secondCount] = await Promise.all([invoke(first), invoke(second)]);
    check(
      "deux évaluations simultanées : un seul déblocage",
      firstCount + secondCount === 1,
      `${firstCount} + ${secondCount}`,
    );
  } finally {
    await first.end();
    await second.end();
    await db.query("delete from auth.users where id = $1", [concurrentUserId]);
  }

  try {
    await db.query("begin");

    const initial = await stats(db, userId);
    check("Acier attribué à la création", Array.isArray(initial.unlocked) && initial.unlocked.length === 1);
    check("total actif lu", Number(initial.totalActive) > 0, `${initial.totalActive}`);

    // Une visite compte une fois par jour et ne remplit la file qu'une fois.
    await db.query("delete from public.frame_eval_queue where user_id = $1", [userId]);
    await db.query("delete from public.profile_activity_days where user_id = $1", [userId]);
    await asUser(db, userId);
    await db.query("select public.record_activity_day()");
    await asAdmin(db);
    const firstVisit = await db.query(
      `select
         (select count(*)::int from public.profile_activity_days where user_id = $1) as days,
         (select count(*)::int from public.frame_eval_queue where user_id = $1) as queued`,
      [userId],
    );
    check(
      "visite du jour : une activité et une mise en file",
      firstVisit.rows[0].days === 1 && firstVisit.rows[0].queued === 1,
      `${firstVisit.rows[0].days} jour / ${firstVisit.rows[0].queued} file`,
    );

    await db.query("delete from public.frame_eval_queue where user_id = $1", [userId]);
    await asUser(db, userId);
    await db.query("select public.record_activity_day()");
    await asAdmin(db);
    const secondVisit = await db.query(
      `select
         (select count(*)::int from public.profile_activity_days where user_id = $1) as days,
         (select count(*)::int from public.frame_eval_queue where user_id = $1) as queued`,
      [userId],
    );
    check(
      "seconde visite du jour : pas de doublon ni de file",
      secondVisit.rows[0].days === 1 && secondVisit.rows[0].queued === 0,
      `${secondVisit.rows[0].days} jour / ${secondVisit.rows[0].queued} file`,
    );

    // Toute la collection active.
    await db.query(
      `insert into public.collection (user_id, card_id, quantity)
       select $1, pc.id, 1 from public.playable_cards pc
       on conflict (user_id, card_id) do update set quantity = public.collection.quantity + 1`,
      [userId],
    );
    let current = await stats(db, userId);
    check(
      "collection complète : distinct = actifs",
      Number(current.ownedDistinct) === Number(current.totalActive),
      `${current.ownedDistinct}/${current.totalActive}`,
    );

    await asUser(db, userId);
    const asAuthenticated = await stats(db, userId);
    check("frame_stats lisible par son propriétaire", Number(asAuthenticated.ownedDistinct) === Number(current.totalActive));
    await asAdmin(db);

    // Le rapport d'administration et le basculement d'un cadre.
    await db.query("update public.profiles set is_admin = true where id = $1", [userId]);
    await asUser(db, userId);
    const { rows: adminReport } = await db.query("select public.frame_admin_report() as report");
    check("rapport admin lisible", Number(adminReport[0].report.totalPlayers) >= 1);
    const { rows: toggled } = await db.query(
      "select public.frame_admin_set_active('season-example', true, 'test') as out",
    );
    check("activation admin d'un cadre", toggled[0].out.ok === true);
    await db.query("select public.frame_admin_set_active('season-example', false, 'test')");
    await asAdmin(db);

    let forbidden = false;
    await asUser(db, userId);
    await db.query("savepoint before_forbidden");
    try {
      await db.query("select * from public.user_frames");
    } catch {
      forbidden = true;
      await db.query("rollback to savepoint before_forbidden");
    }
    check("user_frames inaccessible en direct", forbidden);
    await asAdmin(db);

    const evaluation = evaluateFrameSet({
      stats: current as unknown as FrameStats,
      unlocked: (current.unlocked as { frameId: string; unlockedAt: string }[]) ?? [],
      pending: (current.pending as { frameId: string; firstMetAt: string }[]) ?? [],
    });
    check(
      "évaluation complète : Complétiste éligible",
      evaluation.newUnlockedIds.includes("completionist"),
    );

    const apply = async (ids: { id: string; name: string }[]) => {
      const { rows } = await db.query("select public.frame_apply($1, $2::jsonb) as applied", [
        userId,
        JSON.stringify(ids),
      ]);
      return (rows[0].applied as string[]) ?? [];
    };

    const applied = await apply(evaluation.unlocks.map((frame) => ({ id: frame.id, name: frame.name })));
    check("déblocages appliqués", applied.includes("completionist"), `${applied.length} cadres`);
    check("Pionnier attribué", applied.includes("pioneer"));

    const replay = await apply([{ id: "completionist", name: "Complétiste" }]);
    check("second apply du même cadre : aucun doublon", replay.length === 0);

    const { rows: notifications } = await db.query(
      `select count(*)::int as n from public.notifications
        where user_id = $1 and kind = 'frame_unlocked' and frame_id = 'completionist'`,
      [userId],
    );
    check("une seule notification de déblocage", notifications[0].n === 1);

    // Un doublon (quantité) ne change pas les personnages distincts.
    await db.query(
      `update public.collection set quantity = quantity + 4
        where user_id = $1 and card_id = (select card_id from public.collection where user_id = $1 limit 1)`,
      [userId],
    );
    const afterDuplicates = await stats(db, userId);
    check(
      "les doublons ne comptent pas",
      Number(afterDuplicates.ownedDistinct) === Number(afterDuplicates.totalActive),
      `${afterDuplicates.ownedDistinct}`,
    );

    // Une carte retirée quitte les compteurs d'actifs.
    const { rows: oneCard } = await db.query(
      `select card_id from public.collection where user_id = $1 and card_id in (select id from public.playable_cards) limit 1`,
      [userId],
    );
    await db.query("update public.cards set active = false, retired_reason = 'frames-check' where id = $1", [
      oneCard[0].card_id,
    ]);
    const afterRetire = await stats(db, userId);
    check(
      "les cartes inactives sont exclues",
      Number(afterRetire.ownedDistinct) === Number(afterRetire.totalActive) &&
        Number(afterRetire.totalActive) === Number(afterDuplicates.totalActive) - 1,
      `${afterRetire.ownedDistinct}/${afterRetire.totalActive}`,
    );
    await db.query("update public.cards set active = true, retired_reason = null where id = $1", [
      oneCard[0].card_id,
    ]);

    // Permanence : on retire presque tout, le cadre reste.
    await db.query(
      `delete from public.collection
        where user_id = $1
          and card_id not in (select card_id from public.collection where user_id = $1 limit 1)`,
      [userId],
    );
    current = await stats(db, userId);
    const afterSale = evaluateFrameSet({
      stats: current as unknown as FrameStats,
      unlocked: (current.unlocked as { frameId: string; unlockedAt: string }[]) ?? [],
      pending: (current.pending as { frameId: string; firstMetAt: string }[]) ?? [],
    });
    check("aucun déblocage parasite après la vente", afterSale.newUnlockedIds.length === 0);
    const unlockedIds = ((current.unlocked as { frameId: string }[]) ?? []).map((entry) => entry.frameId);
    check(
      "Complétiste reste sélectionnable après la vente",
      resolveSelectedFrame("completionist", unlockedIds) === "completionist",
    );

    // Un genre sous le seuil reste « bientôt » avec les vrais compteurs.
    const genres = current.genres as Record<string, { total: number; owned: number }>;
    const smallGenre = Object.entries(genres).find(([, value]) => value.total > 0 && value.total < 15);
    if (smallGenre) {
      const frame = getFrame(`genre-${smallGenre[0]}`);
      if (frame) {
        const state = frameProgress(frame, current as unknown as FrameStats);
        check(
          `genre ${smallGenre[0]} sous 15 : bientôt`,
          state.soon && !state.reached,
          `${smallGenre[1].total} actifs`,
        );
      }
    }

    await asUser(db, userId);
    const { rows: style } = await db.query("select public.set_profile_style(null, 'season-example') as out");
    const returned = style[0].out.frame as string;
    check(
      "sélection d'un cadre verrouillé : repli sans erreur",
      typeof returned === "string" && returned !== "season-example",
      returned,
    );
    await asAdmin(db);

    const { rows: selected } = await db.query("select selected_frame_id from public.profiles where id = $1", [
      userId,
    ]);
    check("sélection valide enregistrée", selected[0].selected_frame_id === returned);

    // Deux insertions du même cadre ne créent qu'une ligne (contrainte).
    const { rows: dup1 } = await db.query(
      `insert into public.user_frames (user_id, frame_id) values ($1, 'season-example')
       on conflict do nothing returning frame_id`,
      [userId],
    );
    const { rows: dup2 } = await db.query(
      `insert into public.user_frames (user_id, frame_id) values ($1, 'season-example')
       on conflict do nothing returning frame_id`,
      [userId],
    );
    check(
      "insertion répétée : une seule ligne",
      dup1.length === 1 && dup2.length === 0,
    );

    await db.query("rollback");
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    await db.query("delete from auth.users where id = $1", [userId]).catch(() => {});
    await db.end();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
