"use client";

import { useEffect } from "react";

import { RevealHost } from "@/components/reveal-host";
import { setPendingReveal } from "@/lib/reveal-queue";

/** Banc d'essai temporaire : la révélation d'un tirage sans carte connue. */
export default function RevealVide() {
  useEffect(() => {
    setPendingReveal({ items: [], packId: "halloween", opened: 1 });
  }, []);

  return (
    <div className="p-10 text-white/60">
      <p>Page de contrôle : la révélation vide doit afficher un message, pas une scène noire.</p>
      <RevealHost />
    </div>
  );
}
