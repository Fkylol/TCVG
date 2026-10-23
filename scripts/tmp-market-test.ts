/** Vérification bout en bout du marché — script temporaire. */

import { openRunner } from "./lib/db-runner";
import { CARDS } from "../src/lib/cards";

const results: { label: string; ok: boolean; detail: string }[] = [];
function check(label: string, ok: boolean, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const cardOf = (rarity: string) => CARDS.find((c) => c.rarity === rarity)!.id;
const UR = cardOf("UR");
const SR = cardOf("SR");
const L = cardOf("L");
const C = cardOf("C");
const R = cardOf("R");

type Runner = Awaited<ReturnType<typeof openRunner>>;
type Json = Record<string, unknown> | null;

function asJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Json;
    } catch {
      return null;
    }
  }
  return value as Json;
}

async function makeUser(db: Runner, label: string): Promise<string> {
  const email = `market-${label}-${Date.now()}@example.test`;
  const rows = await db.query(
    `insert into auth.users
       (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
             '${email}', null, now(),
             '{"provider":"discord","providers":["discord"]}', '{"username":"${label}"}',
             now(), now(), '', '', '', '')
     returning id`,
  );
  return String(rows[0].id);
}

async function main() {
  const db = await openRunner();
  const sellerId = await makeUser(db, "vendeur");
  const buyerId = await makeUser(db, "acheteur");

  // Simule la session PostgREST : auth.uid() lit cette variable.
  const call = async (uid: string, expression: string): Promise<Json> => {
    const rows = await db.query(
      `with s as (select set_config('request.jwt.claim.sub', '${uid}', false))
       select ${expression} as res from s`,
    );
    return asJson(rows[0]?.res);
  };

  try {
    await db.query(
      `insert into public.collection (user_id, card_id, quantity, holo_quantity) values
         ('${sellerId}', '${UR}', 3, 1),
         ('${sellerId}', '${L}', 5, 0),
         ('${sellerId}', '${SR}', 1, 0),
         ('${sellerId}', '${C}', 1, 0),
         ('${sellerId}', '${R}', 2, 0)`,
    );
    await db.query(`update public.profiles set pixels = 0 where id = '${sellerId}'`);
    await db.query(`update public.profiles set pixels = 500 where id = '${buyerId}'`);

    const pixels = async (id: string) =>
      Number((await db.query(`select pixels from public.profiles where id = '${id}'`))[0].pixels);
    const owned = async (id: string, cardId: string) => {
      const rows = await db.query(
        `select quantity, holo_quantity from public.collection where user_id = '${id}' and card_id = '${cardId}'`,
      );
      return rows[0] ? { quantity: Number(rows[0].quantity), holo: Number(rows[0].holo_quantity) } : null;
    };
    const listing = async (id: number) => {
      const rows = await db.query(
        `select status, buyer_id, fee_pixels, seller_payout, sold_at, cancelled_at
           from public.market_listings where id = ${id}`,
      );
      return rows[0];
    };

    // ——— Devis initial : base de la rareté et garde-fous.
    let r = await call(sellerId, `public.market_quote('${UR}', false)`);
    check(
      "devis UR normale : base 300, fourchette 150–600",
      r?.reference === 300 && r?.min === 150 && r?.max === 600,
      JSON.stringify(r),
    );

    r = await call(sellerId, `public.market_quote('${UR}', true)`);
    check(
      "devis UR holo : base 900, fourchette 450–1800",
      r?.reference === 900 && r?.min === 450 && r?.max === 1800,
      JSON.stringify(r),
    );

    // ——— Mise en vente.
    r = await call(sellerId, `public.create_listing('${UR}', false, 400)`);
    check("annonce normale créée à 400", r?.ok === true, JSON.stringify(r));
    const normalId = Number(r?.id);
    check(
      "copie retirée de la collection (2 dont 1 holo)",
      JSON.stringify(await owned(sellerId, UR)) === '{"quantity":2,"holo":1}',
    );

    r = await call(sellerId, `public.create_listing('${UR}', true, 900)`);
    check("annonce holo créée à 900", r?.ok === true, JSON.stringify(r));
    const holoId = Number(r?.id);
    check(
      "holo retirée (1 copie normale restante)",
      JSON.stringify(await owned(sellerId, UR)) === '{"quantity":1,"holo":0}',
    );

    r = await call(sellerId, `public.create_listing('${C}', false, 5)`);
    check("dernière copie non vendable", r?.ok === false && r?.reason === "keep_one");

    r = await call(sellerId, `public.create_listing('${L}', false, 1)`);
    check(
      "prix sous le minimum refusé (500–2000)",
      r?.ok === false && r?.reason === "price_out_of_bounds" && r?.min === 500,
      JSON.stringify(r),
    );

    r = await call(sellerId, `public.create_listing('${L}', false, 1000)`);
    check("annonce L créée à 1000", r?.ok === true, JSON.stringify(r));
    const lId = Number(r?.id);

    // ——— Achat normal.
    r = await call(buyerId, `public.buy_listing(${normalId})`);
    check(
      "achat à 400 : 20 de commission, 380 au vendeur",
      r?.ok === true && r?.fee === 20 && r?.payout === 380,
      JSON.stringify(r),
    );
    check("acheteur débité (100)", (await pixels(buyerId)) === 100);
    check("vendeur crédité (380)", (await pixels(sellerId)) === 380);
    check("carte transférée à l'acheteur", JSON.stringify(await owned(buyerId, UR)) === '{"quantity":1,"holo":0}');
    const sold = await listing(normalId);
    check(
      "annonce marquée vendue avec traces",
      sold?.status === "sold" &&
        sold?.buyer_id === buyerId &&
        Number(sold?.fee_pixels) === 20 &&
        Number(sold?.seller_payout) === 380,
      JSON.stringify(sold),
    );

    r = await call(buyerId, `public.buy_listing(${normalId})`);
    check("annonce déjà vendue refusée", r?.ok === false && r?.reason === "unavailable");

    // ——— Garde-fous d'achat.
    r = await call(buyerId, `public.buy_listing(${holoId})`);
    check(
      "solde insuffisant pour la holo",
      r?.ok === false && r?.reason === "insufficient_pixels",
      JSON.stringify(r),
    );

    r = await call(sellerId, `public.buy_listing(${lId})`);
    check("achat de sa propre annonce refusé", r?.ok === false && r?.reason === "own_listing");

    r = await call(buyerId, `public.cancel_listing(${lId})`);
    check("annulation par un autre joueur refusée", r?.ok === false && r?.reason === "not_owner");

    r = await call(sellerId, `public.cancel_listing(${lId})`);
    check("annulation par le vendeur", r?.ok === true, JSON.stringify(r));
    check("copie rendue à la collection", JSON.stringify(await owned(sellerId, L)) === '{"quantity":5,"holo":0}');
    check("annonce marquée annulée", (await listing(lId))?.status === "cancelled");

    // ——— Achat holo.
    await db.query(`update public.profiles set pixels = 2000 where id = '${buyerId}'`);
    r = await call(buyerId, `public.buy_listing(${holoId})`);
    check(
      "achat holo : 900 payés, 45 de commission, 855 au vendeur",
      r?.ok === true && r?.fee === 45 && r?.payout === 855,
      JSON.stringify(r),
    );
    check("holo transférée à l'acheteur", JSON.stringify(await owned(buyerId, UR)) === '{"quantity":2,"holo":1}');
    check("solde acheteur (1100)", (await pixels(buyerId)) === 1100);
    check("solde vendeur (380 + 855)", (await pixels(sellerId)) === 1235);

    // ——— Double achat simultané de la même annonce.
    r = await call(sellerId, `public.create_listing('${R}', false, 15)`);
    check("annonce R créée à 15", r?.ok === true, JSON.stringify(r));
    const rId = Number(r?.id);

    const [a, b] = await Promise.all([
      call(buyerId, `public.buy_listing(${rId})`),
      call(buyerId, `public.buy_listing(${rId})`),
    ]);
    const won = [a, b].filter((x) => x?.ok === true).length;
    check("double achat : une seule réussite", won === 1, `ok=${won}`);
    check("débit une seule fois (1085)", (await pixels(buyerId)) === 1085);
    check("vendeur crédité une seule fois (1249)", (await pixels(sellerId)) === 1249);
    check("une seule copie transférée", JSON.stringify(await owned(buyerId, R)) === '{"quantity":1,"holo":0}');
    check("commission arrondie au supérieur (1)", Number((await listing(rId))?.fee_pixels) === 1);

    // ——— Devis dynamique après trois ventes.
    await db.query(
      `update public.collection set quantity = 2 where user_id = '${sellerId}' and card_id = '${SR}'`,
    );
    await db.query(
      `insert into public.market_listings
         (seller_id, card_id, holo, price_pixels, status, buyer_id, fee_pixels, seller_payout, sold_at)
       values
         ('${sellerId}', '${SR}', false, 100, 'sold', '${buyerId}', 5, 95, now() - interval '3 days'),
         ('${sellerId}', '${SR}', false, 200, 'sold', '${buyerId}', 10, 190, now() - interval '2 days'),
         ('${sellerId}', '${SR}', false, 300, 'sold', '${buyerId}', 15, 285, now() - interval '1 day')`,
    );

    r = await call(sellerId, `public.market_quote('${SR}', false)`);
    check(
      "devis SR : médiane 200, fourchette 100–250 (plafond de rareté)",
      r?.reference === 200 && r?.min === 100 && r?.max === 250 && r?.sales === 3,
      JSON.stringify(r),
    );

    r = await call(sellerId, `public.create_listing('${SR}', false, 500)`);
    check(
      "nouvelle annonce hors fourchette refusée",
      r?.ok === false && r?.reason === "price_out_of_bounds" && r?.max === 250,
      JSON.stringify(r),
    );

    r = await call(sellerId, `public.create_listing('${SR}', false, 250)`);
    check("annonce SR dans la fourchette acceptée", r?.ok === true, JSON.stringify(r));

    // ——— Annonces lisibles et registre.
    // La variable de session doit être posée avant l'appel : un DO block le
    // garantit (un CTE non référencé n'est pas exécuté par le planificateur).
    const marketView = async (uid: string) => {
      const rows = await db.query(
        `drop table if exists _market_view;
         create temp table _market_view (payload jsonb);
         do $$
         begin
           perform set_config('request.jwt.claim.sub', '${uid}', true);
           insert into _market_view
             select to_jsonb(l) from public.market_listings() l;
         end $$;
         select payload from _market_view;`,
      );
      return rows.map((row) => asJson(row.payload)).filter((row): row is Record<string, unknown> => row !== null);
    };

    const sellerView = await marketView(sellerId);
    const active = sellerView.filter((l) => l.status === "active");
    check("market_listings renvoie les annonces actives", active.length === 1, `actives=${active.length}`);
    check(
      "pseudo, propriété et genres exposés",
      active[0]?.seller_username === "vendeur" &&
        active[0]?.mine === true &&
        Array.isArray(active[0]?.genres) &&
        active[0].genres.length > 0,
      JSON.stringify(active[0]),
    );

    const buyerView = await marketView(buyerId);
    check(
      "les annulées du vendeur ne sont pas visibles à l'acheteur",
      !buyerView.some((l) => l.status === "cancelled"),
    );

    const ledger = await db.query(
      `select reason, count(*)::int as n, coalesce(sum(amount),0)::int as total
         from public.pixel_transactions
        where user_id in ('${sellerId}', '${buyerId}')
        group by reason order by reason`,
    );
    const byReason = new Map(ledger.map((row) => [row.reason, row]));
    check(
      "registre acheteur (3 achats, -1315)",
      Number(byReason.get("achat_marche")?.n) === 3 &&
        Number(byReason.get("achat_marche")?.total) === -1315,
      JSON.stringify(ledger),
    );
    check(
      "registre vendeur (3 ventes, +1249)",
      Number(byReason.get("vente_marche")?.n) === 3 &&
        Number(byReason.get("vente_marche")?.total) === 1249,
      JSON.stringify(ledger),
    );
  } finally {
    await db.query(`delete from auth.users where id in ('${sellerId}', '${buyerId}')`);
    await db.close();
  }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error("✗", error.message);
  process.exit(1);
});
