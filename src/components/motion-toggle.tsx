"use client";

import { useEffect, useState } from "react";

import {
  MOTION_EVENT,
  MOTION_DEFAULT,
  readMotionPreference,
  setMotionPreference,
  type MotionPreference,
} from "@/lib/motion";

const CHOICES: { value: MotionPreference; label: string; hint: string }[] = [
  {
    value: "full",
    label: "Toujours",
    hint: "Déchirure des boosters, auras, cadres : tout tourne, même en économie d'énergie.",
  },
  {
    value: "auto",
    label: "Suivre le système",
    hint: "Les animations sont réduites si l'appareil le demande (économie d'énergie, accessibilité).",
  },
];

/**
 * Réglage des animations, dans le profil.
 *
 * L'état est lu après le montage (le serveur ne connaît pas le choix du
 * navigateur) : le premier rendu montre le mode par défaut, puis se cale sur
 * `localStorage`. Le changement s'applique tout de suite, sans rechargement.
 */
export function MotionToggle() {
  const [preference, setPreference] = useState<MotionPreference>(MOTION_DEFAULT);

  useEffect(() => {
    const sync = () => setPreference(readMotionPreference());
    sync();
    window.addEventListener(MOTION_EVENT, sync);
    return () => window.removeEventListener(MOTION_EVENT, sync);
  }, []);

  return (
    <section className="panel mt-5 p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Animations</p>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-white/55">
        Les effets du jeu passent souvent pour des bugs quand un téléphone est en économie
        d&apos;énergie : le navigateur demande alors au site de réduire ses animations.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Animations du jeu">
        {CHOICES.map((choice) => {
          const active = preference === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              onClick={() => {
                setPreference(choice.value);
                setMotionPreference(choice.value);
              }}
              aria-pressed={active}
              title={choice.hint}
              className={`btn px-3 text-[11px] ${active ? "btn-primary" : "btn-outline"}`}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/35">
        {CHOICES.find((choice) => choice.value === preference)?.hint}
      </p>
    </section>
  );
}
