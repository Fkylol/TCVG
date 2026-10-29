import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HALLOWEEN_BOOSTER_EVENT,
  HALLOWEEN_BOOSTER_NAME,
  isHalloweenActive,
} from "../src/lib/halloween/config";
import { createHalloweenBoosterHandler } from "../src/lib/halloween/claim";
import { backOrnamentFor } from "../src/lib/card-back";
import { PACKS, getPack, getPackByGenre, isPackOpenNow, shopPacks } from "../src/lib/packs";

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/048_halloween.sql"),
  "utf8",
);

const SECURITY_MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/058_securite_atelier_halloween.sql"),
  "utf8",
);

const readSource = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const PACKS_SRC = readSource("src/lib/packs.ts");
const ART = readSource("src/components/pack-art.tsx");
const BACK_SRC = readSource("src/lib/card-back.ts");
const BACK = readSource("src/components/card-back.tsx");
const SHELF = readSource("src/app/(game)/boosters/page.tsx");
const API = readSource("src/app/api/packs/route.ts");

test("SQL Halloween : la RPC directe respecte la saison et masque l'ancienne fonction", () => {
  assert.match(SECURITY_MIGRATION, /at time zone 'Europe\/Paris'/);
  assert.match(SECURITY_MIGRATION, /v_day < 1015 or v_day > 1102/);
  assert.match(SECURITY_MIGRATION, /'reason', 'inactive'/);
  assert.match(SECURITY_MIGRATION, /revoke all on function public\._claim_halloween_booster_internal\(text\) from public, anon, authenticated/);
});

function sessionWith(rpc: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>) {
  return {
    supabase: { rpc } as unknown as SupabaseClient,
    user: { id: "11111111-1111-4111-8111-111111111111" },
  };
}

function request(force = false): Request {
  return new Request(
    `https://tcvg.fun/api/halloween/booster${force ? "?force=1" : ""}`,
    {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.7" },
    },
  );
}

test("Halloween : la fenêtre est inclusive du 15 octobre au 2 novembre à Paris", () => {
  assert.equal(isHalloweenActive(new Date("2026-10-14T21:59:00Z")), false);
  assert.equal(isHalloweenActive(new Date("2026-10-14T22:00:00Z")), true);
  assert.equal(isHalloweenActive(new Date("2026-11-02T22:59:00Z")), true);
  assert.equal(isHalloweenActive(new Date("2026-11-02T23:00:00Z")), false);
  assert.equal(isHalloweenActive(new Date("2026-06-15T12:00:00Z")), false);
});

test("route Halloween : premier appel 200, second appel 429 avec Retry-After", async () => {
  let calls = 0;
  const handler = createHalloweenBoosterHandler({
    getSession: async () =>
      sessionWith(async (name) => {
        assert.equal(name, "claim_halloween_booster");
        calls += 1;
        if (calls === 1) {
          return {
            error: null,
            data: {
              ok: true,
              booster: { name: HALLOWEEN_BOOSTER_NAME },
              bonusBoosters: 4,
              retryAfterMs: 3_600_000,
            },
          };
        }
        return {
          error: null,
          data: { ok: false, reason: "cooldown", retryAfterMs: 123_456 },
        };
      }),
    now: () => new Date("2026-10-25T12:00:00Z"),
    forceEnabled: () => false,
  });

  const first = await handler(request());
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as {
    ok: boolean;
    booster: { name: string };
    bonusBoosters: number;
  };
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.booster.name, HALLOWEEN_BOOSTER_NAME);
  assert.equal(firstBody.bonusBoosters, 4);

  const second = await handler(request());
  assert.equal(second.status, 429);
  assert.equal(second.headers.get("Retry-After"), "124");
  const secondBody = (await second.json()) as { ok: boolean; retryAfterMs: number };
  assert.equal(secondBody.ok, false);
  assert.equal(secondBody.retryAfterMs, 123_456);
});

