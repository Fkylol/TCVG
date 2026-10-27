import Link from "next/link";
import { notFound } from "next/navigation";
import { approveReferral, refuseReferral } from "@/app/actions/referral";
import { requireSession } from "@/lib/auth";
import { getReferralAdminReport } from "@/lib/referral/service";
import { STATUS_LABEL, type ReferralStatus } from "@/lib/referral/rules";

export const metadata = {
  title: "Admin parrainage — TCVG",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<ReferralStatus, string> = {
  en_cours: "bg-white/10 text-white/60",
  eligible: "bg-cyan/15 text-cyan",
  en_attente: "bg-amber-400/15 text-amber-200",
  a_examiner: "bg-amber-400/15 text-amber-200",
  paye: "bg-emerald-400/15 text-emerald-300",
  refuse: "bg-rose-400/15 text-rose-200",
};

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Tous", value: null },
  { label: "En cours", value: "en_cours" },
  { label: "En attente", value: "en_attente" },
  { label: "À examiner", value: "a_examiner" },
  { label: "Payés", value: "paye" },
  { label: "Refusés", value: "refuse" },
];

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Signaux lisibles, sans exposer les seuils exacts côté joueur. */
function flagsLabel(flags: Record<string, unknown>): string {
  const parts: string[] = [];
  if (flags.same_ip) parts.push("même IP");
  if (flags.shared_ip_group) parts.push("groupe d'IP");
  if (flags.signup_burst) parts.push("rafale d'inscriptions");
  return parts.length ? parts.join(" · ") : "—";
}

function isFinal(status: ReferralStatus): boolean {
  return status === "paye" || status === "refuse";
}

export default async function AdminReferralPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { supabase } = await requireSession();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  const { statut } = await searchParams;
  const allowed = new Set(FILTERS.map((filter) => filter.value).filter(Boolean));
  const filter = statut && allowed.has(statut) ? statut : null;

  const report = await getReferralAdminReport(supabase, filter);
  if (!report) notFound();

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Administration</span>
          <h1 className="display mt-2 text-4xl">Parrainage</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Les parrainages « à examiner » ne paient jamais automatiquement. Approuver crédite les
            deux soldes bonus ; refuser ferme le parrainage sans détail transmis au joueur.
          </p>
        </div>

        <Link href="/api/admin/parrainage/export" className="btn btn-outline btn-sm">
          Export CSV
        </Link>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: report.counts.total ?? 0 },
          { label: "En cours", value: report.counts.en_cours ?? 0 },
          { label: "En attente", value: report.counts.en_attente ?? 0 },
          { label: "À examiner", value: report.counts.a_examiner ?? 0 },
          { label: "Payés", value: report.counts.paye ?? 0 },
          { label: "Refusés", value: report.counts.refuse ?? 0 },
        ].map((item) => (
          <div key={item.label} className="border border-white/10 px-3 py-2">
            <p className="font-mono text-xl font-semibold">{item.value}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="tabs mb-4 text-xs">
        {FILTERS.map((item) => (
          <Link
            key={item.label}
            href={item.value ? `/admin/parrainage?statut=${item.value}` : "/admin/parrainage"}
            className={`tab px-3 py-1.5 ${
              (item.value ?? null) === filter ? "bg-cyan text-ink" : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {report.rows.length === 0 ? (
        <p className="panel p-5 text-sm text-white/45">Aucun parrainage dans ce filtre.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-white/40">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Parrain → filleul</th>
                <th className="px-3 py-2">Créé</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Ouverts</th>
                <th className="px-3 py-2">A2F / Discord</th>
                <th className="px-3 py-2">Signaux</th>
                <th className="px-3 py-2">Échéance / paiement</th>
                <th className="px-3 py-2">Motif</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {report.rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-3 font-mono text-white/35">{row.id}</td>
                  <td className="px-3 py-3">
                    <span className="text-white/80">{row.referrer}</span>
                    <span className="text-white/30"> → </span>
                    <span className="text-white/80">{row.referred}</span>
                  </td>
                  <td className="px-3 py-3 text-white/45">{dateLabel(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`chip px-2 py-0.5 text-[10px] ${STATUS_TONE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    {row.path && (
                      <span className="mt-1 block text-[10px] text-white/35">
                        {row.path === "immediat" ? "immédiat" : "différé"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-white/55">{row.openings}</td>
                  <td className="px-3 py-3">
                    <span className={row.mfa ? "text-emerald-300" : "text-white/45"}>
                      {row.mfa ? "A2F" : "sans A2F"}
                    </span>
                    <span className="block text-[10px] text-white/35">
                      {row.discordLinked ? "Discord lié" : "Discord non lié"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-white/45">{flagsLabel(row.flags)}</td>
                  <td className="px-3 py-3 text-white/45">
                    {row.paidAt ? dateLabel(row.paidAt) : dateLabel(row.eligibleAt)}
                  </td>
                  <td className="px-3 py-3 text-white/35">{row.refusedReason ?? "—"}</td>
                  <td className="px-3 py-3">
                    {isFinal(row.status) ? (
                      <span className="text-white/25">—</span>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {row.status === "a_examiner" && (
                          <form action={approveReferral}>
                            <input type="hidden" name="id" value={row.id} />
                            <button type="submit" className="btn btn-primary btn-sm">
                              Approuver
                            </button>
                          </form>
                        )}
                        <form action={refuseReferral}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="reason" value="admin" />
                          <button type="submit" className="btn btn-outline btn-sm">
                            Refuser
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
