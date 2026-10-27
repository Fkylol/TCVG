import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";

/** Pied de page commun : signature, mentions légales, raccourcis. */
export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex max-w-md items-start gap-2 text-[11px] leading-relaxed text-[color:var(--muted)]">
          <LogoMark id="footer" className="mt-px h-5 w-5 shrink-0" />
          <span>
            <span className="display mr-2 text-[13px] tracking-[0.14em]">TCVG</span>
            Projet de fan, non officiel — les personnages et les marques appartiennent à leurs
            studios respectifs.
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/55">
            <FooterLink href="/#raretes">Raretés</FooterLink>
            <FooterLink href="/regles">Règles</FooterLink>
            <FooterLink href="/infos">Infos</FooterLink>
            <FooterLink href="/confidentialite">Confidentialité</FooterLink>
            <FooterLink href="/nouveautes">Nouveautés</FooterLink>
            <FooterLink href="/avis-et-bugs">Avis et bugs</FooterLink>
          </nav>
          <span
            title="Le site n'existe pour l'instant qu'en français"
            className="chip py-1 text-[color:var(--muted)]"
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
    <Link
      href={href}
      className="text-[12px] transition hover:text-white"
    >
      {children}
    </Link>
  );
}
