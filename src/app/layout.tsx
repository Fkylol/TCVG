import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Space_Mono, Syne } from "next/font/google";
import { HalloweenOverlay } from "@/components/halloween-overlay";
import { XmasOverlay } from "@/components/xmas-overlay";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Chiffres et statistiques : JetBrains Mono.
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Titres des boosters : Syne, très large et douce. Repli Arial Black.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["800"],
});

// Textes techniques des boosters : Space Mono. Repli monospace.
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${jetbrains.variable} ${syne.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <HalloweenOverlay
          force={process.env.NEXT_PUBLIC_HALLOWEEN_FORCE === "1"}
          zIndex={35}
        />
        <XmasOverlay force={process.env.NEXT_PUBLIC_XMAS_FORCE === "1"} zIndex={45} />
      </body>
    </html>
  );
}
