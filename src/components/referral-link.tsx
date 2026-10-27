"use client";

import { useState } from "react";

/** Lien d'invitation : copie en un clic et partage natif si disponible. */
export function ReferralLink({ code, url }: { code: string; url: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copié !");
    } catch {
      setMessage(url);
    }
    window.setTimeout(() => setMessage(null), 3000);
  }

  async function share() {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: "Rejoins-moi sur TCVG",
        text: `Je t'invite sur TCVG, le TCG des héros de jeux vidéo. Ouvre 20 boosters et on gagne 3 boosters bonus chacun.`,
        url,
      });
      setShared(true);
      window.setTimeout(() => setShared(false), 2500);
    } catch {
      // Partage annulé : rien à signaler.
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] text-white/70">
          {url}
        </code>
        <button type="button" onClick={copy} className="btn btn-primary btn-sm shrink-0">
          Copier
        </button>
        <button type="button" onClick={share} className="btn btn-outline btn-sm shrink-0">
          {shared ? "Partagé !" : "Partager"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/35">
        <span>
          Code : <span className="font-mono text-white/60">{code}</span>
        </span>
        <span aria-live="polite" className="text-cyan">
          {message}
        </span>
      </div>
    </div>
  );
}
