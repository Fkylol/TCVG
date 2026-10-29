"use client";

import { useEffect } from "react";

import { isHalloweenActive } from "@/lib/halloween/config";

type OverlayOptions = {
  force?: boolean;
  witch?: boolean;
  boosterPumpkin?: boolean;
  boosterEndpoint?: string;
  zIndex?: number;
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
      // Pas de voile sombre ni de torche : les boosters restent lisibles, la
      // pénombre d'Halloween se limite au décor du fond.
      torch: false,
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
