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
  /** Marge du haut, quand la zone doit en garder plus que les trois autres. */
  torchPaddingTop?: number;
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
      // 20 px sur les côtés et en bas : le cadre n'inclut pas les transformations
      // des enfants, et le poster ne descend jamais plus bas que sa place.
      torchPadding: 20,
      // 36 px en haut : le poster flotte (8 px de battement), reste soulevé de
      // 8 px, grossit de 4 % (8 px) et tourne de 1,4° — soit une trentaine de
      // pixels au-dessus de la grille. La scène est descendue d'autant
      // (`mt-14`) pour que le cadre garde la même distance au bandeau d'en haut.
      torchPaddingTop: 36,
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
