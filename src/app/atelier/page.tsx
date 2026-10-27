import Link from "next/link";

import { ATELIER_LOCAL, atelierSession } from "@/lib/atelier-access";
import { readCardReports } from "@/lib/atelier-reports";
import { reportTopicLabel } from "@/lib/card-reports";
import { getCard } from "@/lib/cards";

export const metadata = {
  title: "Atelier — TCVG",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function moment(value: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Accueil de l'atelier : le choix des outils plutôt qu'un saut direct dans la
 * file de signalements. L'édition de cartes n'existe qu'en local (elle écrit
 * dans les fichiers du catalogue), la file de signalements marche aussi en
 * ligne avec une session administrateur.
 */
export default async function AtelierHomePage() {
  const session = await atelierSession();
  const { open, error } = await readCardReports(session?.supabase);
  const waiting = open.length;

  return (
    <article className="mx-auto w-full max-w-5xl">
      <span className="eyebrow">{ATELIER_LOCAL ? "Atelier · local" : "Atelier · administration"}</span>
      <h1 className="display mt-2 text-4xl">Atelier du catalogue</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Le poste de travail des cartes : la file des signalements envoyés depuis la collection, et
        l&apos;éditeur qui ajoute ou corrige une carte du catalogue.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          Lecture des signalements impossible : {error}
        </p>
      )}

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {/* ————— Signalements ————— */}
        <Link
          href="/atelier/signalements"
          className="panel group flex flex-col p-4 transition-colors hover:border-cyan/40 hover:bg-white/[0.03]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-display text-lg text-white/90">Signalements</span>
            <span
              className={`shrink-0 rounded-full border px-2 py-px font-mono text-[11px] tabular-nums ${
                waiting > 0
                  ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                  : "border-white/15 text-white/40"
              }`}
            >
              {waiting > 0 ? `${waiting} à vérifier` : "à jour"}
            </span>
          </div>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/50">
            Les cartes signalées par les joueurs, avec le motif et le message. Tu ouvres la fiche,
            tu corriges, tu marques le signalement comme traité.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan/80 transition-colors group-hover:text-cyan">
            Ouvrir la file <span aria-hidden>→</span>
          </span>
        </Link>

        {/* ————— Éditeur de cartes ————— */}
        <Link
          href="/atelier/cartes"
          className="panel group flex flex-col p-4 transition-colors hover:border-cyan/40 hover:bg-white/[0.03]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-display text-lg text-white/90">Cartes</span>
            <span className="shrink-0 rounded-full border border-white/15 px-2 py-px font-mono text-[11px] text-white/40">
              {ATELIER_LOCAL ? "local" : "en ligne"}
            </span>
          </div>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/50">
            Corriger une carte : nom, rareté, univers, emoji et visuel, publiés immédiatement.
            La suppression retire la carte du jeu avec ses copies, annonces et fiches.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan/80 transition-colors group-hover:text-cyan">
            Ouvrir l&apos;éditeur <span aria-hidden>→</span>
          </span>
        </Link>
      </div>

      {/* ————— Ce qui attend une vérification ————— */}
      {waiting > 0 && (
        <>
          <div className="mt-9 flex items-end justify-between gap-3">
            <h2 className="display text-lg text-white/85">À vérifier</h2>
            <Link
              href="/atelier/signalements"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35 transition-colors hover:text-cyan"
            >
              Voir les {waiting} signalements
            </Link>
          </div>
          <span className="section-rule section-rule-tight" aria-hidden />

          <ul className="overflow-hidden rounded-[var(--radius)] border border-white/10 bg-[var(--panel-bg-deep)]">
            {open.slice(0, 4).map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-white/[0.07] px-3 py-2.5 last:border-b-0"
              >
                <span className="chip px-1.5 py-0.5 text-[10px] text-cyan">
                  {reportTopicLabel(report.topic)}
                </span>
                <Link
                  href={`/card/${report.card_id}`}
                  className="text-sm text-white/80 underline-offset-2 hover:underline"
                >
                  {getCard(report.card_id)?.name ?? report.card_id}
                </Link>
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/40">
                  {report.message}
                </span>
                <span className="font-mono text-[11px] text-white/25">
                  {moment(report.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
