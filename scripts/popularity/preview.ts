/**
 * Étape 5 + 6 — calcul des raretés à blanc, puis contrôles automatiques.
 *
 * Rien n'est écrit : la base n'est pas touchée. Le script produit
 * `.popularity/preview.md` (rapport lisible) et `.popularity/preview.json`
 * (état complet, repris par `rarity:apply`).
 *
 *   npm run rarity:preview
 */

import fs from "node:fs/promises";
import path from "node:path";

import type { Rarity } from "../../src/lib/cards";
import { adjustTargets, distributeRarities, targetCounts, tierGap } from "../../src/lib/popularity";
import {
  CONTROLS,
  FRANCHISE_CAPS,
  RARITY_ORDER,
  RARITY_SHARES,
} from "../../src/lib/rarity-distribution.config";
import { loadDataset, saveDataset, type Dataset } from "./lib/dataset";
import { computeScores } from "./lib/compute";
import { allBlockingPass, rarityName, runControls, type ControlCard, type GenreCounts } from "./lib/controls";
import { correctAnomalies } from "./lib/corrections";
import { verifyTopCards } from "./lib/verify";
import { openRunner } from "../lib/db-runner";

const OUT_MD = path.join(process.cwd(), ".popularity", "preview.md");
const OUT_JSON = path.join(process.cwd(), ".popularity", "preview.json");

export type PreviewData = {
  generatedAt: string;
  total: number;
  before: Record<Rarity, number>;
  after: Record<Rarity, number>;
  targets: Record<Rarity, number>;
  reduced: Partial<Record<Rarity, number>>;
  controls: { id: string; label: string; ok: boolean; blocking: boolean; detail: string }[];
  cards: {
    id: string;
    name: string;
    franchise: string;
    score: number;
    from: Rarity;
    to: Rarity;
    status: string;
    confidence: number;
    gap: number;
    verified?: boolean;
    fallback?: {
      method: string;
      wikiHost: string | null;
      page: string | null;
      backlinks: number | null;
      pageSize: number | null;
      within: number | null;
      reason: string;
    } | null;
  }[];
};

