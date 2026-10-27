import Link from "next/link";

import { AtelierBell } from "@/app/atelier/bell";
import { NavLink } from "@/components/nav-link";
import { atelierSession } from "@/lib/atelier-access";
import { countOpenReports } from "@/lib/atelier-reports";

export const metadata = {
  title: "Atelier — TCVG",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Coquille de l'atelier : accès réservé aux administrateurs en ligne, bandeau
 * de navigation et cloche des signalements en attente sur toutes les pages.
 */
export default async function AtelierLayout({ children }: { children: React.ReactNode }) {
  const session = await atelierSession();
  const reports = await countOpenReports(session?.supabase);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Même verre que la barre du site : le contenu défile dessous, il reste lisible. */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--glass)] backdrop-blur-[var(--glass-blur)]">
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-4">
          <Link href="/" className="tab shrink-0 px-1 text-[11px] sm:px-2">
            ← Retour au jeu
          </Link>
          <Link
            href="/atelier"
            className="display shrink-0 text-[12px] tracking-[0.16em] text-white/60 transition hover:text-cyan"
          >
            Atelier
          </Link>
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            <NavLink href="/atelier/signalements">Signalements</NavLink>
            {/* En local l'éditeur écrit les fichiers ; en ligne il écrit en base. */}
            <NavLink href="/atelier/cartes">Cartes</NavLink>
          </nav>
          <div className="ml-auto flex shrink-0 items-center">
            <AtelierBell count={reports} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
