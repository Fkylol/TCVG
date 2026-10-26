import { notFound } from "next/navigation";
import {
  assignFrame,
  queueAllFrames,
  removeFrame,
  setFrameActive,
} from "@/app/actions/frames";
import { requireSession } from "@/lib/auth";
import { getFrameAdminReport } from "@/lib/frames";
import { FRAMES, FRAME_LANES } from "@/lib/frames.config";

export const metadata = {
  title: "Admin cadres — TCVG",
  robots: { index: false, follow: false },
};

const ACTION_LABEL: Record<string, string> = {
  frame_activated: "Cadre activé",
  frame_deactivated: "Cadre désactivé",
  frame_granted: "Cadre attribué",
  frame_removed: "Cadre retiré",
  frame_queue_all: "Recalcul global",
};

function moment(value: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminFramesPage() {
  const { supabase } = await requireSession();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  const report = await getFrameAdminReport(supabase);
  if (!report) notFound();

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Administration</span>
          <h1 className="display mt-2 text-4xl">Cadres</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Active ou retire un cadre du catalogue, attribue-le à un joueur avec un motif, ou
            relance le recalcul global. Toutes les actions sont journalisées.
          </p>
        </div>

        <form action={queueAllFrames}>
          <button type="submit" className="btn btn-primary btn-sm">
            Relancer le recalcul global
          </button>
        </form>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="panel p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Joueurs</p>
          <p className="mt-1 font-mono text-xl font-semibold">{report.totalPlayers}</p>
        </div>
        <div className="panel p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">En file</p>
          <p className="mt-1 font-mono text-xl font-semibold">{report.queued}</p>
          <p className="text-[10px] text-white/30">traitée par /api/cron/frames</p>
        </div>
        <div className="panel p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Cadres au catalogue</p>
          <p className="mt-1 font-mono text-xl font-semibold">{FRAMES.length}</p>
        </div>
        <div className="panel p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Débloqués au total</p>
          <p className="mt-1 font-mono text-xl font-semibold">
            {report.rows.reduce((sum, row) => sum + row.count, 0)}
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">Catalogue</h2>
        <div className="mt-2 overflow-x-auto border border-white/10">
          <table className="w-full min-w-[780px] text-left text-[12px]">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-white/40">
              <tr>
                <th className="px-3 py-2">Cadre</th>
                <th className="px-3 py-2">Voie</th>
                <th className="px-3 py-2">Prestige</th>
                <th className="px-3 py-2 text-right">Joueurs</th>
                <th className="px-3 py-2">État</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {report.rows.map((row) => {
                const lane = FRAME_LANES.find((item) => item.id === row.lane);
                const frame = FRAMES.find((item) => item.id === row.id);
                return (
                  <tr key={row.id} className="align-middle">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-5 w-5 shrink-0 rounded-full border"
                          style={{
                            borderColor: frame?.colors[0],
                            background: `linear-gradient(135deg, ${frame?.colors.join(", ")})`,
                          }}
                        />
                        <div>
                          <span className="text-white/80">{row.name}</span>
                          {row.secret && (
                            <span className="ml-1.5 font-mono text-[9px] uppercase text-fuchsia-200/60">
                              secret
                            </span>
                          )}
                          <span className="block font-mono text-[9px] text-white/25">{row.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-white/45">{lane?.label ?? row.lane}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-acid/70">
                      {"◆".repeat(row.prestige ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-white/60">
                      {row.count}
                      <span className="ml-1 text-[10px] text-white/25">
                        {report.totalPlayers > 0
                          ? `${Math.round((row.count / report.totalPlayers) * 100)} %`
                          : "0 %"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`chip px-2 py-0.5 text-[10px] ${
                          row.active
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-white/10 text-white/45"
                        }`}
                      >
                        {row.active ? "Actif" : "Désactivé"}
                      </span>
                      {row.override && (
                        <span className="ml-1 text-[9px] text-amber-200/60">forcé</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {frame?.active === false ? (
                        <span
                          className="text-[10px] text-white/30"
                          title="Désactivé dans src/lib/frames.config.ts"
                        >
                          Configuration
                        </span>
                      ) : (
                        <form action={setFrameActive}>
                          <input type="hidden" name="frame" value={row.id} />
                          <input type="hidden" name="active" value={row.active ? "false" : "true"} />
                          <input type="hidden" name="reason" value="admin" />
                          <button type="submit" className="btn btn-outline btn-sm">
                            {row.active ? "Désactiver" : "Activer"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">Attribuer un cadre</h2>
          <p className="mt-1 text-[11px] text-white/30">
            Le joueur reçoit une notification et le cadre reste acquis. L’attribution est
            journalisée avec son motif.
          </p>
          <form action={assignFrame} className="mt-3 space-y-2">
            <input
              name="username"
              required
              placeholder="Pseudo exact du joueur"
              className="field w-full"
              aria-label="Pseudo du joueur"
            />
            <select name="frame" className="field w-full" aria-label="Cadre à attribuer">
              {FRAMES.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.name} ({frame.id})
                </option>
              ))}
            </select>
            <input
              name="reason"
              required
              maxLength={200}
              placeholder="Motif (visible dans le journal)"
              className="field w-full"
              aria-label="Motif"
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Attribuer
            </button>
          </form>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">Retirer un cadre</h2>
          <p className="mt-1 text-[11px] text-white/30">
            À réserver aux corrections et sanctions : la règle normale est la permanence. L’Acier
            ne peut pas être retiré.
          </p>
          <form action={removeFrame} className="mt-3 space-y-2">
            <input
              name="username"
              required
              placeholder="Pseudo exact du joueur"
              className="field w-full"
              aria-label="Pseudo du joueur"
            />
            <select name="frame" className="field w-full" aria-label="Cadre à retirer">
              {FRAMES.filter((frame) => frame.id !== "steel").map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.name} ({frame.id})
                </option>
              ))}
            </select>
            <input
              name="reason"
              required
              maxLength={200}
              placeholder="Motif (visible dans le journal)"
              className="field w-full"
              aria-label="Motif"
            />
            <button type="submit" className="btn btn-outline btn-sm">
              Retirer
            </button>
          </form>
        </section>
      </div>

      <section className="panel mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">
            Journal — 30 dernières actions
          </h2>
          <span className="font-mono text-[11px] text-white/35">{report.audit.length}</span>
        </div>
        {report.audit.length === 0 ? (
          <p className="border-t border-white/10 px-4 py-8 text-center text-sm text-white/40">
            Aucune action d’administration pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full min-w-[620px] text-left text-[12px]">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                <tr>
                  <th className="px-4 py-2 font-normal">Quand</th>
                  <th className="px-4 py-2 font-normal">Acteur</th>
                  <th className="px-4 py-2 font-normal">Action</th>
                  <th className="px-4 py-2 font-normal">Cadre</th>
                  <th className="px-4 py-2 font-normal">Joueur</th>
                  <th className="px-4 py-2 font-normal">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.audit.map((entry, index) => (
                  <tr key={`${entry.at}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-white/40">
                      {moment(entry.at)}
                    </td>
                    <td className="px-4 py-2 text-white/65">{entry.actor ?? "—"}</td>
                    <td className="px-4 py-2 text-white/60">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </td>
                    <td className="px-4 py-2 text-white/50">{entry.frameId ?? "—"}</td>
                    <td className="px-4 py-2 text-white/50">{entry.username ?? "—"}</td>
                    <td className="px-4 py-2 text-white/35">{entry.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
