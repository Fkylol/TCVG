import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
