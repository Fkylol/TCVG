import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono, Syne } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { HalloweenOpening } from "@/components/halloween-opening";
import { HalloweenOverlay } from "@/components/halloween-overlay";
import { RevealHost } from "@/components/reveal-host";
import { XmasOverlay } from "@/components/xmas-overlay";
import { installCardEdits } from "@/lib/card-edits.server";
import { MOTION_BOOT_SCRIPT, MOTION_DEFAULT } from "@/lib/motion";
import { isLocale, LOCALE_COOKIE } from "@/lib/locale";
import { LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

// Texte courant : DM Sans.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Chiffres, statistiques et sur-titres : IBM Plex Mono.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Titres : Syne, très large et douce. Repli Arial Black.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "800"],
});

// URL publique, utilisée pour rendre absolus les liens de partage (og:image).
// `tcvg.fun` est le domaine personnalisé du Worker ; l'adresse workers.dev
// reste accessible en secours.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tcvg.fun";

const description =
  "Collectionne les personnages de jeux vidéo : ouvre des boosters, complète ton album, découvre chaque carte. Projet de fan, non officiel.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "TCVG",
  title: "TCVG — Trading Card Video Game",
  description,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "TCVG",
    title: "TCVG — Trading Card Video Game",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "TCVG — Trading Card Video Game",
    description,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Le catalogue édité en ligne est chargé avant tout rendu : le serveur et le
  // navigateur lisent la même liste (nom, rareté, visuel, cartes retirées).
  const [cardEdits, localeCookie] = await Promise.all([
    installCardEdits(),
    cookies().then((jar) => jar.get(LOCALE_COOKIE)?.value),
  ]);
  const locale = isLocale(localeCookie) ? localeCookie : "fr";
  const cardEditsJson = JSON.stringify(cardEdits).replace(/</g, "\\u003c");

  return (
    <html
      lang={locale}
      // Le mode par défaut est écrit ici : le CSS s'y fie avant même le script
      // d'amorçage, qui ne corrige que les navigateurs réglés sur « suivre le
      // système ».
      data-motion={MOTION_DEFAULT}
      className={`${dmSans.variable} ${plexMono.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Avant le premier rendu : les animations ne démarrent pas pour rien
            si le joueur a choisi de suivre le système. */}
        <Script
          id="motion-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }}
        />
        {/* Éditions du catalogue : lues avant l'hydratation, pour que les
            cartes modifiées dans l'atelier s'affichent dès le premier rendu. */}
        <Script
          id="card-edits"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `globalThis.__CARD_EDITS__=${cardEditsJson};`,
          }}
        />
        <LocaleProvider locale={locale}>
          {children}
          {/* L'écran d'ouverture de booster, monté une fois pour toutes : la
              citrouille d'Halloween l'affiche depuis n'importe quelle page. */}
          <RevealHost />
        </LocaleProvider>
        {/* La citrouille a accordé son booster : on tire le pack saisonnier. */}
        <HalloweenOpening />
        {/* CAPTURE-OG : overlay coupé le temps de la capture */}
        <HalloweenOverlay
          force={process.env.NEXT_PUBLIC_HALLOWEEN_FORCE === "1"}
          zIndex={35}
        />
        <XmasOverlay force={process.env.NEXT_PUBLIC_XMAS_FORCE === "1"} zIndex={45} />
      </body>
    </html>
  );
}
