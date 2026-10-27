"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { recycleCard } from "@/app/actions";

/**
 * Recycle une copie de la carte. Le montant affiché vient de la base (via la
 * page) ; le serveur reste seul juge du crédit et de la règle « garder une
 * copie normale ».
 */
export function RecycleButton({
  cardId,
  holo = false,
  label,
  confirmMessage,
  className,
}: {
  cardId: string;
  holo?: boolean;
  label: string;
  confirmMessage?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  async function run() {
    if (busy) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setBusy(true);
    setNote(null);

    try {
      const result = await recycleCard(cardId, holo);

      if (result.status === "ok") {
        setNote({ tone: "ok", text: `+${result.amount} ◆` });
        router.refresh();
      } else if (result.status === "keep_one") {
        setNote({ tone: "warn", text: "Garde au moins un exemplaire." });
      } else if (result.status === "not_owned") {
        setNote({ tone: "warn", text: "Carte absente de la collection." });
      } else {
        setNote({ tone: "warn", text: result.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={
          className ?? "btn btn-sm btn-cyan"
        }
      >
        {busy ? "Recyclage…" : label}
      </button>
      {note && (
        <span
          role="status"
          className={`text-[11px] ${note.tone === "ok" ? "text-emerald-300" : "text-amber-300"}`}
        >
          {note.text}
        </span>
      )}
    </>
  );
}
