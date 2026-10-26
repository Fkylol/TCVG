/**
 * Rapport lisible de la recherche stricte : ce qui a été accepté, ce qui reste
 * sans visuel fiable, et pourquoi. Le JSON complet reste dans
 * `.images/strict.json` ; ce fichier est la version qu'on ouvre et qu'on lit.
 */

export type ReportSource = { source: string; reason: string };

export type ReportEntry = {
  id: string;
  name: string;
  franchise: string;
  status: "accepted" | "none";
  accepted?: { sourceName: string; confidence: string; url: string; page: string };
  tried: ReportSource[];
};

export type StrictReport = {
  generatedAt: string;
  total: number;
  accepted: number;
  none: number;
  results: ReportEntry[];
};

/** Sources interrogées, dans l'ordre, sans doublon. */
function sources(entry: ReportEntry): string {
  const list = entry.tried.map((item) => item.source);
  return [...new Set(list)].join(", ") || "aucune";
}

/** Motif du refus : la dernière raison enregistrée pour la carte. */
function reason(entry: ReportEntry): string {
  if (entry.accepted) return `${entry.accepted.confidence} · ${entry.accepted.sourceName}`;
  const last = entry.tried[entry.tried.length - 1];
  if (!last) return "aucune source interrogée";
  return last.reason;
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function reportMarkdown(report: StrictReport): string {
  const none = report.results.filter((entry) => entry.status === "none");
  const share = report.total > 0 ? (report.none / report.total) * 100 : 0;

  const lines: string[] = [
    "# Visuels de carte — recherche stricte",
    "",
    `Généré le ${report.generatedAt.slice(0, 10)} par \`npm run images:strict\`.`,
    "",
    "## Résultat",
    "",
    `- Cartes du catalogue : **${report.total}**`,
    `- Visuels acceptés : **${report.accepted}**`,
    `- Cartes sans visuel fiable : **${report.none}** (${share.toFixed(1)} %)`,
    "",
    "Une image n'est acceptée que si sa source prouve le personnage et la",
    "franchise : page du wiki Fandom portant exactement le nom du personnage",
    "(image principale), ou, à défaut, entité Wikidata « personnage fictif »",
    "rattachée à la franchise. Les photos d'objets ou de lieux (statue, cosplay,",
    "rue) sont écartées.",
    "",
    share > 25
      ? `**Aucune carte supprimée** : la part sans visuel fiable dépasse le seuil de 25 % fixé pour une suppression automatique.`
      : `**Aucune carte supprimée** : cette passe ne supprime jamais de cartes ; le seuil de 25 % est respecté, la décision reste manuelle.`,
    "",
    "## Cartes sans visuel fiable",
    "",
    "| Carte | Franchise | Sources interrogées | Raison |",
    "| --- | --- | --- | --- |",
  ];

  for (const entry of none) {
    lines.push(
      `| ${cell(entry.name)} | ${cell(entry.franchise)} | ${cell(sources(entry))} | ${cell(reason(entry))} |`,
    );
  }

  lines.push(
    "",
    "## Détail",
    "",
    "- Rapport complet : `.images/strict.json`",
    "- Grille de relecture : `/dev/image-audit` (réservée aux administrateurs)",
    "",
  );

  return lines.join("\n");
}
