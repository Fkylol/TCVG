"use client";

import Image from "next/image";
import { useActionState } from "react";
import { saveProfileStyle, type StyleState } from "@/app/actions";
import { FRAMES, FRAME_ORDER, type FrameKey, frameOf } from "@/lib/profile";

export type AvatarChoice = {
  id: string;
  name: string;
  number: number;
  universe: string;
  url: string | null;
};

const initialState: StyleState = {};

export function ProfileEditor({
  username,
  avatarCardId,
  frame,
  choices,
  unlocked,
}: {
  username: string;
  avatarCardId: string | null;
  frame: string;
  choices: AvatarChoice[];
  unlocked: FrameKey[];
}) {
  const [state, formAction, pending] = useActionState(saveProfileStyle, initialState);
  const currentFrame = frameOf(frame);

  return (
    <form action={formAction} className="mt-8 space-y-10">
      <section>
        <h2 className="display text-xl">Avatar</h2>
        <p className="mt-1 text-sm text-white/45">
          Choisis un personnage de ta collection. L&apos;initiale sert de repli.
        </p>

        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          <label className="cursor-pointer">
            <input
              type="radio"
              name="avatar"
              value=""
              defaultChecked={!avatarCardId}
              className="peer sr-only"
            />
            <span className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-lg font-bold text-white/70 transition peer-checked:border-acid peer-checked:ring-2 peer-checked:ring-acid/60">
              {username.trim().charAt(0).toUpperCase()}
            </span>
            <span className="mt-1 block truncate text-center text-[11px] text-white/40">Aucun</span>
          </label>

          {choices.map((choice) => (
            <label key={choice.id} className="cursor-pointer">
              <input
                type="radio"
                name="avatar"
                value={choice.id}
                defaultChecked={avatarCardId === choice.id}
                className="peer sr-only"
              />
              <span className="relative block aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/40 transition peer-checked:border-acid peer-checked:ring-2 peer-checked:ring-acid/60">
                {choice.url ? (
                  <Image
                    src={choice.url}
                    alt={choice.name}
                    fill
                    sizes="120px"
                    unoptimized
                    className="object-cover object-top"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[10px] text-white/40">
                    {choice.name.slice(0, 2)}
                  </span>
                )}
              </span>
              <span className="mt-1 block truncate text-center text-[11px] text-white/40">
                {choice.name}
              </span>
            </label>
          ))}
        </div>

        {choices.length === 0 && (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
            Ouvre un booster pour pouvoir choisir un avatar.
          </p>
        )}
      </section>

      <section>
        <h2 className="display text-xl">Cadre</h2>
        <p className="mt-1 text-sm text-white/45">
          Les cadres se débloquent en agrandissant ta collection. Ils entourent ton avatar partout
          sur le site.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {FRAME_ORDER.map((key) => {
            const info = FRAMES[key];
            const isUnlocked = unlocked.includes(key);
            return (
              <label
                key={key}
                className={isUnlocked ? "cursor-pointer" : "cursor-not-allowed opacity-45"}
              >
                <input
                  type="radio"
                  name="frame"
                  value={key}
                  disabled={!isUnlocked}
                  defaultChecked={currentFrame === key || (!isUnlocked && key === "steel")}
                  className="peer sr-only"
                />
                <span className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition peer-checked:border-acid peer-checked:ring-2 peer-checked:ring-acid/60">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-acid to-cyan text-sm font-bold text-ink ring-2 ${info.ring} ${info.glow}`}
                  >
                    {username.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="mt-3 block text-sm font-semibold text-white/85">{info.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-white/40">
                    {isUnlocked ? info.requirement : `Verrouillé · ${info.requirement}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {state.error && (
        <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-lg border border-acid/30 bg-acid/10 px-3 py-2 text-sm text-acid">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-acid px-6 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <p className="text-xs text-white/35">
          {unlocked.length}/{FRAME_ORDER.length} cadres débloqués
        </p>
      </div>
    </form>
  );
}
