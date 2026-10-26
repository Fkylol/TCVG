import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { HALLOWEEN_BOOSTER_NAME, isHalloweenActive } from "../src/lib/halloween/config";
import { createHalloweenBoosterHandler } from "../src/lib/halloween/claim";

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/048_halloween.sql"),
  "utf8",
);

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
