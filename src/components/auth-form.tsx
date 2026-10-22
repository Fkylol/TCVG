"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type FormState } from "@/app/actions";

const initialState: FormState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-4">
      {isSignup && (
        <Field label="Pseudo" name="username" type="text" autoComplete="nickname" placeholder="SpartanDu93" />
      )}
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="toi@exemple.com" />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        placeholder="8 caractères minimum"
      />

      {state.error && (
        <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      )}

      {state.message && (
        <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-violet-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/60"
      >
        {pending ? "Un instant…" : isSignup ? "Créer mon compte" : "Se connecter"}
      </button>

      <p className="pt-1 text-center text-sm text-white/50">
        {isSignup ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-violet-200 underline-offset-4 hover:underline"
        >
          {isSignup ? "Se connecter" : "S'inscrire"}
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-white/45">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-violet-400/70"
      />
    </label>
  );
}
