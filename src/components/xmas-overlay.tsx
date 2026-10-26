"use client";

import { useEffect } from "react";

import { isXmasActive } from "@/lib/xmas/config";

declare global {
  interface Window {
    XMAS_OVERLAY?: {
      force?: boolean;
      zIndex?: number;
    };
  }
}

const SCRIPT_ID = "xmas-overlay-script";
const SCRIPT_SRC = "/events/xmas-overlay.js";

/**
 * Monte l'overlay de Noël autonome (`public/events/xmas-overlay.js`).
 *
 * Le script est chargé une seule fois, uniquement pendant la fenêtre
 * saisonnière ou en mode `force`.
 */
export function XmasOverlay({
  force = false,
  zIndex = 45,
}: {
  /** Affiche l'overlay hors fenêtre saisonnière, pour les tests. */
  force?: boolean;
  /** Passe au-dessus de l'en-tête (40) mais reste sous les modales (50 à 85). */
  zIndex?: number;
}) {
  useEffect(() => {
    if (!force && !isXmasActive(new Date())) return;
    if (document.getElementById(SCRIPT_ID)) return;

    window.XMAS_OVERLAY = {
      ...(window.XMAS_OVERLAY ?? {}),
      force,
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
