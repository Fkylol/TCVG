import Link from "next/link";

/** Pied de page commun : signature, mentions légales, raccourcis. */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-[11px] leading-relaxed text-white/35">
          <span className="display mr-2 text-[13px] tracking-[0.14em] text-white/70">TCVG</span>
          Projet de fan, non officiel — les personnages et les marques appartiennent à leurs studios
          respectifs.
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/45">
            <FooterLink href="/#raretes">Raretés</FooterLink>
            <FooterLink href="/regles">Règles</FooterLink>
            <FooterLink href="/infos">Infos</FooterLink>
            <FooterLink href="/nouveautes">Nouveautés</FooterLink>
            <FooterLink href="/classement">Classement</FooterLink>
            <FooterLink href="/avis-et-bugs">Avis et bugs</FooterLink>
          </nav>
          <span
            title="Le site n'existe pour l'instant qu'en français"
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/40"
          >
            Français
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="transition hover:text-white">
      {children}
    </Link>
  );
}
