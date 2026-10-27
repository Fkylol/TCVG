import Link from "next/link";

import { resolveCardReport } from "@/app/atelier/signalements/actions";
import { ATELIER_LOCAL, atelierSession } from "@/lib/atelier-access";
import { readCardReports } from "@/lib/atelier-reports";
import { reportTopicLabel } from "@/lib/card-reports";
import { getCard } from "@/lib/cards";

export const metadata = {
  title: "Atelier — signalements",
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
 * File de vérification des cartes signalées depuis la collection.
 *
 * En ligne, la page est réservée aux administrateurs (garde du layout) et lit
 * la base avec leur session : les policies de la migration 050 n'ouvrent la
 * table qu'à `is_admin()`. En local, la lecture passe par la connexion de
 * maintenance (`.env`), comme les scripts.
 */
export default async function AtelierReportsPage() {
  const session = await atelierSession();
  const { open, done, error } = await readCardReports(session?.supabase);

  /** Marque traité / rouvre, puis relit la page (revalidation de l'action). */
  async function toggle(formData: FormData) {
    "use server";
    await resolveCardReport(Number(formData.get("id")), formData.get("done") === "1");
  }

  return (
    <article className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{ATELIER_LOCAL ? "Atelier · local" : "Atelier"}</span>
          <h1 className="display mt-2 text-4xl">Signalements</h1>
          <span className="title-rule" aria-hidden />
        </div>
        <Link href="/atelier" className="btn btn-outline px-4 text-xs">
          ← Atelier
        </Link>
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Les cartes signalées depuis la collection arrivent ici, avec le motif et le message du
        joueur. « Modifier la carte » ouvre directement son formulaire d&apos;édition — visuel
        compris — d&apos;où l&apos;on publie la correction ; le signalement est ensuite marqué
        comme traité.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          Lecture impossible : {error}
          {ATELIER_LOCAL && (
            <>
              {" "}— vérifie <code className="font-mono">.env</code>{" "}
              (<code className="font-mono">SUPABASE_ACCESS_TOKEN</code> ou{" "}
              <code className="font-mono">SUPABASE_DB_URL</code>) et que la migration 050 est
              appliquée.
            </>
          )}
        </p>
      )}

      <div className="mt-9 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-lg text-white/85">À vérifier</h2>
        <span className="chip text-[10px]">
          {open.length} en attente
        </span>
      </div>
      <span className="section-rule section-rule-tight" aria-hidden />

      {open.length === 0 ? (
        <p className="panel border-dashed px-4 py-10 text-center text-sm text-white/40">
          Aucun signalement en attente.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {open.map((report) => {
            const card = getCard(report.card_id);
            return (
              <li
                key={report.id}
                className="panel p-4 transition-colors hover:border-cyan/25"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="chip px-1.5 py-0.5 text-[10px] text-cyan">
                    {reportTopicLabel(report.topic)}
                  </span>
                  <span className="text-sm font-medium text-white/85">
                    {card?.name ?? report.card_id}
                  </span>
                  <span className="font-mono text-[11px] text-white/35">{report.card_id}</span>
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-white/35">
                    {moment(report.created_at)}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{report.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Toujours visible : en local comme en ligne, le formulaire
                      de la carte s'ouvre déjà chargé (`?edit=`). */}
                  <Link
                    href={`/atelier/cartes?edit=${encodeURIComponent(report.card_id)}`}
                    className="btn btn-primary px-3 text-[11px]"
                  >
                    Modifier la carte
                  </Link>
                  <Link href={`/card/${report.card_id}`} className="btn btn-outline px-3 text-[11px]">
                    Voir la fiche
                  </Link>
                  <form action={toggle} className="ml-auto">
                    <input type="hidden" name="id" value={report.id} />
                    <input type="hidden" name="done" value="1" />
                    <button type="submit" className="btn btn-outline px-3 text-[11px]">
                      Marquer comme traité
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <h2 className="display mt-9 text-lg text-white/70">Traités récemment</h2>
          <span className="section-rule section-rule-tight" aria-hidden />
          <ul className="overflow-hidden rounded-[var(--radius)] border border-white/10 bg-[var(--panel-bg-deep)]">
            {done.map((report) => {
              const card = getCard(report.card_id);
              return (
                <li
                  key={report.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-white/[0.07] px-3.5 py-2.5 text-[12px] text-white/45 last:border-b-0"
                >
                  <span className="text-white/60">{card?.name ?? report.card_id}</span>
                  <span className="text-white/30">· {reportTopicLabel(report.topic)}</span>
                  <span className="min-w-0 flex-1 truncate">{report.message}</span>
                  <span className="font-mono text-[11px] tabular-nums text-white/25">
                    traité {moment(report.resolved_at ?? "")}
                  </span>
                  <form action={toggle}>
                    <input type="hidden" name="id" value={report.id} />
                    <input type="hidden" name="done" value="0" />
                    <button
                      type="submit"
                      className="text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
                    >
                      Rouvrir
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-8 text-[11px] leading-relaxed text-white/30">
        {ATELIER_LOCAL
          ? "Lecture par la connexion de maintenance (`.env`), jamais par la clé publique : les signalements restent invisibles aux joueurs (migration 050)."
          : "Lecture avec la session administrateur, sous les policies de la migration 050 : les signalements restent invisibles aux joueurs."}
      </p>
    </article>
  );
}
