import Link from "next/link";
import { catalogSize } from "@/lib/cards";

export const metadata = { title: "Infos — TCVG" };

export default function InfoPage() {
  return (
    <article>
      <span className="eyebrow">Infos</span>
      <h1 className="display mt-2 text-4xl">Le projet</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        TCVG est un jeu de collection de cartes consacré aux personnages de jeux vidéo :{" "}
        {catalogSize()} héros, méchants et créatures réunis dans un seul album, à obtenir uniquement
        en ouvrant des boosters gratuits.
      </p>

      <Section title="Un projet de fan, non officiel">
        Le site n&apos;est affilié à aucun studio, éditeur ou ayant droit. Les personnages et les
        marques cités appartiennent à leurs propriétaires respectifs. Aucune illustration officielle
        n&apos;est hébergée : les visuels sont affichés depuis leur source d&apos;origine (Wikipédia
        ou les wikis communautaires Fandom), et une carte sans visuel disponible retombe sur un
        rendu généré, dégradé et emoji.
      </Section>

      <Section title="Gratuit, sans paiement">
        Il n&apos;y a ni boutique payante, ni publicité, ni abonnement. Les boosters se gagnent avec
        le temps, et la future monnaie du jeu, les Pixels, se gagnera uniquement en jouant. Aucun
        moyen de paiement n&apos;est connecté au site.
      </Section>

      <Section title="Tes données">
        Un compte contient un pseudo, ton identifiant Discord et ta collection. La connexion passe
        uniquement par Discord : aucun mot de passe n&apos;est créé ni stocké par le site. Le site
        demande uniquement le scope « identify » (pseudo et identifiant), jamais l&apos;email, les
        serveurs, les messages ou les amis. Aucune donnée n&apos;est revendue ni transmise à des
        tiers, et il n&apos;y a pas de traceur publicitaire. Le détail figure sur la page{" "}
        <Link href="/confidentialite" className="text-cyan underline-offset-4 hover:underline">
          Confidentialité
        </Link>
        .
      </Section>

      <Section title="Comment c&apos;est fait">
        Le site est une application Next.js déployée sur Cloudflare, avec Supabase pour
        l&apos;authentification et la base de données. Les ouvertures de boosters, les soldes et les
        raretés sont décidés côté serveur, dans des transactions en base : le navigateur ne peut pas
        s&apos;en attribuer un seul.
      </Section>

      <Section title="Une erreur, une idée ?">
        <Link href="/avis-et-bugs" className="text-cyan underline-offset-4 hover:underline">
          La page Avis et bugs
        </Link>{" "}
        sert exactement à ça. Décris ce qui s&apos;est passé et, si c&apos;est un bug, la page
        concernée et ce que tu attendais.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <span className="section-rule section-rule-tight" aria-hidden />
      <h2 className="display text-xl">{title}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-white/55">{children}</div>
    </section>
  );
}
