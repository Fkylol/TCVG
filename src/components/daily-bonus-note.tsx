"use client";

import { useState } from "react";
import type { DailyBonus } from "@/lib/data";

/**
 * Confirmation du bonus de connexion.
 *
 * `claimDailyBonus()` crédite 10 Pixels dès qu'un joueur connecté arrive sur
 * une page, sans rien afficher : le solde bougeait sans explication. Cette
 * barre n'existe que sur le rendu qui a réellement crédité le bonus (l'appel
 * suivant renvoie `claimed: false`), et se ferme d'un clic.
 */
export function DailyBonusNote({ bonus }: { bonus: DailyBonus | null }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !bonus?.claimed || bonus.amount <= 0) return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-center gap-2.5 border-l-2 border-acid/70 bg-acid/10 px-3 py-2 text-acid"
    >
      <span aria-hidden className="text-[10px]">
        ◆
      </span>
      <p className="text-sm">
        <span className="font-semibold">Bonus quotidien :</span>{" "}
        <span className="font-mono">+{bonus.amount}</span> Pixels crédités, à revenir chercher
        demain.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer le message du bonus quotidien"
        title="Masquer"
        className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full text-acid/60 transition hover:bg-acid/15 hover:text-acid"
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