/** Effectifs par genre, sur les nouvelles raretés. */
async function genreCounts(rarities: Map<string, Rarity>): Promise<GenreCounts[]> {
  const runner = await openRunner();
  try {
    const rows = await runner.query(`
      select g.slug, g.name, cg.card_id
        from public.genres g
        join public.card_genres cg on cg.genre_id = g.id
    `);
    const map = new Map<string, GenreCounts>();
    for (const row of rows) {
      const slug = String(row.slug);
      const entry = map.get(slug) ?? { slug, name: String(row.name), counts: {} };
      const rarity = rarities.get(String(row.card_id));
      if (rarity) entry.counts[rarity] = (entry.counts[rarity] ?? 0) + 1;
      map.set(slug, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  } finally {
    await runner.close();
  }
}

/** Instantané vérifié : un manifeste avec `verifiedAt` suffit. */
async function snapshotVerified(): Promise<boolean> {
  const root = path.join(process.cwd(), ".snapshots");
  try {
    const dirs = (await fs.readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const dir of dirs) {
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(root, dir, "manifest.json"), "utf8")) as {
          verifiedAt?: string;
        };
        if (manifest.verifiedAt) return true;
      } catch {
        continue;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export async function buildPreview(dataset: Dataset, options: { testsPassed: boolean } = { testsPassed: false }) {
  computeScores(dataset);

  const corrections = await correctAnomalies(dataset);
  if (corrections.some((correction) => !correction.kept)) computeScores(dataset);

  const popularityCards = dataset.cards.map((card) => ({
    id: card.id,
    franchiseId: card.franchiseId,
    rarity: card.rarity as Rarity,
    popularityScore: card.popularityScore ?? 0,
    rarityOverride: (card.rarityOverride as Rarity | null) ?? null,
    rarityLocked: card.rarityLocked ?? false,
  }));

  // Première répartition, sans filtre : elle sert seulement à repérer les
  // cartes que le rang placerait dans le haut du classement et qu'il faut donc
  // revérifier avant de savoir combien de places sont réellement disponibles.
  const base = distributeRarities(popularityCards, { shares: RARITY_SHARES, caps: FRANCHISE_CAPS });
  const high: Rarity[] = ["L", "UR", "SR"];
  const toVerify = dataset.cards.filter((card) => {
    const next = base.rarities.get(card.id);
    if (!next || !high.includes(next)) return false;
    const threshold = next === "SR" ? CONTROLS.epicConfidence : CONTROLS.topRarityConfidence;
    return !(card.matchStatus === "auto" && card.matchConfidence >= threshold);
  });
  const verifications = await verifyTopCards(toVerify, dataset.franchises);

  const eligibleFor = (card: (typeof dataset.cards)[number], rarity: Rarity): boolean => {
    if (card.matchStatus !== "auto") return false;
    const threshold = rarity === "SR" ? CONTROLS.epicConfidence : CONTROLS.topRarityConfidence;
    return card.matchConfidence >= threshold || verifications.get(card.id)?.ok === true;
  };

  const available = { L: 0, UR: 0, SR: 0 } as Record<Rarity, number>;
  for (const card of dataset.cards) {
    for (const rarity of high) {
      if (eligibleFor(card, rarity)) available[rarity] += 1;
    }
  }
  const baseTargets = targetCounts(dataset.cards.length, RARITY_SHARES);
  const adjusted = adjustTargets(baseTargets, available);

  const result = distributeRarities(popularityCards, {
    targets: adjusted.targets,
    caps: FRANCHISE_CAPS,
    eligible: {
      L: (card) => {
        const entry = dataset.cards.find((item) => item.id === card.id)!;
        return eligibleFor(entry, "L");
      },
      UR: (card) => {
        const entry = dataset.cards.find((item) => item.id === card.id)!;
        return eligibleFor(entry, "UR");
      },
      SR: (card) => {
        const entry = dataset.cards.find((item) => item.id === card.id)!;
        return eligibleFor(entry, "SR");
      },
    },
  });

  const anomalyIds = corrections.map((correction) => ({ id: correction.id, kept: correction.kept }));

  const controlCards: ControlCard[] = dataset.cards.map((card) => {
    const next = result.rarities.get(card.id) as Rarity;
    return {
      id: card.id,
      name: card.name,
      rarity: card.rarity as Rarity,
      newRarity: next,
      franchiseId: card.franchiseId,
      franchiseName: card.franchiseName,
      confidence: card.matchConfidence,
      status: card.matchStatus,
      verified: verifications.get(card.id)?.ok,
    } as ControlCard;
  });

  const before = {} as Record<Rarity, number>;
  for (const rarity of RARITY_ORDER) before[rarity] = 0;
  for (const card of dataset.cards) {
    const rarity = card.rarity as Rarity;
    if (before[rarity] === undefined) continue;
    before[rarity] += 1;
  }

  const verdicts = runControls({
    cards: controlCards,
    counts: result.counts,
    genres: await genreCounts(result.rarities),
    targets: adjusted.targets,
    snapshotVerified: await snapshotVerified(),
    testsPassed: options.testsPassed,
    anomalies: anomalyIds,
  });

  const byId = new Map(dataset.cards.map((card) => [card.id, card]));
  const preview: PreviewData = {
    generatedAt: new Date().toISOString(),
    total: dataset.cards.length,
    before,
    after: result.counts,
    targets: adjusted.targets,
    reduced: adjusted.reduced,
    controls: verdicts,
    cards: controlCards
      .map((card) => {
        const entry = byId.get(card.id)!;
        const fallback = entry.fallback;
        return {
          id: card.id,
          name: card.name,
          franchise: card.franchiseName,
          score: entry.popularityScore ?? 0,
          from: card.rarity,
          to: card.newRarity,
          status: card.status,
          confidence: card.confidence,
          gap: tierGap(card.rarity, card.newRarity),
          verified: card.verified,
          fallback: fallback
            ? {
                method: fallback.method,
                wikiHost: fallback.wikiHost,
                page: fallback.page,
                backlinks: fallback.backlinks,
                pageSize: fallback.pageSize,
                within: fallback.withinFranchiseScore,
                reason: fallback.reason,
              }
            : null,
        };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, "en", { numeric: true })),
  };

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(
    OUT_JSON,
    `${JSON.stringify({ ...preview, capped: result.capped, corrections, available }, null, 1)}\n`,
    "utf8",
  );
  await fs.writeFile(OUT_MD, markdown(preview, result.capped, corrections, available), "utf8");
  return { preview, result, corrections, verdicts, dataset };
}

function markdown(
  preview: PreviewData,
  capped: { id: string; franchiseId: string; from: Rarity; to: Rarity }[],
  corrections: { id: string; name: string; kept: boolean; evidence: string[] }[],
  available: Record<Rarity, number>,
): string {
  const lines: string[] = [];
  lines.push("# Aperçu des raretés par popularité", "");
  lines.push(`Calculé le ${new Date(preview.generatedAt).toLocaleString("fr-FR")} · ${preview.total} personnages.`, "");

  lines.push("## Effectifs", "", "| Rareté | Avant | Cible | Après | Δ |", "| --- | ---: | ---: | ---: | ---: |");
  for (const rarity of RARITY_ORDER) {
    lines.push(
      `| ${rarityName(rarity)} | ${preview.before[rarity]} | ${preview.targets[rarity]} | ${preview.after[rarity]} | ${
        preview.after[rarity] - preview.before[rarity] >= 0 ? "+" : ""
      }${preview.after[rarity] - preview.before[rarity]} |`,
    );
  }

  const reduced = Object.entries(preview.reduced) as [Rarity, number][];
  if (reduced.length) {
    lines.push("", "Paliers réduits faute de personnages vérifiés :");
    for (const [rarity, missing] of reduced) {
      lines.push(
        `- ${rarityName(rarity)} : ${available[rarity]} disponible(s), ${missing} place(s) reportée(s) vers les paliers plus communs.`,
      );
    }
  }

  lines.push("", "## Contrôles", "");
  for (const verdict of preview.controls) {
    lines.push(
      `- ${verdict.ok ? "✅" : verdict.blocking ? "❌" : "⚠️"} **${verdict.label}** — ${verdict.detail}`,
    );
  }
  lines.push("", `Verdict : ${allBlockingPass(preview.controls) ? "tous les contrôles bloquants passent" : "au moins un contrôle bloquant échoue"}.`);

  lines.push("", "## Top 60", "", "| # | Personnage | Franchise | Score | Avant | Après |", "| ---: | --- | --- | ---: | --- | --- |");
  preview.cards.slice(0, 60).forEach((card, index) => {
    lines.push(
      `| ${index + 1} | ${card.name} | ${card.franchise} | ${card.score} | ${rarityName(card.from)} | ${rarityName(card.to)} |`,
    );
  });

  const jumps = preview.cards.filter((card) => card.gap >= 2);
  lines.push("", `## Changements de deux paliers ou plus (${jumps.length})`, "");
  for (const card of jumps.slice(0, 40)) {
    lines.push(`- ${card.name} — ${rarityName(card.from)} → ${rarityName(card.to)} (score ${card.score})`);
  }
  if (jumps.length > 40) lines.push(`- … et ${jumps.length - 40} autres.`);

  const fallback = preview.cards.filter((card) => card.status !== "auto");
  const measured = fallback.filter((card) => card.fallback?.method === "wiki");
  lines.push("", `## Repli ou sans correspondance (${fallback.length}, dont ${measured.length} classés dans leur franchise)`, "");
  for (const card of fallback.slice(0, 60)) {
    const detail = card.fallback
      ? card.fallback.method === "wiki"
        ? `${card.fallback.wikiHost} · ${card.fallback.backlinks} liens · ${card.fallback.pageSize} octets · rang interne ${card.fallback.within}`
        : card.fallback.reason
      : "aucune mesure de repli";
    lines.push(`- ${card.name} (${card.franchise}) — ${card.status}, score ${card.score} · ${detail}`);
  }
  if (fallback.length > 60) lines.push(`- … et ${fallback.length - 60} autres.`);

  lines.push("", `## Cartes descendues par le plafond de franchise (${capped.length})`, "");
  for (const entry of capped.slice(0, 20)) {
    lines.push(`- ${entry.id} — ${rarityName(entry.from)} → ${rarityName(entry.to)}`);
  }

  if (corrections.length) {
    lines.push("", "## Anomalies revérifiées (contrôle e)", "");
    for (const correction of corrections) {
      lines.push(`- ${correction.name} — ${correction.kept ? "confirmée" : "écartée"} : ${correction.evidence.join(" · ")}`);
    }
  }

  lines.push("", "## Par franchise", "", "| Franchise | Cartes | Mythique | Légendaire | Épique | Rare | Peu commune | Commune |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  const byFranchise = new Map<string, Record<Rarity, number>>();
  for (const card of preview.cards) {
    const slots = byFranchise.get(card.franchise) ?? ({ C: 0, UC: 0, R: 0, SR: 0, UR: 0, L: 0 } as Record<Rarity, number>);
    slots[card.to] += 1;
    byFranchise.set(card.franchise, slots);
  }
  for (const [franchise, slots] of [...byFranchise].sort((a, b) => {
    const totalA = Object.values(a[1]).reduce((sum, value) => sum + value, 0);
    const totalB = Object.values(b[1]).reduce((sum, value) => sum + value, 0);
    return totalB - totalA || a[0].localeCompare(b[0], "fr");
  })) {
    lines.push(
      `| ${franchise} | ${Object.values(slots).reduce((sum, value) => sum + value, 0)} | ${slots.L} | ${slots.UR} | ${slots.SR} | ${slots.R} | ${slots.UC} | ${slots.C} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const dataset = await loadDataset();
  const { preview, corrections, verdicts } = await buildPreview(dataset, { testsPassed: false });
  await saveDataset(dataset);

  console.log(`\n✓ aperçu : ${preview.total} personnages`);
  for (const rarity of RARITY_ORDER) {
    console.log(
      `  ${rarityName(rarity).padEnd(12)} ${String(preview.before[rarity]).padStart(3)} → ${String(preview.after[rarity]).padStart(3)} (cible ${preview.targets[rarity]})`,
    );
  }
  console.log("");
  for (const verdict of verdicts) {
    console.log(`  ${verdict.ok ? "✓" : verdict.blocking ? "✗" : "!"} ${verdict.label} — ${verdict.detail}`);
  }
  console.log(
    `\n${allBlockingPass(verdicts) ? "✓" : "✗"} ${allBlockingPass(verdicts) ? "prêt pour rarity:apply" : "application impossible en l'état"} — anomalie(s) traitée(s) : ${corrections.length}`,
  );
  console.log(`  rapport : ${path.relative(process.cwd(), OUT_MD)}`);
  console.log(`  état    : ${path.relative(process.cwd(), OUT_JSON)}`);
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/popularity/preview.ts");
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  });
}
