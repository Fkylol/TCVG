"use client";

import { useEffect } from "react";

import { isHalloweenActive } from "@/lib/halloween/config";

type OverlayOptions = {
  force?: boolean;
  witch?: boolean;
  boosterPumpkin?: boolean;
  boosterEndpoint?: string;
  zIndex?: number;
  /** Éclairage à la torche sur une zone (voir `public/events/halloween-overlay.js`). */
  torch?: boolean;
  torchTarget?: string;
  torchRadius?: number;
  torchDarkness?: number;
  /** Marge assombrie autour de la zone (px), voir `torchPadding` du script. */
  torchPadding?: number;
  torchFlicker?: boolean;
  [key: string]: unknown;
};

declare global {
  interface Window {
    HALLOWEEN_OVERLAY?: OverlayOptions;
    HalloweenOverlay?: {
      enable: () => void;
      disable: () => void;
      flicker: (index?: number) => void;
    };
  }
}

const SCRIPT_ID = "halloween-overlay-script";
const SCRIPT_SRC = "/events/halloween-overlay.js";

/**
 * Monte l'overlay Halloween autonome (`public/events/halloween-overlay.js`).
 *
 * La sorcière est désactivée (demande produit) ; le booster reste accessible
 * sur une citrouille. Le script est chargé une seule fois, uniquement pendant
 * la fenêtre saisonnière ou en mode `force`.
 */
export function HalloweenOverlay({
  force = false,
  zIndex = 35,
}: {
  /** Affiche l'overlay hors fenêtre saisonnière, pour les tests. */
  force?: boolean;
  /** Reste sous les modales du site (50 à 85). */
  zIndex?: number;
}) {
  useEffect(() => {
    if (!force && !isHalloweenActive(new Date())) return;
    if (document.getElementById(SCRIPT_ID)) return;

    window.HALLOWEEN_OVERLAY = {
      ...(window.HALLOWEEN_OVERLAY ?? {}),
      force,
      witch: false,
      boosterPumpkin: true,
      boosterEndpoint: "/api/halloween/booster",
      // Les boosters baignent dans le noir : la souris fait office de torche et
      // la pile flanche par instants. Uniquement au survol (pas de tactile).
      torch: true,
      torchTarget: "[data-hw-torch]",
      torchRadius: 190,
      torchDarkness: 0.9,
      // 20 px et non 12 : le pack sélectionné (et celui survolé) se soulève de
      // 8 px et grossit de 4 %, soit ~14 px au-dessus de la grille. Le cadre de
      // la zone assombrie ne inclut pas les transformations des enfants, donc
      // avec 12 px le haut du poster restait éclairé. On reste sous les 24 px
      // de marge qui séparent la grille du bandeau d'en haut.
      torchPadding: 20,
      torchFlicker: true,
      zIndex,
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.defer = true;
    document.body.appendChild(script);
  }, [force, zIndex]);

  return null;
}
