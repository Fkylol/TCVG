import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const MIGRATION = read("supabase/migrations/063_vitrine_profils.sql");
const COMPLETION_MIGRATION = read("supabase/migrations/064_completion_profils_publics.sql");
const PROFILE = read("src/app/(wide)/joueur/[username]/page.tsx");
const SHOWCASE = read("src/components/profile-showcase.tsx");
const ACTIONS = read("src/app/actions.ts");
const PERSONAL_PROFILE = read("src/app/(game)/profil/page.tsx");
const RANKING = read("src/components/leaderboard-board.tsx");

test("vitrine : huit emplacements persistants avec RPC de lecture publique et écriture privée", () => {
  assert.match(MIGRATION, /slot between 1 and 8/);
  assert.match(MIGRATION, /unique \(user_id, card_id\)/);
  assert.match(MIGRATION, /revoke all on public\.profile_showcase from anon, authenticated/);
  assert.match(MIGRATION, /public_profile_showcase\(p_username text\)/);
  assert.match(MIGRATION, /save_profile_showcase\(p_card_ids text\[\]\)/);
  assert.match(MIGRATION, /if v_uid is null then/);
  assert.match(MIGRATION, /card_not_owned/);
  assert.match(MIGRATION, /duplicate_showcase_card/);
  assert.match(MIGRATION, /c\.user_id = v_uid/);
  assert.match(MIGRATION, /generate_series\(1, 8\)/);
});

test("profil public : la complétion n'expose que des compteurs agrégés", () => {
  assert.match(COMPLETION_MIGRATION, /public_profile_completion\(p_username text\)/);
  assert.match(COMPLETION_MIGRATION, /count\(distinct c\.card_id\)/);
  assert.match(COMPLETION_MIGRATION, /count\(\*\)::bigint from public\.cards where active = true/);
  assert.match(COMPLETION_MIGRATION, /grant execute on function public\.public_profile_completion\(text\) to anon, authenticated/);
  assert.match(PROFILE, /supabase\.rpc\(\s*"public_profile_completion"/);
  assert.match(PROFILE, /aria-label="Complétion de l’album"/);
  assert.match(PROFILE, /aria-valuenow=\{completion\}/);
});

test("vitrine : l'éditeur propose seulement la collection propre au propriétaire", () => {
  assert.match(PROFILE, /public_profile_showcase/);
  assert.match(PROFILE, /profile\.is_owner && auth\.user \? await getCollection/);
  assert.match(PROFILE, /availableCards=\{ownedCards\}/);
  assert.match(SHOWCASE, /selected\.includes\(card\.id\)/);
  assert.match(ACTIONS, /session\.supabase\.rpc\("save_profile_showcase"/);
  assert.match(ACTIONS, /cardIds\.length !== 8/);
});

test("vitrine : lien du profil privé et accès depuis le classement public", () => {
  assert.match(PERSONAL_PROFILE, /href=\{`\/joueur\/\$\{encodeURIComponent\(profile\.username\)\}`\}/);
  assert.match(RANKING, /href=\{`\/joueur\/\$\{encodeURIComponent\(row\.username\)\}`\}/);
  assert.match(SHOWCASE, /className="glass-shelf"/);
  assert.match(SHOWCASE, /grid-cols-4/);
});
