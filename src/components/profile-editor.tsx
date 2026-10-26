"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { saveProfileStyle, type StyleState } from "@/app/actions";
import { AvatarFrame } from "@/components/avatar-frame";
import { FrameGallery } from "@/components/frame-gallery";
import { getCardArt } from "@/lib/card-art";
import type { FrameView } from "@/lib/frames";
import { getPortraitFraming } from "@/lib/portraits";

export type AvatarChoice = {
  id: string;
  name: string;
  number: number;
  universe: string;
  url: string | null;
};

const initialState: StyleState = {};

/** Casse et accents ignorés : « ciri », « Ciri » et « Círí » se valent. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function ProfileEditor({
  username,
  avatarCardId,
  selectedFrameId,
  choices,
  frames,
  unlockedCount,
  activeTotal,
  next,
  initialFrame,
}: {
  username: string;
  avatarCardId: string | null;
  selectedFrameId: string;
  choices: AvatarChoice[];
  frames: FrameView[];
  unlockedCount: number;
  activeTotal: number;
  next: { frameId: string; name: string; remaining: string; percent: number } | null;
  initialFrame?: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveProfileStyle, initialState);
  const [query, setQuery] = useState("");
  // Sélection contrôlée : un avatar masqué par la recherche doit garder son
  // état (un bouton radio non contrôlé le perdrait en quittant le DOM).
  const [selectedAvatar, setSelectedAvatar] = useState(avatarCardId ?? "");
  const requestedFrame = frames.find(
    (frame) => frame.id === initialFrame && frame.unlocked && frame.active,
  );
  const [selectedFrame, setSelectedFrame] = useState(
    requestedFrame?.id ?? selectedFrameId,
  );

  const needle = normalize(query);

  const matches = useMemo(() => {
    if (!needle) return choices;
    return choices.filter(
      (choice) =>
        normalize(choice.name).includes(needle) ||
        normalize(choice.universe).includes(needle),
    );
  }, [choices, needle]);

  // L'avatar retenu reste affiché même hors recherche : sans son bouton radio,
  // l'enregistrement enverrait « aucun avatar » et l'effacerait.
  const visibleChoices = useMemo(() => {
    if (!needle) return choices;
    return choices.filter((choice) => choice.id === selectedAvatar || matches.includes(choice));
  }, [choices, matches, needle, selectedAvatar]);

  const previewArt = selectedAvatar ? (getCardArt(selectedAvatar) ?? null) : null;
  // Un cadre retiré par l'administration ne doit pas rester sélectionné dans
  // le formulaire : la sélection effective retombe sur celle calculée par le
  // serveur, sans effet ni rendu en cascade.
  const effectiveFrame = frames.some(
    (frame) => frame.id === selectedFrame && frame.unlocked && frame.active,
  )
    ? selectedFrame
    : selectedFrameId;
  const liveFrame = frames.find((frame) => frame.id === effectiveFrame);

  return (
    <form action={formAction} className="mt-8 space-y-10">
      <section>
        <h2 className="display text-xl">Aperçu</h2>
        <p className="mt-1 text-sm text-white/45">
          Ton avatar et ton cadre, tels qu&apos;ils apparaissent dans l&apos;en-tête, le chat et le
          marché.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-5 border border-white/10 bg-white/[0.02] p-4">
          <AvatarFrame
            avatar={previewArt}
            initial={username}
            size={84}
            frameId={effectiveFrame}
            title={liveFrame?.name ?? "Acier"}
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Cadre sélectionné</p>
            <p className="mt-1 display text-xl text-white/90">{liveFrame?.name ?? "Acier"}</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-white/40">
              {liveFrame?.description}
            </p>
            <p className="mt-2 font-mono text-[11px] text-white/35">
              {unlockedCount} / {activeTotal} cadres débloqués
              {next ? ` · ${next.remaining || `${next.name} à ${next.percent} %`}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="display text-xl">Avatar</h2>
        <p className="mt-1 text-sm text-white/45">
          Choisis un personnage de ta collection. L&apos;initiale sert de repli.
        </p>

        {choices.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Entrée ne doit pas envoyer le formulaire du profil.
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Rechercher un personnage ou une franchise…"
              aria-label="Rechercher un avatar"
              className="field min-w-0 flex-1"
            />
            <p className="font-mono text-[11px] text-white/35" aria-live="polite">
              {needle
                ? `${matches.length} / ${choices.length}`
                : `${choices.length} disponible${choices.length > 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        {/* Deux rangées d'avatars, le reste au défilement horizontal. */}
        <div className="mt-4 overflow-x-auto pb-2">
          <div className="grid auto-cols-[5.5rem] grid-flow-col grid-rows-2 gap-3">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="avatar"
                value=""
                checked={selectedAvatar === ""}
                onChange={() => setSelectedAvatar("")}
                className="peer sr-only"
              />
              <span className="cut grid aspect-square place-items-center border border-white/10 bg-white/[0.03] font-mono text-lg font-bold text-white/70 transition peer-checked:border-acid peer-checked:bg-acid/10">
                {username.trim().charAt(0).toUpperCase()}
              </span>
              <span className="mt-1 block truncate text-center text-[11px] text-white/40">
                Aucun
              </span>
            </label>

            {visibleChoices.map((choice) => (
              <label key={choice.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="avatar"
                  value={choice.id}
                  checked={selectedAvatar === choice.id}
                  onChange={() => setSelectedAvatar(choice.id)}
                  className="peer sr-only"
                />
                <span className="cut relative block aspect-square overflow-hidden border border-white/10 bg-black/40 transition peer-checked:border-acid peer-checked:bg-acid/10">
                  {choice.url ? (
                    <Image
                      src={choice.url}
                      alt={choice.name}
                      fill
                      sizes="120px"
                      unoptimized
                      style={getPortraitFraming(choice.id)}
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[10px] text-white/40">
                      {choice.name.slice(0, 2)}
                    </span>
                  )}
                </span>
                <span
                  className="mt-1 block truncate text-center text-[11px] text-white/40"
                  title={choice.name}
                >
                  {choice.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {needle && matches.length === 0 && (
          <p className="mt-3 text-sm text-white/45">
            Aucun personnage de ta collection ne correspond à « {query.trim()} ».
          </p>
        )}

        {choices.length === 0 && (
          <p className="mt-4 border-l-2 border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
            Ouvre un booster pour pouvoir choisir un avatar.
          </p>
        )}
      </section>

      <section id="cadres" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-xl">Cadre</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/45">
              Les cadres se débloquent avec l&apos;album, les raretés, les genres, l&apos;activité
              et le social. Un cadre débloqué reste acquis, même si tu revends des cartes.
            </p>
          </div>
          <p className="chip py-1.5 text-[11px] text-white/55">
            <span className="font-mono text-acid">{unlockedCount}</span> / {activeTotal} débloqués
          </p>
        </div>

        {next && (
          <p className="mt-3 border-l-2 border-acid/50 bg-acid/[0.04] px-3 py-2 text-xs text-white/55">
            Prochain cadre : <span className="text-white/80">{next.name}</span>
            {" · "}
            {next.remaining || `progression ${next.percent} %`}
          </p>
        )}

        <input type="hidden" name="frame" value={effectiveFrame} />

        <FrameGallery
          frames={frames}
          selectedFrameId={effectiveFrame}
          onSelect={setSelectedFrame}
          avatar={previewArt}
          initial={username}
        />
      </section>

      {state.error && (
        <p role="alert" className="border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="border-l-2 border-acid/70 bg-acid/10 px-3 py-2 text-sm text-acid">
          {state.message}
        </p>
      )}

      <div className="flex sticky bottom-3 z-10 items-center gap-3 border border-white/10 bg-ink/95 px-3 py-2.5 backdrop-blur">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <p className="text-xs text-white/35">Le cadre choisi s&apos;applique partout sur le site.</p>
      </div>
    </form>
  );
}
