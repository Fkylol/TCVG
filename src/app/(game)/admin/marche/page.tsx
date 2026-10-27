import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCard } from "@/lib/cards";

export const metadata = {
  title: "Admin marché — TCVG",
  robots: { index: false, follow: false },
};

type Report = {
  days: number;
  trades: number;
  volume: number;
  fees: number;
  buyers: number;
  listings: number;
  orders: number;
  top_sellers: { username: string; trades: number; volume: number; net: number }[];
  top_cards: {
    card_id: string;
    trades: number;
    volume: number;
    lowest: number;
    highest: number;
  }[];
  pairs: { a: string; b: string; ab: number; ba: number; total: number }[];
  bursts: { username: string; actions: number }[];
  audit: {
    at: string;
    actor: string;
    action: string;
    card_id: string | null;
    amount: number | null;
    details: Record<string, unknown>;
  }[];
};

/** Libellés courts des actions du journal. */
const ACTION_LABEL: Record<string, string> = {
  listing_created: "Annonce créée",
  listing_price: "Prix modifié",
  listing_sold: "Annonce vendue",
  listing_cancelled: "Annonce annulée",
  order_created: "Ordre posé",
  order_filled: "Ordre servi",
  order_cancelled: "Ordre annulé",
  trade: "Vente",
};

function moment(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ jours?: string }>;
}) {
  const { supabase } = await requireSession();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  // Pas d'écran « accès refusé » : la page n'existe pas pour les autres.
  if (isAdmin !== true) notFound();

  const { jours } = await searchParams;
  const requested = Number.parseInt(jours ?? "7", 10);
  const days = Number.isFinite(requested) ? Math.min(90, Math.max(1, requested)) : 7;

  const { data, error } = await supabase.rpc("admin_market_report", { p_days: days });
  if (error || !data) {
    console.error("admin_market_report", error);
    notFound();
  }
  const report = data as Report;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Administration</span>
          <h1 className="display mt-2 text-4xl">Marché</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Volumes, vendeurs, échanges croisés et journal d&apos;audit. Cette page reste invisible
            pour les joueurs qui ne portent pas le drapeau d&apos;administration.
          </p>
        </div>

        <div className="tabs text-xs">
          {[1, 7, 30, 90].map((value) => (
            <Link
              key={value}
              href={`/admin/marche?jours=${value}`}
              className={`tab px-3 py-1.5 ${days === value ? "bg-cyan text-ink" : ""}`}
            >
              {value} j
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Ventes",
            value: String(report.trades),
            hint: `${report.buyers} acheteur${report.buyers > 1 ? "s" : ""} distinct${report.buyers > 1 ? "s" : ""}`,
          },
          {
            label: "Volume",
            value: `◆ ${report.volume}`,
            hint: `◆ ${report.fees} de commission détruite`,
          },
          {
            label: "Carnet",
            value: `${report.listings} / ${report.orders}`,
            hint: "annonces actives / ordres en attente",
          },
          {
            label: "Période",
            value: `${report.days} j`,
            hint: "fenêtre du rapport",
          },
        ].map((tile) => (
          <div key={tile.label} className="panel p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{tile.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold text-white/90">{tile.value}</p>
            <p className="mt-0.5 text-[10px] text-white/30">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">Meilleurs vendeurs</h2>
          {report.top_sellers.length === 0 ? (
            <p className="mt-2 text-sm text-white/40">Aucune vente sur la période.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {report.top_sellers.map((seller) => (
                <li key={seller.username} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm text-white/80">{seller.username}</span>
                  <span className="shrink-0 font-mono text-[11px] text-white/35">
                    {seller.trades} · ◆ {seller.volume} · net ◆ {seller.net}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">Cartes échangées</h2>
          {report.top_cards.length === 0 ? (
            <p className="mt-2 text-sm text-white/40">Aucune vente sur la période.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {report.top_cards.map((entry) => (
                <li key={entry.card_id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/card/${entry.card_id}`}
                    className="min-w-0 truncate text-sm text-white/80 hover:text-cyan"
                  >
                    {getCard(entry.card_id)?.name ?? entry.card_id}
                  </Link>
                  <span className="shrink-0 font-mono text-[11px] text-white/35">
                    {entry.trades} · ◆ {entry.volume} · {entry.lowest}–{entry.highest}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">Échanges croisés</h2>
          <p className="mt-1 text-[11px] text-white/30">
            Deux joueurs qui se revendent des cartes dans les deux sens, au moins deux fois chacun —
            le schéma typique de comptes liés.
          </p>
          {report.pairs.length === 0 ? (
            <p className="mt-2 text-sm text-white/40">Aucun échange croisé détecté.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {report.pairs.map((pair) => (
                <li key={`${pair.a}-${pair.b}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm text-white/80">
                    {pair.a} ↔ {pair.b}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-amber-200/70">
                    {pair.ab} / {pair.ba}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">Rafales d&apos;actions</h2>
          <p className="mt-1 text-[11px] text-white/30">
            Joueurs au-delà de 20 actions au marché sur la période (annonces, ordres, ventes).
          </p>
          {report.bursts.length === 0 ? (
            <p className="mt-2 text-sm text-white/40">Aucune rafale détectée.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {report.bursts.map((burst) => (
                <li key={burst.username} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm text-white/80">{burst.username}</span>
                  <span className="shrink-0 font-mono text-[11px] text-amber-200/70">
                    {burst.actions} actions
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">
            Journal d&apos;audit — 50 dernières lignes
          </h2>
          <span className="font-mono text-[11px] text-white/35">{report.audit.length}</span>
        </div>

        {report.audit.length === 0 ? (
          <p className="border-t border-white/10 px-4 py-8 text-center text-sm text-white/40">
            Le journal est vide : aucune action au marché pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full text-left text-[12px]">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                <tr>
                  <th className="px-4 py-2 font-normal">Quand</th>
                  <th className="px-4 py-2 font-normal">Acteur</th>
                  <th className="px-4 py-2 font-normal">Action</th>
                  <th className="px-4 py-2 font-normal">Carte</th>
                  <th className="px-4 py-2 text-right font-normal">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.audit.map((entry, index) => (
                  <tr key={`${entry.at}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-white/40">
                      {moment(entry.at)}
                    </td>
                    <td className="px-4 py-2 text-white/75">{entry.actor}</td>
                    <td className="px-4 py-2 text-white/60">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                      {typeof entry.details?.cancel_reason === "string" &&
                        entry.details.cancel_reason === "expired" && (
                          <span className="ml-1 text-[10px] text-amber-200/60">(expirée)</span>
                        )}
                    </td>
                    <td className="px-4 py-2 text-white/50">
                      {entry.card_id ? (getCard(entry.card_id)?.name ?? entry.card_id) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-white/55">
                      {entry.amount == null ? "—" : `◆ ${entry.amount}`}
                    </td>
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
