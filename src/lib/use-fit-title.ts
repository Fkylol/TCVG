"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** En dessous de cette taille, le sous-titre est abrégé plutôt que réduit. */
export const SUBTITLE_MIN_PX = 11;

/**
 * Ajuste la taille du titre et du sous-titre d'un booster pour qu'ils ne
 * touchent jamais les bords.
 *
 * Chaque ligne garde sa taille cible (en `cqw`) tant qu'elle tient dans
 * `maxRatio` de la largeur du pack. Au-delà, la police est réduite
 * proportionnellement : la ligne la plus large atteint exactement ce ratio.
 * Le sous-titre ne descend pas sous `SUBTITLE_MIN_PX` ; s'il déborde encore à
 * cette taille, le CSS l'abrège avec des points de suspension.
 *
 * La mesure se fait sur la mise en page (`offsetWidth` / `scrollWidth`), jamais
 * sur la largeur transformée : l'inclinaison 3D et le `scale` du survol ne
 * déclenchent donc aucune re-mesure. Syne arrive après le premier rendu : le
 * hook remesure dès que `document.fonts.ready` est résolu, puis à chaque
 * changement de largeur.
 */
export function useFitTitle(maxRatio = 0.8) {
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const subtitleRef = useRef<HTMLSpanElement | null>(null);

  const fit = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const packWidth = frame.offsetWidth;
    if (!packWidth) return;

    const target = packWidth * maxRatio;

    // Repart de la taille de base avant de mesurer, sinon chaque passage
    // réduirait un peu plus la police.
    const fitLine = (line: HTMLElement | null, minSize: number) => {
      if (!line) return;

      line.style.fontSize = "";
      const base = Number.parseFloat(getComputedStyle(line).fontSize);
      if (!Number.isFinite(base) || base <= 0) return;

      // Le titre est en `width: max-content` : sa largeur de mise en page est
      // sa largeur naturelle. Le sous-titre est plafonné par le pack, donc
      // `scrollWidth` donne le texte non rogné. Le maximum couvre les deux.
      const natural = Math.max(line.offsetWidth, line.scrollWidth);
      if (!natural) return;

      const scale = Math.min(1, target / natural);
      const size = Math.max(minSize, Math.round(base * scale * 100) / 100);
      line.style.fontSize = `${size}px`;
    };

    fitLine(titleRef.current, 0);
    fitLine(subtitleRef.current, SUBTITLE_MIN_PX);
  }, [maxRatio]);

  useLayoutEffect(() => {
    fit();

    const frame = frameRef.current;
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => fit()) : null;
    if (frame) observer?.observe(frame);

    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) fit();
      })
      .catch(() => {
        // Polices indisponibles : la taille de repli reste en place.
      });

    // Une police chargée après `fonts.ready` (graisse manquante, cache froid)
    // change encore les largeurs : on remesure sur chaque chargement terminé.
    const onFontsLoaded = () => fit();
    document.fonts?.addEventListener?.("loadingdone", onFontsLoaded);

    window.addEventListener("resize", fit);

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", onFontsLoaded);
      window.removeEventListener("resize", fit);
    };
  }, [fit]);

  return { frameRef, titleRef, subtitleRef };
}
