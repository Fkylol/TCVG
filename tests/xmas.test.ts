import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { isXmasActive } from "../src/lib/xmas/config";

const AGORA_MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/049_agora_sans_arrivees.sql"),
  "utf8",
);

test("Noël : la fenêtre est inclusive du 1er décembre au 5 janvier à Paris", () => {
  assert.equal(isXmasActive(new Date("2026-11-30T22:59:00Z")), false);
  assert.equal(isXmasActive(new Date("2026-11-30T23:00:00Z")), true);
  assert.equal(isXmasActive(new Date("2027-01-05T22:59:00Z")), true);
  assert.equal(isXmasActive(new Date("2027-01-05T23:00:00Z")), false);
  assert.equal(isXmasActive(new Date("2026-06-15T12:00:00Z")), false);
});

test("SQL Agora : plus aucun message d'arrivée n'est écrit", () => {
  assert.doesNotMatch(AGORA_MIGRATION, /insert into public\.chat_messages/);
  assert.match(AGORA_MIGRATION, /delete from public\.chat_messages/);
  assert.match(AGORA_MIGRATION, /payload ->> 'event' = 'join'/);
  assert.match(AGORA_MIGRATION, /insert into public\.chat_presence/);
});
