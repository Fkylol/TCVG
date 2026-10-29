import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // N'annonce pas la version du framework dans les réponses.
  poweredByHeader: false,
  /**
   * En-têtes de sécurité communs à toutes les réponses.
   *
   * Aucun n'était envoyé : le site pouvait être affiché dans une iframe
   * (clickjacking), le navigateur devinait le type des fichiers servis, et rien
   * n'imposait HTTPS. `Content-Security-Policy` reste à part : elle dépend des
   * images distantes et de Supabase, et doit être vérifiée dans un navigateur
   * avant d'être activée.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
  /**
   * `pg` (connexion de maintenance de l'atelier) charge `pg-cloudflare` par un
   * `require` conditionnel. La traduction de Next ne copie que la variante
   * Node de ce paquet : l'import de travail n'a alors plus de fichier, et la
   * construction Cloudflare échoue sur « Could not resolve pg-cloudflare ».
   * On force donc la copie des deux variantes avec les pages de l'atelier.
   */
  outputFileTracingIncludes: {
    "/atelier/**": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },
  // Le cache HTTP d'images est uniquement destiné aux outils locaux. L'inclure
  // dans les traces de l'atelier ferait analyser et copier des milliers de
  // fichiers sans utilité dans le Worker de production.
  outputFileTracingExcludes: {
    "/atelier/**": ["./.images/cache/**"],
  },
  images: {
    // Les visuels sont hotlinkés depuis Wikipédia : aucune copie n'est stockée ni servie
    // par l'optimiseur d'images de Next (voir `unoptimized` dans CardFace).
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "thumb.wikimedia.org" },
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
