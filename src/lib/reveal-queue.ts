"use client";

import { useSyncExternalStore } from "react";
import type { RevealItem } from "@/components/booster-reveal";

export type RevealPayload = {
  items: RevealItem[];
  /** Pack ouvert, pour redessiner la même déchirure si la révélation reprend. */
  packId: string;
  /** Nombre de boosters réellement ouverts (le stock peut avoir borné le lot). */
  opened: number;
};

/**
 * Révélation en cours, gardée hors de l'arbre React.
 *
 * Une ouverture consomme le booster côté serveur ; l'animation ne fait que
 * révéler. Si un rendu serveur s'intercale pendant l'ouverture (rafraîchissement
 * de session, révalidation), le composant est remonté et son état local
 * disparaîtrait : le joueur retomberait sur la liste, booster consommé et cartes
 * jamais vues. Ce relais survit au remontage, et l'abonnement fait réapparaître
 * la révélation même si le tirage répond après le remontage.
 */
let pending: RevealPayload | null = null;
const listeners = new Set<() => void>();

/** Enregistre (ou efface) la révélation en attente. */
export function setPendingReveal(next: RevealPayload | null) {
  pending = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Révélation en attente, ou null. Aucune valeur au rendu serveur. */
export function usePendingReveal(): RevealPayload | null {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
}
