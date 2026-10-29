"use client";

import { useEffect, useRef } from "react";

import { openPack } from "@/app/actions";
import type { RevealItem } from "@/components/booster-reveal";
import { getCard } from "@/lib/cards";
import { HALLOWEEN_BOOSTER_EVENT } from "@/lib/halloween/config";
import { setPendingReveal } from "@/lib/reveal-queue";

/**
 * La citrouille de l'overlay ouvre son booster tout de suite.
 *
 * Le script d'ambiance (`public/events/halloween-overlay.js`) est autonome : la
 * réclamation part de lui, et il annonce le booster accordé par un événement
 * `halloween:booster`. On tire alors le pack saisonnier et on confie la
 * révélation à l'hôte unique (`components/reveal-host.tsx`), monté à la racine :
 * l'écran d'ouverture s'affiche donc sans quitter la page où le joueur se
 * trouve.
 *
 * Le tirage peut être refusé — pack hors saison, ou cartes exclusives pas encore
 * publiées — et il ne se passe rien de plus : l'overlay a déjà annoncé le bonus,
 * qui reste en réserve dans le stock.
 */
export function HalloweenOpening() {
  // Verrou synchrone : la citrouille peut émettre l'événement deux fois de
  // suite (double clic), un seul tirage doit partir.
  const busy = useRef(false);

  useEffect(() => {
    async function onBooster(event: Event) {
      const detail = (event as CustomEvent<{ ok?: boolean }>).detail;
      if (detail?.ok === false) return;
      if (busy.current) return;
      busy.current = true;

      try {
        const result = await openPack("halloween");
        if (result.status !== "ok") return;

        // Le serveur a déjà écrit les cartes : l'animation ne fait que révéler.
        const items: RevealItem[] = result.cards.flatMap((entry) => {
          const card = getCard(entry.id);
          return card
            ? [
                {
                  card,
                  holo: entry.holo,
                  isNew: entry.isNew,
                  quantity: entry.quantity,
                  variant: entry.variant,
                  guaranteed: entry.guaranteed,
                  guaranteeType: entry.guaranteeType,
                  boosterSpecial: entry.boosterSpecial,
                },
              ]
            : [];
        });
        // La citrouille ouvre un seul booster, comme l'accueil.
        setPendingReveal({ items, packId: "halloween", opened: 1 });
      } finally {
        busy.current = false;
      }
    }

    window.addEventListener(HALLOWEEN_BOOSTER_EVENT, onBooster);
    return () => window.removeEventListener(HALLOWEEN_BOOSTER_EVENT, onBooster);
  }, []);

  return null;
}