test("route Halloween : session absente, hors fenêtre et force", async () => {
  const unauthenticated = createHalloweenBoosterHandler({
    getSession: async () => null,
    now: () => new Date("2026-10-25T12:00:00Z"),
  });
  assert.equal((await unauthenticated(request())).status, 401);

  const inactive = createHalloweenBoosterHandler({
    getSession: async () => sessionWith(async () => ({ data: { ok: true }, error: null })),
    now: () => new Date("2026-06-15T12:00:00Z"),
    forceEnabled: () => false,
  });
  assert.equal((await inactive(request())).status, 404);
  assert.equal((await inactive(request(true))).status, 404);

  const forced = createHalloweenBoosterHandler({
    getSession: async () =>
      sessionWith(async () => ({
        data: { ok: true, booster: { name: HALLOWEEN_BOOSTER_NAME }, bonusBoosters: 1 },
        error: null,
      })),
    now: () => new Date("2026-06-15T12:00:00Z"),
    forceEnabled: () => true,
  });
  assert.equal((await forced(request(true))).status, 200);
});

test("route Halloween : les erreurs SQL sont traduites sans fuite", async () => {
  const authError = createHalloweenBoosterHandler({
    getSession: async () =>
      sessionWith(async () => ({ data: null, error: { message: "not_authenticated" } })),
    now: () => new Date("2026-10-25T12:00:00Z"),
  });
  assert.equal((await authError(request())).status, 401);

  const limited = createHalloweenBoosterHandler({
    getSession: async () =>
      sessionWith(async () => ({ data: null, error: { message: "rate_limited" } })),
    now: () => new Date("2026-10-25T12:00:00Z"),
  });
  const response = await limited(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
});

test("SQL Halloween : réclamation atomique, stock bonus et débit fermé", () => {
  assert.match(MIGRATION, /create table if not exists public\.halloween_claims/);
  assert.match(MIGRATION, /user_id uuid primary key references public\.profiles\(id\) on delete cascade/);
  assert.match(MIGRATION, /alter table public\.halloween_claims enable row level security/);
  assert.match(MIGRATION, /revoke all on public\.halloween_claims from anon, authenticated/);

  assert.match(MIGRATION, /create table if not exists public\.halloween_rate_limits/);
  assert.match(MIGRATION, /create or replace function public\.claim_halloween_booster/);
  assert.match(MIGRATION, /insert into public\.halloween_claims as h/);
  assert.match(MIGRATION, /on conflict \(user_id\) do update/);
  assert.match(MIGRATION, /where h\.last_claim_at <= v_now - interval '1 hour'/);
  assert.match(MIGRATION, /returning last_claim_at into v_last/);
  assert.match(MIGRATION, /bonus_boosters = bonus_boosters \+ 1/);
  assert.match(MIGRATION, /'halloween:ip:' \|\| v_ip, 30, 60/);
  assert.match(MIGRATION, /'halloween:user:' \|\| v_uid::text, 12, 60/);
  assert.match(MIGRATION, /grant execute on function public\.claim_halloween_booster\(text\) to authenticated/);
  assert.match(MIGRATION, /revoke all on function public\._halloween_rate_hit\(text, integer, integer\) from authenticated/);
});

test("Halloween : un pack saisonnier, hors genre, aux cartes exclusives", () => {
  const pack = getPack("halloween");
  assert.ok(pack, "pack Halloween absent");
  assert.equal(pack.season, "halloween");
  assert.equal(pack.genre, null, "le pool d'Halloween n'est pas un genre");
  assert.equal(pack.emblem, "halloween");
  assert.equal(pack.texture, "halloween");
  assert.ok(pack.pricePixels > 0, "pack sans prix");

  // Son dessin existe : citrouille évidée et toile d'araignée.
  assert.match(ART, /case "halloween":/);
  assert.match(ART, /function batPath\(/);
  assert.match(ART, /HALLOWEEN_WEB/);

  // Il reste en fin de liste : `getPackByGenre(null)` doit continuer de rendre
  // le Mix, qui est le premier pack sans genre.
  assert.equal(PACKS[PACKS.length - 1].id, "halloween");
  assert.equal(getPackByGenre(null)?.id, "mix");
});

test("Halloween : le pack n'entre pas en vitrine, la citrouille seule l'ouvre", () => {
  // La vitrine et l'API publique ne listent que les dix packs de genre : le
  // pack d'Halloween ne s'achète pas et ne se choisit pas.
  const shop = shopPacks();
  assert.equal(shop.length, 10);
  assert.ok(!shop.some((pack) => pack.season), "aucun pack saisonnier en vitrine");
  assert.ok(!shop.some((pack) => pack.id === "halloween"));
  assert.match(SHELF, /shopPacks\(\)\.map/);
  assert.match(API, /shopPacks\(\)\.map/);
  assert.match(PACKS_SRC, /export function shopPacks\(/);

  // Sa fenêtre : la saison d'Halloween, ou l'opt-in de test comme l'overlay.
  const pack = getPack("halloween");
  const mix = getPack("mix");
  assert.ok(pack);
  assert.ok(mix);

  const previous = process.env.NEXT_PUBLIC_HALLOWEEN_FORCE;
  delete process.env.NEXT_PUBLIC_HALLOWEEN_FORCE;

  try {
    assert.equal(isPackOpenNow(pack, new Date("2026-10-25T12:00:00Z")), true);
    assert.equal(isPackOpenNow(pack, new Date("2026-06-15T12:00:00Z")), false);
    // Un pack permanent, lui, ne dépend pas de la date.
    assert.equal(isPackOpenNow(mix, new Date("2026-06-15T12:00:00Z")), true);

    process.env.NEXT_PUBLIC_HALLOWEEN_FORCE = "1";
    assert.equal(isPackOpenNow(pack, new Date("2026-06-15T12:00:00Z")), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_HALLOWEEN_FORCE;
    else process.env.NEXT_PUBLIC_HALLOWEEN_FORCE = previous;
  }
});

test("Halloween : la citrouille ouvre son booster sans quitter la page", () => {
  const OPENING = readSource("src/components/halloween-opening.tsx");
  const HOST = readSource("src/components/reveal-host.tsx");
  const LAYOUT = readSource("src/app/layout.tsx");
  const ACTIONS = readSource("src/app/actions.ts");
  const SCRIPT = readSource("public/events/halloween-overlay.js");

  // L'overlay (script autonome) annonce le booster accordé par un événement ;
  // la constante partagée porte exactement le nom qu'il écrit.
  assert.equal(HALLOWEEN_BOOSTER_EVENT, "halloween:booster");
  assert.match(SCRIPT, new RegExp(`new CustomEvent\\('${HALLOWEEN_BOOSTER_EVENT}'`));
  assert.match(OPENING, /window\.addEventListener\(HALLOWEEN_BOOSTER_EVENT, onBooster\)/);
  assert.match(OPENING, /window\.removeEventListener\(HALLOWEEN_BOOSTER_EVENT, onBooster\)/);

  // Le clic tire le pack saisonnier (jamais le Mix) et confie la révélation à
  // l'hôte unique, monté à la racine du site : l'écran d'ouverture s'affiche
  // donc où que le joueur se trouve.
  assert.match(OPENING, /const result = await openPack\("halloween"\)/);
  assert.match(OPENING, /if \(result\.status !== "ok"\) return;/);
  assert.match(OPENING, /setPendingReveal\(\{ items, packId: "halloween", opened: 1 \}\)/);
  assert.match(OPENING, /busy\.current/, "verrou anti-double-clic manquant");

  // La citrouille est visible pour tout le monde : sans session, la route
  // répond 401 `reason: "auth"` et le message doit dire quoi faire, pas
  // annoncer une panne générique.
  assert.match(SCRIPT, /res\.reason === 'auth'/);
  assert.match(SCRIPT, /Connecte-toi avec Discord/);
  assert.match(HOST, /const pack = getPack\(reveal\.packId\)/);
  assert.match(LAYOUT, /<RevealHost \/>/);
  assert.match(LAYOUT, /<HalloweenOpening \/>/);

  // Hors saison, le refus vient du serveur : l'action reste appelable
  // directement, la vitrine ne suffit pas à garder la porte fermée.
  assert.match(ACTIONS, /if \(!isPackOpenNow\(pack\)\) \{/);
});

test("Halloween : le dos de carte a sa citrouille et sa toile", () => {
  assert.match(BACK_SRC, /export type CardBackOrnament = "standard" \| "halloween"/);
  assert.match(BACK_SRC, /pack\?\.season === "halloween" \? "halloween" : "standard"/);
  assert.equal(backOrnamentFor(getPack("halloween")), "halloween");
  assert.equal(backOrnamentFor(getPack("mix")), "standard");
  assert.equal(backOrnamentFor(null), "standard");

  // Seul l'ornement change : le médaillon de la citrouille et la maille croisée
  // du treillis, sur le même cadre que les autres dos.
  assert.match(BACK, /const LATTICE_CELLS/);
  assert.match(BACK, /d=\{LATTICE_CELLS\[ornament\]\}/);
  assert.match(BACK, /<PackEmblem name="halloween" \/>/);
  assert.match(BACK, /transform="rotate\(45 24 24\)"/);
});
