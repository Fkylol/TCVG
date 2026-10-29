"use client";

import { useEffect } from "react";

import type { RevealItem } from "@/components/booster-reveal";
import { RevealHost } from "@/components/reveal-host";
import { getCard } from "@/lib/cards";
import { setPendingReveal } from "@/lib/reveal-queue";

/** Banc d'essai temporaire : la révélation des 5 cartes spectrales d'Halloween. */
export default function RevealHalloween() {
  useEffect(() => {
    const ids = [
      "luigi-halloween",
      "pikachu-halloween",
      "bowser-halloween",
      "nemesis-halloween",
      "kirby-halloween",
    ];
    const items: RevealItem[] = ids.flatMap((id, index) => {
      const card = getCard(id);
      return card
        ? [
            {
              card,
              holo: index === 4,
              isNew: true,
              quantity: 1,
              variant: "normal",
            },
          ]
        : [];
    });
    setPendingReveal({ items, packId: "halloween", opened: 1 });

    // Le flux complet de révélation s'exécute sur cette route de développement.
    if (process.env.NODE_ENV !== "development" || items.length !== 5) return;
    const revealTimer = window.setInterval(() => {
      const phase = document.querySelector(".reveal-stage")?.getAttribute("data-phase");
      if (phase === "pack") {
        const tearButton = Array.from(document.querySelectorAll("button")).find((element) =>
          /Déchirer le booster/.test(element.textContent ?? ""),
        );
        tearButton?.click();
      } else if (phase === "fan") {
        const flipButton = Array.from(document.querySelectorAll("button")).find((element) =>
          /Retourner la carte/.test(element.textContent ?? ""),
        );
        flipButton?.click();
      } else if (phase === "done") {
        window.clearInterval(revealTimer);
      }
    }, 500);
    return () => window.clearInterval(revealTimer);
  }, []);

  return (
    <div className="p-10 text-white/60">
      <p>Page de contrôle : cinq cartes saisonnières dans la révélation du pack d&apos;Halloween.</p>
      <RevealHost />
    </div>
  );
}
