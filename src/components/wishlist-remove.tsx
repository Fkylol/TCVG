"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toggleWishlist } from "@/app/actions";

/** Bouton de retrait d'une envie, avec mise à jour optimiste de la vignette. */
export function WishlistRemove({
  cardId,
  cardName,
}: {
  cardId: string;
  cardName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await toggleWishlist(cardId);

    if (result.status === "ok" && !result.wished) {
      setHidden(true);
      router.refresh();
    } else if (result.status === "error") {
      setError(result.message);
    }

    setBusy(false);
  }

  if (hidden) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="btn btn-outline btn-sm w-full px-2 py-1 text-[10px]"
        aria-label={`Retirer ${cardName} de mes envies`}
      >
        {busy ? "Retrait…" : "Retirer"}
      </button>
      {error && (
        <p role="status" className="mt-1 text-[10px] leading-tight text-amber-200/80">
          {error}
        </p>
      )}
    </div>
  );
}
