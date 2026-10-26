/**
 * Recalcule les cadres de tous les joueurs avec `src/lib/frames.config.ts`.
 *
 * La migration 047 crée les tables et l'Acier, mais les seuils vivent dans la
 * configuration TypeScript. Ce script lit `frame_stats` en base, évalue la
 * configuration, applique les déblocages avec `frame_apply` (idempotent) puis
 * corrige la sélection si l'ancien cadre n'est plus valide.
 *
 * Il sert aussi de recalcul manuel après un changement de catalogue :
 *
 *   npm run db:frames
 *
 * Le site étant en développement, les anciens déblocages ne sont pas repris.
 * `FRAME_FEATURES.grandfatherLegacyFrames` peut les conserver si on l'active.
 */

import { openRunner } from "./lib/db-runner";
import { MIN_POOL_SIZE } from "../src/lib/packs";
import {
  FRAME_FEATURES,
  LEGACY_FRAME_MAP,
  evaluateFrameSet,
  resolveSelectedFrame,
  type FrameStats,
  type PendingFrame,
  type UnlockedFrame,
} from "../src/lib/frames.config";

type StatsPayload = FrameStats & {
  selectedFrameId: string | null;
  unlocked: UnlockedFrame[];
  pending: PendingFrame[];
  disabled: string[];
};

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlArray(values: string[]): string {
  if (values.length === 0) return "array[]::text[]";
  return `array[${values.map(quote).join(", ")}]::text[]`;
}

async function main() {
  const runner = await openRunner();
  console.log(`→ connecté via ${runner.label}`);

  try {
    const profiles = await runner.query(
      `select id::text as id, username, selected_frame_id
         from public.profiles
        order by created_at`,
    );
    console.log(`→ ${profiles.length} profil(s) à recalculer`);

    let changedSelection = 0;
    let unlockedTotal = 0;
    let appliedTotal = 0;

    for (const row of profiles) {
      const userId = String(row.id);
      const [{ stats }] = await runner.query(
        `select public.frame_stats(${quote(userId)}::uuid) as stats`,
      );
      const payload = stats as StatsPayload;
      if (!payload || typeof payload !== "object") {
        console.warn(`  ⚠ statistiques illisibles pour ${row.username}`);
        continue;
      }

      const evaluation = evaluateFrameSet({
        stats: payload,
        unlocked: payload.unlocked,
        pending: payload.pending,
        disabled: payload.disabled,
      });

      // Reprise facultative des anciens cadres, désactivée par défaut.
      if (FRAME_FEATURES.grandfatherLegacyFrames) {
        const legacy = LEGACY_FRAME_MAP[payload.selectedFrameId ?? ""];
        if (legacy && !payload.unlocked.some((entry) => entry.frameId === legacy)) {
          await runner.query(
            `insert into public.user_frames (user_id, frame_id, reason)
             values (${quote(userId)}::uuid, ${quote(legacy)}, 'grandfathering')
             on conflict (user_id, frame_id) do nothing`,
          );
          payload.unlocked.push({ frameId: legacy, unlockedAt: new Date().toISOString() });
        }
      }

      const applied = await runner.query(
        `select public.frame_apply(
           ${quote(userId)}::uuid,
           ${quote(JSON.stringify(evaluation.unlocks.map((frame) => ({ id: frame.id, name: frame.name }))))}::jsonb,
           ${sqlArray(evaluation.pendingAdd)},
           ${sqlArray(evaluation.pendingRemove)}
         ) as applied`,
      );

      const appliedIds = Array.isArray(applied[0]?.applied)
        ? (applied[0].applied as string[])
        : [];
      appliedTotal += appliedIds.length;
      unlockedTotal += evaluation.unlocks.length;

      const unlocked = [
        ...payload.unlocked,
        ...appliedIds.map((frameId) => ({ frameId, unlockedAt: new Date().toISOString() })),
      ];
      const selected = resolveSelectedFrame(
        payload.selectedFrameId,
        unlocked.map((entry) => entry.frameId),
        payload.disabled,
      );

      if ((payload.selectedFrameId ?? null) !== selected) {
        await runner.query(
          `update public.profiles set selected_frame_id = ${quote(selected)} where id = ${quote(userId)}::uuid`,
        );
        changedSelection += 1;
      }

      if (appliedIds.length > 0) {
        console.log(`  ${row.username} : +${appliedIds.join(", +")}`);
      }
    }

    const counts = await runner.query(
      `select frame_id, count(*)::int as total
         from public.user_frames
        group by frame_id
        order by total desc, frame_id`,
    );
    console.log("\nRépartition après recalcul :");
    for (const line of counts) {
      console.log(`  ${String(line.frame_id).padEnd(24)} ${line.total}`);
    }

    const soon = await runner.query(
      `select g.slug, g.name,
              (select count(*)::int
                 from public.card_genres cg
                 join public.playable_cards pc on pc.id = cg.card_id
                where cg.genre_id = g.id) as active
         from public.genres g
        order by active, g.slug`,
    );
    const soonGenres = soon.filter((line) => Number(line.active) < MIN_POOL_SIZE);
    console.log(`\nGenres sous le seuil de ${MIN_POOL_SIZE} personnages actifs :`);
    for (const line of soonGenres) {
      console.log(`  ${String(line.slug).padEnd(18)} ${line.active} actif(s)`);
    }

    console.log(
      `\n✓ ${unlockedTotal} nouveau(x) cadre(s), ${appliedTotal} appliqué(s), ${changedSelection} sélection(s) corrigée(s)`,
    );
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
