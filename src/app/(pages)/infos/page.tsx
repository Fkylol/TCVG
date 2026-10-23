import Link from "next/link";
import { CARDS } from "@/lib/cards";

export const metadata = { title: "Infos — TCVG" };

export default function InfoPage() {
  return (
    <article>
      <span className="eyebrow">Infos</span>
      <h1 className="display mt-2 text-4xl">Le projet</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        TCVG est un jeu de collection de cartes consacré aux personnages de jeux vidéo :{" "}
        {CARDS.length} héros, méchants et créatures réunis dans un seul album, à obtenir uniquement
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
        Un compte contient un pseudo, l&apos;adresse email de ton compte Discord et ta collection.
        La connexion passe uniquement par Discord : aucun mot de passe n&apos;est créé ni stocké par
        le site. Discord transmet l&apos;email et le pseudo, rien de plus. Aucune donnée n&apos;est
        revendue ni transmise à des tiers, et il n&apos;y a pas de traceur publicitaire.
      </Section>

      <Section title="Comment c&apos;est fait">
        Le site est une application Next.js déployée sur Cloudflare, avec Supabase pour
        l&apos;authentification et la base de données. Les ouvertures de boosters, les soldes et les
        raretés sont décidés côté serveur, dans des transactions en base : le navigateur ne peut pas
        s&apos;en attribuer un seul.
      </Section>

      <Section title="Une erreur, une idée ?">
        <Link href="/avis-et-bugs" className="text-acid underline-offset-4 hover:underline">
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
    <section className="mt-9 border-t border-white/10 pt-6">
      <h2 className="display text-xl">{title}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-white/55">{children}</div>
    </section>
  );
}
