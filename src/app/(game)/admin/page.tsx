import Link from "next/link";
import { notFound } from "next/navigation";

import { canUseAtelier } from "@/lib/atelier-access";
import { countOpenReports } from "@/lib/atelier-reports";
import { requireSession } from "@/lib/auth";

export const metadata = {
  title: "Admin — TCVG",
  robots: { index: false, follow: false },
};

/**
 * Panneau d'administration : la porte d'entrée unique des outils de pilotage.
 * Chaque section garde sa propre page et sa propre garde ; celle-ci ne fait
 * que les présenter, avec le compteur de signalements de l'atelier.
 */
export default async function AdminHomePage() {
  const { supabase, user } = await requireSession();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  // Pas d'écran « accès refusé » : la page n'existe pas pour les joueurs.
  if (isAdmin !== true) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  // L'atelier est une liste nominative, pas un droit d'administration.
  const atelier = canUseAtelier(profile?.username as string | null);
  const waiting = atelier ? await countOpenReports(supabase) : 0;

  return (
    <article>
      <span className="eyebrow">Administration</span>
      <h1 className="display mt-2 text-4xl">Panneau admin</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Tout ce qui pilote le jeu au même endroit : les ventes et le journal du marché, le suivi
        des parrainages, l&apos;attribution des cadres et l&apos;atelier du catalogue.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <AdminTile
          href="/admin/marche"
          title="Marché"
          badge="7 jours et plus"
          description="Volume, commissions, vendeurs, paires d'arbitrage et journal des actions, sur la période choisie."
        />
        <AdminTile
          href="/admin/parrainage"
          title="Parrainages"
          badge="paiements"
          description="Parrainages en attente, seuils atteints et récompenses à vérifier avant paiement."
        />
        <AdminTile
          href="/admin/cadres"
          title="Cadres"
          badge="déblocages"
          description="Déblocages en attente, file d'évaluation et statistiques des cadres du catalogue."
        />
        {atelier ? (
          <AdminTile
            href="/atelier"
            title="Atelier"
            badge={waiting > 0 ? `${waiting} à vérifier` : "à jour"}
            description="File des cartes signalées par les joueurs, et l'éditeur de fiches sur la machine de développement."
            highlight={waiting > 0}
          />
        ) : (
          <div className="panel flex flex-col p-4 opacity-70">
            <div className="flex items-start justify-between gap-3">
              <span className="font-display text-lg text-white/60">Atelier</span>
              <span className="shrink-0 rounded-full border border-white/15 px-2 py-px font-mono text-[11px] text-white/35">
                accès nominatif
              </span>
            </div>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/40">
              L&apos;atelier du catalogue est réservé à ses deux responsables. Il ne dépend pas du
              rôle d&apos;administration.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

/** Entrée du panneau : même gabarit que l'accueil de l'atelier. */
function AdminTile({
  href,
  title,
  badge,
  description,
  highlight = false,
}: {
  href: string;
  title: string;
  badge: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="panel group flex flex-col p-4 transition-colors hover:border-cyan/40 hover:bg-white/[0.03]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-lg text-white/90">{title}</span>
        <span
          className={`shrink-0 rounded-full border px-2 py-px font-mono text-[11px] tabular-nums ${
            highlight
              ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
              : "border-white/15 text-white/40"
          }`}
        >
          {badge}
        </span>
      </div>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/50">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan/80 transition-colors group-hover:text-cyan">
        Ouvrir <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
