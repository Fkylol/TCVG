"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Inclinaison maximale par défaut, en degrés, sur chaque axe.
 *
 * La carte seule (visionneuse plein écran) peut demander plus : voir
 * `useCardTilt(25)` dans `card-flip.tsx`. Au-delà de 30°, le texte des bords
 * devient pénible à lire.
 */
export const MAX_TILT = 15;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/**
 * Marge au-delà de laquelle le cadre de la carte est remesuré. Une carte inclinée
 * a une boîte englobante plus large que la carte au repos : la mesurer à chaque
 * frame ferait osciller l'inclinaison. On garde donc la mesure du survol, sauf
 * si le pointeur s'éloigne franchement (défilement, redimensionnement).
 */
const STALE_MARGIN = 80;

type TiltPoint = { rx: number; ry: number; tx: number; ty: number };

function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}

/**
 * Inclinaison 3D d'une carte au survol, écrite en variables CSS.
 *
 * L'inclinaison va dans `--rx`, `--ry` (degrés) et le décalage au centre
 * dans `--tx`, `--ty` (-1 → 1) : aucun rendu React n'est déclenché, chaque
 * mouvement est appliqué une seule fois par frame. Le CSS lit ces variables
 * pour le tilt, le reflet et le foil.
 *
 * `--intensity` (0 → 1) allume le foil et le reflet au survol et les éteint
 * doucement au départ ; `--tx`/`--ty` (-1 → 1) servent à la parallaxe des
 * paillettes.
 *
 * Les gestionnaires se branchent directement sur la carte (`currentTarget`),
 * donc aucun ref n'est nécessaire côté rendu. Au doigt, l'effet suit le
 * contact entre `pointerdown` et `pointerup` ; avec `prefers-reduced-motion`,
 * l'inclinaison est annulée mais le reflet continue de suivre le pointeur.
 *
 * `maxTilt` se règle à l'appel : 15° par défaut (vignettes, fiches), 25° pour
 * la carte ouverte dans la visionneuse.
 */
export function useCardTilt<T extends HTMLElement>(maxTilt: number = MAX_TILT) {
  const frame = useRef<number | null>(null);
  const element = useRef<T | null>(null);
  const point = useRef<TiltPoint | null>(null);
  /** Boîte de la carte mesurée au repos, avant toute inclinaison. */
  const bounds = useRef<DOMRect | null>(null);
  /** Un doigt est posé sur la carte (le survol souris n'est pas concerné). */
  const pressed = useRef(false);

  const flush = useCallback(() => {
    frame.current = null;
    const node = element.current;
    const next = point.current;
    if (!node || !next) return;

    node.style.setProperty("--rx", `${next.rx.toFixed(2)}deg`);
    node.style.setProperty("--ry", `${next.ry.toFixed(2)}deg`);
    node.style.setProperty("--tx", next.tx.toFixed(3));
    node.style.setProperty("--ty", next.ty.toFixed(3));
  }, []);

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(flush);
  }, [flush]);

  /** Mesure la carte à plat : au survol, au toucher, ou si la boîte a bougé. */
  const measure = useCallback((node: T) => {
    bounds.current = node.getBoundingClientRect();
  }, []);

  const track = useCallback(
    (event: ReactPointerEvent<T>) => {
      const node = event.currentTarget;
      const cached = bounds.current;
      const stale =
        !cached ||
        event.clientX < cached.left - STALE_MARGIN ||
        event.clientX > cached.right + STALE_MARGIN ||
        event.clientY < cached.top - STALE_MARGIN ||
        event.clientY > cached.bottom + STALE_MARGIN;
      if (stale) measure(node);

      const rect = bounds.current;
      if (!rect || rect.width === 0 || rect.height === 0) return;

      element.current = node;

      // Position relative à la carte, bornée à ses bords.
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      const tilt = prefersReducedMotion() ? 0 : 1;

      point.current = {
        // La souris en haut incline le haut de la carte vers l'arrière.
        rx: (0.5 - y) * 2 * maxTilt * tilt,
        ry: (x - 0.5) * 2 * maxTilt * tilt,
        tx: x * 2 - 1,
        ty: y * 2 - 1,
      };
      node.dataset.tilt = "true";
      node.style.setProperty("--intensity", "1");
      schedule();
    },
    [maxTilt, measure, schedule],
  );

  const rest = useCallback(() => {
    const node = element.current;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    point.current = null;
    // La prochaine carte survolée sera mesurée à plat, avant inclinaison.
    bounds.current = null;
    if (!node) return;
    delete node.dataset.tilt;
    node.style.setProperty("--intensity", "0");
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--ry", "0deg");
    node.style.setProperty("--tx", "0");
    node.style.setProperty("--ty", "0");
  }, []);

  const handlers = {
    onPointerEnter(event: ReactPointerEvent<T>) {
      if (event.pointerType === "touch") return;
      // Mesure au repos : l'inclinaison ne doit pas déformer sa propre référence.
      measure(event.currentTarget);
      track(event);
    },
    onPointerMove(event: ReactPointerEvent<T>) {
      if (event.pointerType === "touch" && !pressed.current) return;
      track(event);
    },
    onPointerDown(event: ReactPointerEvent<T>) {
      pressed.current = true;
      measure(event.currentTarget);
      track(event);
    },
    onPointerUp(event: ReactPointerEvent<T>) {
      if (!pressed.current) return;
      pressed.current = false;
      if (event.pointerType === "touch") rest();
    },
    onPointerCancel() {
      pressed.current = false;
      rest();
    },
    onPointerLeave() {
      if (pressed.current) return;
      rest();
    },
  };

  useEffect(() => {
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        // Sans cette remise à zéro, un remontage (StrictMode en dev) laisse
        // l'identifiant annulé en place et `schedule()` ne planifie plus rien :
        // l'intensité s'allume mais l'inclinaison ne bouge jamais.
        frame.current = null;
      }
    };
  }, []);

  return handlers;
}
