/**
 * Vérification bout en bout — ouverture des packs, stock, collections, RLS.
 *
 * Le projet n'autorise pas la connexion par mot de passe (Discord uniquement),
 * donc ce script n'appelle pas l'API : il crée un compte de test en base, puis
 * exécute les fonctions en tant que rôle `authenticated` avec un JWT simulé
 * (`request.jwt.claims`), exactement comme le fait PostgREST. Il teste aussi la
 * concurrence réelle avec deux connexions distinctes.
 *
 * Usage : npm run db:verify
 */

import { Client } from "pg";

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

function client(): Client {
  const url = new URL(process.env.SUPABASE_DB_URL!.trim());
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

const results: { label: string; ok: boolean }[] = [];
function check(label: string, ok: boolean, detail = "") {
  results.push({ label, ok });
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Simule une requête PostgREST authentifiée. */
async function asUser(db: Client, userId: string) {
  await db.query(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" }),
  ]);
}

/** Repasse en superutilisateur pour inspecter la base. */
async function asAdmin(db: Client) {
  await db.query(`reset role`);
  await db.query(`select set_config('request.jwt.claims', '', false)`);
}

type RpcResult = {
  ok?: boolean;
  reason?: string;
  cards?: { id: string; rarity: string; is_new: boolean; quantity: number }[];
  stock?: number;
};

async function main() {
  const db = client();
  await db.connect();

  const crypto = await db.query(
    `select n.nspname as s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'crypt' and pg_get_function_identity_arguments(p.oid) like 'text, text' limit 1`,
  );
  const schema = crypto.rows[0]?.s ?? "public";
  const email = `verify-${Date.now()}@example.test`;
  const password = "verify-bot-password";

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
    const profile = await db.query(`select booster_stock from public.profiles where id = $1`, [userId]);
    check("profil créé par le trigger", profile.rowCount === 1);
    check("nouveau compte = 1 booster", profile.rows[0]?.booster_stock === 1, `stock=${profile.rows[0]?.booster_stock}`);

    const collectionSum = async () => {
      await asAdmin(db);
      const row = (
        await db.query(
          `select coalesce(sum(quantity),0)::int as q from public.collection where user_id = $1`,
          [userId],
        )
      ).rows[0];
      return row.q as number;
    };

    // ——— Ouverture ———
    await asUser(db, userId);
    let r = (await db.query(`select public.open_pack('mix') as out`)).rows[0].out as RpcResult;
    check("ouverture Mix", r.ok === true);
    check("5 cartes tirées", r.cards?.length === 5, `n=${r.cards?.length}`);
    check("stock consommé", r.stock === 0, `stock=${r.stock}`);
    check("cartes écrites avant le retour", (await collectionSum()) === 5);
    check(
      "chaque carte porte son statut",
      (r.cards ?? []).every((card) => typeof card.is_new === "boolean" && card.quantity >= 1),
    );

    await asUser(db, userId);
    r = (await db.query(`select public.open_pack('mix') as out`)).rows[0].out as RpcResult;
    check("ouverture immédiate refusée", r.ok === false, `stock=${r.stock}`);
    check("aucune carte ajoutée par le refus", (await collectionSum()) === 5);

    // ——— Accumulation ———
    await asAdmin(db);
    await db.query(`update public.profiles set last_booster_at = now() - interval '95 minutes' where id = $1`, [userId]);
    await asUser(db, userId);
    r = (await db.query(`select public.open_pack('mix') as out`)).rows[0].out as RpcResult;
    // 95 min d'absence = 9 boosters accumulés, plafond 10 ; il en reste 8 après ouverture.
    check("stock plafonné à 10", r.ok === true && r.stock === 8, `stock=${r.stock}`);

    // ——— Pack sous le seuil (Stratégie, 9 cartes) : refusé par le serveur ———
    let belowThreshold = false;
    try {
      await db.query(`select public.open_pack('strategie')`);
    } catch (error) {
      belowThreshold = (error as Error).message.includes("pack_unavailable");
    }
    check("pack sous le seuil refusé", belowThreshold);

    // ——— Pack au seuil atteint : 5 cartes, dont les replis de rareté ———
    r = (await db.query(`select public.open_pack('rpg') as out`)).rows[0].out as RpcResult;
    check(
      "pack de genre ouvrable",
      r.ok === true && r.cards?.length === 5 && r.cards.every((card) => card.rarity),
      r.cards?.map((card) => card.rarity).join(","),
    );

    // ——— Chances affichées : issues du tirage réel, pas d'une table statique ———
    const chances = (
      await db.query(`select chances from public.pack_stats() where slug = 'mix'`)
    ).rows[0].chances as Record<string, number>;
    check(
      "chances par booster conformes",
      Math.abs(chances.UC - 0.7627) < 0.002 &&
        Math.abs(chances.R - 0.4546) < 0.002 &&
        Math.abs(chances.SR - 0.068) < 0.002 &&
        Math.abs(chances.UR - 0.0075) < 0.001 &&
        Math.abs(chances.L - 0.00125) < 0.0005,
      JSON.stringify(chances),
    );

    // ——— Pack inconnu ———
    let unknownFailed = false;
    try {
      await db.query(`select public.open_pack('pack-qui-nexiste-pas')`);
    } catch {
      unknownFailed = true;
    }
    check("pack inconnu refusé", unknownFailed);

    // ——— Double-clic : deux connexions simultanées ———
    await asAdmin(db);
    await db.query(
      `update public.profiles set booster_stock = 1, last_booster_at = now() where id = $1`,
      [userId],
    );
    const before = await collectionSum();

    const second = client();
    await second.connect();
    await asUser(db, userId);
    await asUser(second, userId);

    const [a, b] = await Promise.all([
      db.query(`select public.open_pack('mix') as out`).then((x) => x.rows[0].out as RpcResult),
      second.query(`select public.open_pack('mix') as out`).then((x) => x.rows[0].out as RpcResult),
    ]);
    const successes = [a, b].filter((x) => x.ok === true).length;
    check("deux ouvertures simultanées : une seule passe", successes === 1, `succès=${successes}`);
    check("5 cartes exactement ajoutées", (await collectionSum()) === before + 5);

    // ——— L'ancienne route qui acceptait les cartes du client a disparu ———
    await asAdmin(db);
    const legacy = await db.query(
      `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'open_boosters'`,
    );
    check("ancienne ouverture client supprimée", legacy.rows[0].n === 0);

    // ——— Plus aucune boutique ———
    const shop = await db.query(
      `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'buy_booster'`,
    );
    check("achat de booster supprimé", shop.rows[0].n === 0);

    const priced = await db.query(
      `select count(*)::int as n from information_schema.columns
        where table_schema = 'public' and table_name = 'booster_types' and column_name = 'price_pixels'`,
    );
    check("plus de prix sur les packs", priced.rows[0].n === 0);

    // ——— RLS : aucune écriture directe ———
    await asUser(db, userId);
    let insertFailed = false;
    try {
      await db.query(`insert into public.collection (user_id, card_id, quantity) values ($1, 'kratos', 1)`, [userId]);
    } catch {
      insertFailed = true;
    }
    check("écriture directe dans collection refusée", insertFailed);

    let stockLocked = false;
    try {
      const upd = await db.query(
        `update public.profiles set booster_stock = 999 where id = $1 returning booster_stock`,
        [userId],
      );
      stockLocked = upd.rowCount === 0;
    } catch {
      // Refus par privilège (seule la colonne `username` est modifiable).
      stockLocked = true;
    }
    check("stock non modifiable depuis le client", stockLocked);

    // ——— Variante : la contrainte n'accepte que les trois valeurs ———
    await asAdmin(db);
    let variantRejected = false;
    try {
      await db.query(
        `update public.collection set variant = 'n_importe_quoi' where user_id = $1`,
        [userId],
      );
    } catch {
      variantRejected = true;
    }
    check("variante inconnue refusée", variantRejected);

    // ——— Retrait : une carte inactive quitte le pool mais reste possédée ———
    const owned = (
      await db.query(`select card_id from public.collection where user_id = $1 limit 1`, [userId])
    ).rows[0].card_id as string;

    await db.query(`update public.cards set active = false, retired_at = now(), retired_reason = 'test' where id = $1`, [owned]);
    const stillOwned = await db.query(
      `select count(*)::int as n from public.collection where user_id = $1 and card_id = $2`,
      [userId, owned],
    );
    check("carte retirée toujours possédée", stillOwned.rows[0].n === 1);

    await asAdmin(db);
    await db.query(`update public.profiles set last_booster_at = now() - interval '60 minutes', booster_stock = 2 where id = $1`, [userId]);
    await asUser(db, userId);
    const draw = (await db.query(`select public.open_pack('mix') as out`)).rows[0].out as RpcResult;
    check("le tirage ignore les cartes retirées", !(draw.cards ?? []).some((card) => card.id === owned));

    await asAdmin(db);
    await db.query(`update public.cards set active = true, retired_at = null, retired_reason = null where id = $1`, [owned]);
    const restored = await db.query(`select count(*)::int as n from public.collection where user_id = $1`, [userId]);
    check("collections intactes après restauration", restored.rows[0].n > 0);

    await second.end();
  } finally {
    await asAdmin(db);
    await db.query(`delete from auth.users where id = $1`, [userId]);
    await db.end();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error("✗", (error as Error).message);
  process.exit(1);
});
