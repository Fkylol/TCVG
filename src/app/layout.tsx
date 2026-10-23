import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Titres : Archivo en 800/900, très serré (voir `.display` dans globals.css).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
