"use client";

import Link from "next/link";
import { useState } from "react";

import type { RarityUpdate } from "@/lib/data";

/**
 * Bandeau d'annonce, affiché sept jours après une mise à jour des raretés.
 *
 * Le calcul vient d'un script de maintenance, jamais d'une requête de joueur :
 * ce composant ne fait qu'afficher une date déjà décidée côté serveur. Il
 * disparaît seul au bout de la fenêtre, et se ferme d'un clic.
 */
export function RarityUpdateBanner({ update }: { update: RarityUpdate | null }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !update) return null;

  const date = new Date(update.appliedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-cyan/70 bg-cyan/10 px-3 py-2 text-cyan"
    >
      <p className="text-sm">
        <span className="font-semibold">Les raretés ont été mises à jour</span> d&apos;après la
        popularité des personnages, le {date}.
        {update.changed > 0 && (
          <span className="text-cyan/70"> {update.changed} cartes changent de palier.</span>
        )}
      </p>
      <Link
        href={update.href}
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan/80 underline-offset-4 transition hover:text-cyan hover:underline"
      >
        Comment c&apos;est calculé
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer l'annonce des raretés"
        title="Masquer"
        className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full text-cyan/60 transition hover:bg-cyan/15 hover:text-cyan"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-3.5 w-3.5"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
