import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import audit from "@/data/image-audit.json";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Audit des visuels — TCVG",
  robots: { index: false, follow: false },
};

// Page de travail : elle ne doit jamais être servie en cache ni indexée.
export const dynamic = "force-dynamic";

type Entry = {
  id: string;
  name: string;
  franchise: string;
  url: string;
  page: string;
  source: string;
  confidence: "high" | "medium" | "unverified";
  reason: string;
};

const ENTRIES = (audit.entries as Entry[]).slice().sort((a, b) => {
  const rank: Record<Entry["confidence"], number> = { unverified: 0, medium: 1, high: 2 };
  return rank[a.confidence] - rank[b.confidence] || a.name.localeCompare(b.name, "fr");
});

const LABELS: Record<Entry["confidence"], { text: string; tone: string }> = {
  unverified: { text: "non vérifié", tone: "border-amber-400/40 text-amber-200/80" },
  medium: { text: "moyen", tone: "border-sky-400/40 text-sky-200/80" },
  high: { text: "élevé", tone: "border-emerald-400/40 text-emerald-200/80" },
};

/** Liste groupée par niveau de confiance, dans l'ordre du tri. */
function groups() {
  const out: { confidence: Entry["confidence"]; entries: Entry[] }[] = [];
  for (const entry of ENTRIES) {
    const last = out[out.length - 1];
    if (last && last.confidence === entry.confidence) last.entries.push(entry);
    else out.push({ confidence: entry.confidence, entries: [entry] });
  }
  return out;
}

export default async function ImageAuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) notFound();

  const counts = ENTRIES.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.confidence] = (acc[entry.confidence] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <article>
      <span className="eyebrow">Atelier</span>
      <h1 className="display mt-2 text-4xl">Audit des visuels</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Visuels acceptés par la recherche stricte (<code>npm run images:strict</code>) : le
        personnage doit être un personnage fictif de la franchise sur Wikidata, ou avoir sa
        page exacte sur le wiki de la franchise. Triés du moins sûr au plus sûr —{" "}
        {counts.unverified ?? 0} visuel(s) antérieur(s) jamais revérifié(s),{" "}
        {counts.medium ?? 0} de confiance moyenne, {counts.high ?? 0} de confiance élevée.
      </p>

      {groups().map((group) => (
        <section key={group.confidence} className="mt-8">
          <h2 className="display text-2xl capitalize">
            {LABELS[group.confidence].text}{" "}
            <span className="text-sm text-white/40">({group.entries.length})</span>
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {group.entries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-black/40">
                  <Image
                    src={entry.url}
                    alt={`Visuel de ${entry.name}`}
                    fill
                    sizes="(max-width: 640px) 45vw, 220px"
                    unoptimized
                    style={{ objectFit: "cover", objectPosition: "50% 0%" }}
                  />
                  <span
                    className={`absolute left-1.5 top-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur ${LABELS[entry.confidence].tone}`}
                  >
                    {LABELS[entry.confidence].text}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-white/80" title={entry.name}>
                  {entry.name}
                </p>
                <p className="truncate text-[11px] text-white/40" title={entry.franchise}>
                  {entry.franchise}
                </p>
                <p className="truncate text-[11px] text-white/30" title={entry.reason}>
                  {entry.source}
                </p>
                {entry.page ? (
                  <a
                    href={entry.page}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] text-white/45 underline underline-offset-2 transition hover:text-white/70"
                  >
                    page d&apos;origine
                  </a>
                ) : (
                  <span className="text-[11px] text-white/25">page inconnue</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
