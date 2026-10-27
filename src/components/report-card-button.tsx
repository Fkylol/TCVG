"use client";

import { useState } from "react";

import { reportCard } from "@/app/actions/reports";
import { REPORT_MAX, REPORT_TOPICS, type ReportTopic } from "@/lib/card-reports";
import type { Card } from "@/lib/cards";

/**
 * Signale une carte depuis la collection.
 *
 * Le panneau s'ouvre sous la carte : un motif, une phrase, et c'est envoyé à
 * l'atelier (`/atelier/signalements`), où la carte sera rouverte pour
 * vérification. Le texte n'est lisible que par l'administration.
 */
export function ReportCardButton({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<ReportTopic>("visuel");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function send() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await reportCard(card.id, topic, message);
      if (result.status === "error") {
        setNote({ tone: "bad", text: result.message });
        return;
      }
      setMessage("");
      setOpen(false);
      setNote({ tone: "ok", text: "Signalement envoyé, merci." });
    } catch {
      setNote({ tone: "bad", text: "L'envoi a échoué. Réessaie dans un instant." });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setNote(null);
          }}
          className="text-[10px] text-white/30 underline-offset-2 transition hover:text-white/70 hover:underline"
        >
          Signaler
        </button>
        {note && (
          <p
            role="status"
            className={`mt-1 text-[10px] ${note.tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}
          >
            {note.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 border border-white/15 bg-ink-soft p-2 text-left">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Ce qui cloche</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {REPORT_TOPICS.map((entry) => {
          const on = entry.slug === topic;
          return (
            <button
              key={entry.slug}
              type="button"
              onClick={() => setTopic(entry.slug)}
              aria-pressed={on}
              title={entry.hint}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                on ? "border-cyan bg-cyan/15 text-cyan" : "border-white/15 text-white/50"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={3}
        maxLength={REPORT_MAX}
        placeholder="Décris le problème en une phrase…"
        className="mt-1.5 block w-full rounded border border-white/15 bg-ink px-1.5 py-1 text-[11px] text-white placeholder:text-white/25"
      />
      {note && note.tone === "bad" && (
        <p role="alert" className="mt-1 text-[10px] text-rose-300">
          {note.text}
        </p>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || message.trim().length < 5}
          className="btn btn-sm btn-primary flex-1 text-[10px]"
        >
          {busy ? "Envoi…" : "Envoyer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNote(null);
          }}
          className="btn btn-sm btn-outline text-[10px]"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
