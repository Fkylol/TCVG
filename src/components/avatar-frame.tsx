"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PackEmblem } from "@/components/pack-art";
import { getFrame, shouldAnimateFrame } from "@/lib/frames.config";
import { MOTION_EVENT, isMotionForced } from "@/lib/motion";
import type { PackArtKey } from "@/lib/packs";

/** Compteur global : jamais plus de quelques cadres animés à l'écran. */
let animatedOnScreen = 0;

export type AvatarArt = {
  src: string;
  local?: boolean;
  framing?: CSSProperties;
};

export type AvatarFrameProps = {
  avatar?: AvatarArt | null;
  size?: number;
  frameId?: string | null;
  initial?: string;
  className?: string;
  title?: string;
  /** Force le rendu statique (page de démo, captures). */
  reducedMotion?: boolean;
  /** Aperçu désaturé d'un cadre verrouillé. */
  locked?: boolean;
};

function gradientFor(frame: ReturnType<typeof getFrame>, angle = "0deg"): string {
  if (!frame) return "linear-gradient(135deg, #f8fafc, #64748b)";
  const stops = [...frame.colors, frame.colors[0]].join(", ");
  return frame.gradient === "conic"
    ? `conic-gradient(from ${angle}, ${stops})`
    : `linear-gradient(135deg, ${stops})`;
}

/**
 * Avatar + cadre, rendu en CSS pur.
 *
 * Le dégradé du cadre est un anneau clippé ; l'avatar occupe le centre et n'est
 * jamais masqué. Les cadres animés font tourner une couche de dégradé en
 * `transform` uniquement, et seulement si elle est visible, si le joueur
 * n'a pas demandé moins de mouvement et si le budget global n'est pas atteint.
 */
export function AvatarFrame({
  avatar,
  size = 32,
  frameId,
  initial = "?",
  className = "",
  title,
  reducedMotion = false,
  locked = false,
}: AvatarFrameProps) {
  const frame = getFrame(frameId) ?? getFrame("steel")!;
  const px = Math.max(24, Math.round(size));
  const thickness = Math.max(2, Math.round(px * (0.035 + frame.prestige * 0.012)));
  const glow = frame.colors[frame.colors.length - 1];
  const ref = useRef<HTMLSpanElement>(null);
  const reserved = useRef(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Le mode « toujours » (par défaut) passe outre la demande du téléphone :
    // un cadre animé reste animé en économie d'énergie.
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(!isMotionForced() && media.matches);
    update();
    media.addEventListener?.("change", update);
    window.addEventListener(MOTION_EVENT, update);
    return () => {
      media.removeEventListener?.("change", update);
      window.removeEventListener(MOTION_EVENT, update);
    };
  }, []);

  useEffect(() => {
    if (!frame.animated) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting === true),
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [frame.animated]);

  useEffect(() => {
    const canAnimate = shouldAnimateFrame({
      animated: frame.animated === true,
      reducedMotion: reducedMotion || systemReduced,
      visible,
      activeAnimated: animatedOnScreen,
    });

    if (canAnimate && !reserved.current) {
      animatedOnScreen += 1;
      reserved.current = true;
      setAnimate(true);
    } else if (!canAnimate && reserved.current) {
      animatedOnScreen = Math.max(0, animatedOnScreen - 1);
      reserved.current = false;
      setAnimate(false);
    }

    return () => {
      if (reserved.current) {
        animatedOnScreen = Math.max(0, animatedOnScreen - 1);
        reserved.current = false;
      }
    };
  }, [frame.animated, reducedMotion, systemReduced, visible]);

  const gradient = gradientFor(frame);
  const spin = animate && frame.animated === true;
  const doubleRing = frame.prestige >= 4;

  return (
    <span
      ref={ref}
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${locked ? "grayscale opacity-45" : ""} ${className}`}
      style={{
        width: px,
        height: px,
        boxShadow: locked
          ? "none"
          : `0 0 ${Math.round(px * 0.22)}px ${glow}66, 0 0 ${Math.round(px * 0.5)}px ${glow}22`,
      }}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      <span
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{ background: gradient }}
      >
        {spin && (
          <span
            className="frame-spin-layer"
            style={{
              background: gradientFor(frame, "0deg"),
              animationDuration: `${18 + frame.prestige * 2}s`,
            }}
          />
        )}
      </span>

      <span
        aria-hidden
        className="absolute overflow-hidden rounded-full bg-ink"
        style={{ inset: thickness }}
      >
        {avatar ? (
          <Image
            src={avatar.src}
            alt=""
            width={px}
            height={px}
            unoptimized={avatar.local !== true}
            loading="lazy"
            style={avatar.framing}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="grid h-full w-full place-items-center bg-cyan/90 font-display font-bold text-ink"
            style={{ fontSize: Math.max(9, Math.round(px * 0.34)) }}
          >
            {initial.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
        {/* Reflet fixe, jamais animé. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.34), transparent 40%, transparent 72%, rgba(255,255,255,0.12))",
          }}
        />
      </span>

      {doubleRing && (
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full border"
          style={{
            inset: Math.max(1, Math.round(thickness * 0.55)),
            borderColor: `${frame.colors[1] ?? glow}aa`,
          }}
        />
      )}

      {frame.motif && (
        <span
          aria-hidden
          className="absolute grid place-items-center rounded-full bg-ink/95 text-white/85 ring-1 ring-white/20"
          style={{
            width: Math.max(8, Math.round(px * 0.3)),
            height: Math.max(8, Math.round(px * 0.3)),
            right: -1,
            bottom: -1,
            padding: Math.max(1, Math.round(px * 0.045)),
          }}
        >
          <svg viewBox="0 0 48 48" fill="currentColor" className="h-full w-full">
            <PackEmblem name={frame.motif as PackArtKey} />
          </svg>
        </span>
      )}
    </span>
  );
}
