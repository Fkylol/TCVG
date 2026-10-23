/**
 * Vérification bout en bout — stock de boosters.
 * Crée un compte de test, l'utilise via l'API (anon key + mot de passe),
 * exerce open_boosters() dans tous ses états, puis supprime le compte.
 */

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { CARDS } from "../src/lib/cards";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function decode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function client() {
  const u = new URL(process.env.SUPABASE_DB_URL!.trim());
  return new Client({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decode(u.username),
    password: decode(u.password).trim(),
    database: u.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
  });
}

const results: { label: string; ok: boolean; detail: string }[] = [];
function check(label: string, ok: boolean, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const email = `verify-${Date.now()}@example.test`;
  const password = "Verify1234";
  const db = client();
  await db.connect();

  const crypto = await db.query(
    `select n.nspname as s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'crypt' and pg_get_function_identity_arguments(p.oid) like 'text, text' limit 1`,
  );
  const schema = crypto.rows[0]?.s ?? "public";
  const { rows: created } = await db.query(
    `insert into auth.users
       (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
             $1, ${schema}.crypt($2, ${schema}.gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}', '{"username":"verify-bot"}',
             now(), now(), '', '', '', '')
     returning id`,
    [email, password],
  );
  const userId = created[0].id as string;

  try {
    // 1. Profil créé par le trigger, avec 1 booster.
    const p = await db.query(`select * from public.profiles where id = $1`, [userId]);
    check("profil créé par le trigger", p.rowCount === 1);
    check("nouveau compte = 1 booster", p.rows[0]?.booster_stock === 1, `stock=${p.rows[0]?.booster_stock}`);

    // 2. Session réelle via l'API (JWT authentifié).
    const sb = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: signIn, error: signInError } = await sb.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) throw new Error(`connexion impossible : ${signInError?.message}`);
    check("connexion mot de passe (JWT)", Boolean(signIn.session.access_token));

    const ids = CARDS.map((c) => c.id);
    const cards = (n: number) => Array.from({ length: n * 3 }, (_, i) => ids[i % ids.length]);

    // 3. Accumulation : 95 min plus tard → 9 boosters de plus, plafond 10.
    await db.query(`update public.profiles set last_booster_at = now() - interval '95 minutes' where id = $1`, [userId]);
    let r = await sb.rpc("open_boosters", { p_cards: cards(10), p_count: 10 });
    check("ouverture de 10 boosters d'un coup", r.error === null && r.data?.ok === true, JSON.stringify(r.error?.message ?? r.data?.stock));
    check("stock vidé après ouverture", r.data?.stock === 0, `stock=${r.data?.stock}`);
    check("10 boosters comptés", r.data?.opened === 10);

    let sum = await db.query(`select coalesce(sum(quantity),0)::int as q, count(*)::int as u from public.collection where user_id = $1`, [userId]);
    check("30 cartes ajoutées", sum.rows[0].q === 30, `quantité=${sum.rows[0].q}, uniques=${sum.rows[0].u}`);

    // 4. Sixième sollicitation immédiate : refusée (cooldown).
    r = await sb.rpc("open_boosters", { p_cards: cards(1), p_count: 1 });
    check("ouverture immédiate refusée", r.error === null && r.data?.ok === false, `stock=${r.data?.stock}`);
    sum = await db.query(`select coalesce(sum(quantity),0)::int as q from public.collection where user_id = $1`, [userId]);
    check("aucune carte ajoutée par le refus", sum.rows[0].q === 30);

    // 5. 25 min plus tard : 2 boosters disponibles, ouverts ensemble.
    await db.query(`update public.profiles set last_booster_at = now() - interval '25 minutes' where id = $1`, [userId]);
    r = await sb.rpc("open_boosters", { p_cards: cards(2), p_count: 2 });
    check("2 boosters accumulés puis ouverts", r.data?.ok === true && r.data?.opened === 2, `stock=${r.data?.stock}`);

    // 6. Plafond : 3 h plus tard, le stock ne dépasse pas 10.
    await db.query(`update public.profiles set last_booster_at = now() - interval '3 hours' where id = $1`, [userId]);
    r = await sb.rpc("open_boosters", { p_cards: cards(1), p_count: 1 });
    check("stock plafonné à 10", r.data?.ok === true && r.data?.stock === 9, `stock=${r.data?.stock}`);

    // 7. Garde-fous d'entrée.
    r = await sb.rpc("open_boosters", { p_cards: cards(11), p_count: 11 });
    check("refus de 11 boosters", r.error !== null, r.error?.message ?? "");
    r = await sb.rpc("open_boosters", { p_cards: cards(1).slice(0, 2), p_count: 1 });
    check("refus d'un lot de cartes incohérent", r.error !== null, r.error?.message ?? "");

    // 8. Écriture directe dans collection → RLS.
    const ins = await sb.from("collection").insert({ user_id: userId, card_id: "fake", quantity: 1 });
    check("écriture directe dans collection refusée", ins.error !== null, ins.error?.message ?? "acceptée !");

    const del = await sb.from("collection").delete().eq("user_id", userId);
    check("suppression directe refusée", del.error !== null || (del.data ?? []).length === 0, del.error?.message ?? "aucune ligne supprimée");

    // 9. Tentative de gonfler le stock depuis le client.
    const upd = await sb.from("profiles").update({ booster_stock: 999 }).eq("id", userId).select();
    const cheated = (upd.data ?? []).length > 0 && upd.data?.[0]?.booster_stock === 999;
    check("stock non modifiable depuis le client", !cheated, cheated ? "FAILLE : stock passé à 999" : "");

    // 10. Catalogue : un personnage ne peut pas exister deux fois en base.
    let duplicateRejected = false;
    try {
      await db.query(
        `insert into public.cards (id, name, universe, rarity, number, franchise_id)
         values ('kratos-copie', 'Kratos', 'godofwar', 'C', 999,
                 (select id from public.franchises where slug = 'godofwar'))`,
      );
    } catch (error) {
      duplicateRejected = (error as { code?: string }).code === "23505";
    }
    check("doublon de personnage refusé par la base", duplicateRejected);

    // 11. Style de profil : carte possédée et cadre débloqué uniquement.
    const owned = (
      await db.query(`select card_id from public.collection where user_id = $1 limit 1`, [userId])
    ).rows[0]?.card_id as string;
    const unownedCard = (
      await db.query(
        `select id from public.cards where id not in (select card_id from public.collection where user_id = $1) limit 1`,
        [userId],
      )
    ).rows[0]?.id as string;

    const style = await sb.rpc("set_profile_style", { p_avatar_card_id: owned, p_frame: "steel" });
    check(
      "avatar et cadre enregistrés",
      style.error === null && (style.data as { frame?: string } | null)?.frame === "steel",
      style.error?.message ?? "",
    );

    const unowned = await sb.rpc("set_profile_style", { p_avatar_card_id: unownedCard, p_frame: "steel" });
    check("avatar non possédé refusé", unowned.error !== null, unowned.error?.message ?? "accepté !");

    // Cadre verrouillé : collection vidée, plus aucun palier n'est atteint.
    await db.query(`delete from public.collection where user_id = $1`, [userId]);
    const locked = await sb.rpc("set_profile_style", { p_avatar_card_id: null, p_frame: "jade" });
    check("cadre verrouillé refusé", locked.error !== null, locked.error?.message ?? "accepté !");
  } finally {
    await db.query(`delete from auth.users where id = $1`, [userId]);
    await db.end();
  }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
