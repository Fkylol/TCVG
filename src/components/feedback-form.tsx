"use client";

import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "@/app/actions";

const initialState: FeedbackState = {};

export function FeedbackForm() {
  const [state, formAction, pending] = useActionState(sendFeedback, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <fieldset>
        <legend className="mb-2 text-xs uppercase tracking-[0.15em] text-white/45">
          C&apos;est à propos de…
        </legend>
        <div className="flex gap-2">
          <Choice value="avis" label="Un avis" defaultChecked />
          <Choice value="bug" label="Un bug" />
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-white/45">
          Page concernée <span className="normal-case tracking-normal text-white/25">(facultatif)</span>
        </span>
        <input
          name="page"
          type="text"
          maxLength={200}
          placeholder="/marché, /boosters, fiche de Kratos…"
          className="field py-2.5"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-white/45">
          Ton message
        </span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          placeholder="Décris ce qui s'est passé, ce que tu attendais, et à quel moment."
          className="field resize-y py-2.5 leading-relaxed"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {state.error}
        </p>
      )}

      {state.message && (
        <p
          role="status"
          className="border-l-2 border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}

function Choice({
  value,
  label,
  defaultChecked,
}: {
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="kind"
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
        required
      />
      <span className="tab border border-white/15 px-4 py-1.5 text-sm text-white/60 peer-checked:border-acid/60 peer-checked:bg-acid/10 peer-checked:text-acid peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acid">
        {label}
      </span>
    </label>
  );
}
