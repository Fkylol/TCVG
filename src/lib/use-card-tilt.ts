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
 * Tolérance autour de la place de la carte, en pixels, avant de conclure que
 * le pointeur l'a quittée.
 *
 * Une carte inclinée projette ses bords un peu au-delà (elle grossit de 4 %)
 * ou en deçà de sa place au repos : sans cette marge, le pointeur posé sur un
 * bord sortait et rentrait tour à tour, et la carte sautait.
 */
const EDGE_SLACK = 8;

type TiltPoint = { rx: number; ry: number; tx: number; ty: number };
type Pointer = { clientX: number; clientY: number; pointerType: string };

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
 * Le survol est jugé sur la place de la carte au repos, pas sur sa forme
 * inclinée : dès que la carte bouge, ses bords ne sont plus là où le pointeur
 * les a rencontrés. Pendant le survol, le pointeur est donc suivi sur le
 * document — sans quoi il suffisait d'atteindre un coin pour que la carte
 * sorte sous le curseur, revienne à plat, soit survolée de nouveau, et saute.
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
  /** Écoute du pointeur sur le document, installée pendant le survol. */
  const unwatch = useRef<(() => void) | null>(null);

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

  /**
   * Mesure la carte à plat.
   *
   * `getBoundingClientRect()` renvoie la boîte *transformée* : mesurée pendant
   * l'inclinaison, elle donnerait une référence faussée, et l'inclinaison
   * sauterait au mouvement suivant. La transformation est donc retirée le
   * temps de la mesure — rien n'est peint entre les deux instructions.
   */
  const measure = useCallback((node: T) => {
    const saved = node.style.transform;
    node.style.transform = "none";
    const rect = node.getBoundingClientRect();
    node.style.transform = saved;
    bounds.current = rect;
  }, []);

  /** Vrai quand le pointeur est encore sur la place de la carte. */
  const inside = useCallback((clientX: number, clientY: number) => {
    const rect = bounds.current;
    if (!rect) return false;
    return (
      clientX >= rect.left - EDGE_SLACK &&
      clientX <= rect.right + EDGE_SLACK &&
      clientY >= rect.top - EDGE_SLACK &&
      clientY <= rect.bottom + EDGE_SLACK
    );
  }, []);

  const rest = useCallback(() => {
    if (unwatch.current) unwatch.current();
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

  /**
   * Applique l'inclinaison pour une position du pointeur, ou remet la carte à
   * plat si le pointeur a quitté sa place.
   */
  const track = useCallback(
    (pointer: Pointer) => {
      const node = element.current;
      if (!node) return;

      // Un mouvement peut arriver sans entrée mesurée (carte remontée sous un
      // pointeur immobile, doigt relevé puis reposé) : on remesure une fois.
      if (!bounds.current) measure(node);

      if (!inside(pointer.clientX, pointer.clientY)) {
        rest();
        return;
      }

      const rect = bounds.current;
      if (!rect || rect.width === 0 || rect.height === 0) return;

      // Position relative à la carte, bornée à ses bords.
      const x = Math.min(1, Math.max(0, (pointer.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (pointer.clientY - rect.top) / rect.height));
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
    [inside, maxTilt, measure, rest, schedule],
  );

  /**
   * Suit le pointeur sur le document tant que la carte est inclinée : près des
   * bords, la forme inclinée s'écarte du curseur et ne reçoit plus les
   * déplacements — les événements de la carte seule s'arrêteraient là.
   */
  const watch = useCallback(() => {
    if (unwatch.current) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" && !pressed.current) return;
      track(event);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    unwatch.current = () => {
      document.removeEventListener("pointermove", onMove);
      unwatch.current = null;
    };
  }, [track]);

  /** Début du survol (ou du contact) : on mesure, puis on suit. */
  const activate = useCallback(
    (node: T, pointer: Pointer) => {
      element.current = node;
      measure(node);
      watch();
      track(pointer);
    },
    [measure, track, watch],
  );

  const handlers = {
    onPointerEnter(event: ReactPointerEvent<T>) {
      if (event.pointerType === "touch") return;
      activate(event.currentTarget, event);
    },
    onPointerMove(event: ReactPointerEvent<T>) {
      if (event.pointerType === "touch" && !pressed.current) return;
      element.current = event.currentTarget;
      track(event);
    },
    onPointerDown(event: ReactPointerEvent<T>) {
      pressed.current = true;
      activate(event.currentTarget, event);
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
    onPointerLeave(event: ReactPointerEvent<T>) {
      if (pressed.current) return;
      // Un `leave` ne suffit pas : la carte inclinée peut s'être écartée du
      // pointeur alors que celui-ci est toujours sur sa place. On ne remet à
      // plat que s'il en est vraiment sorti — c'est ce qui évitait la carte de
      // sauter entre deux états sur les bords.
      if (inside(event.clientX, event.clientY)) return;
      rest();
    },
  };

  useEffect(() => {
    return () => {
      if (unwatch.current) unwatch.current();
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
