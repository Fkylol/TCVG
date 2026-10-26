"use client";

import { useState } from "react";
import { setWishlistAlert } from "@/app/actions";

/**
 * Seuil d'alerte d'une envie : « préviens-moi sous ◆ X ».
 * Vide = toutes les annonces alertent. Le seuil est enregistré en base, la
 * vignette se met à jour sans recharger la page.
 */
export function WishlistAlert({
  cardId,
  cardName,
  maxPrice,
}: {
  cardId: string;
  cardName: string;
  maxPrice: number | null;
}) {
  const [value, setValue] = useState(maxPrice === null ? "" : String(maxPrice));
  const [saved, setSaved] = useState<number | null>(maxPrice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: number | null) {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await setWishlistAlert(cardId, next);

    if (result.status === "ok") {
      setSaved(result.maxPrice);
      setValue(result.maxPrice === null ? "" : String(result.maxPrice));
    } else {
      setError(result.message);
    }

    setBusy(false);
  }

  return (
    <div className="mt-1.5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number.parseInt(value, 10);
          void save(Number.isInteger(parsed) && parsed > 0 ? parsed : null);
        }}
        className="flex items-center gap-1"
      >
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="sous ◆"
          aria-label={`Seuil d'alerte pour ${cardName}`}
          className="field w-full px-2 py-1 text-[10px]"
        />
        <button
          type="submit"
          disabled={busy}
          className="btn btn-outline btn-sm px-2 py-1 text-[10px]"
        >
          {busy ? "…" : "OK"}
        </button>
      </form>

      <p className="mt-0.5 text-[10px] leading-tight text-white/35">
        {saved === null ? (
          "Alerté à chaque annonce"
        ) : (
          <>
            Alerté sous{" "}
            <span className="font-mono text-acid">◆ {saved}</span>{" "}
            <button
              type="button"
              onClick={() => void save(null)}
              disabled={busy}
              className="underline decoration-white/20 underline-offset-2 transition hover:text-white/70"
            >
              retirer
            </button>
          </>
        )}
      </p>

      {error && (
        <p role="status" className="mt-0.5 text-[10px] leading-tight text-amber-200/80">
          {error}
        </p>
      )}
    </div>
  );
}
