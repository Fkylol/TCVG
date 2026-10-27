"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { deleteCard, saveCardEdit } from "@/app/atelier/cartes/en-ligne-actions";
import { CardFace } from "@/components/card-face";
import type { CardArt } from "@/lib/card-art";
import type { Card } from "@/lib/cards";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampFraming,
  fitFraming,
  panFraming,
  parsePosition,
  zoomFraming,
  type PortraitFraming,
} from "@/lib/framing";

type Option = { key: string; label: string };

/**
 * Formulaire d'édition d'une carte, en ligne.
 *
 * Le visuel se règle ici comme dans l'atelier local : on glisse dans l'aperçu
 * pour recentrer, la barre règle le zoom. Le cadrage porte sur l'image
 * affichée — celle du catalogue comprise —, donc on peut recadrer une photo
 * déjà en place sans la remplacer.
 */
export function OnlineCardForm({
  card,
  art,
  values,
  rarities,
  universes,
}: {
  card: Card;
  /** Visuel actuellement résolu (URL + cadrage enregistrés), ou `null`. */
  art: CardArt | null;
  values: {
    name: string;
    rarity: string;
    universe: string;
    emoji: string;
    imageUrl: string;
  };
  rarities: Option[];
  universes: Option[];
}) {
  const [imageUrl, setImageUrl] = useState(values.imageUrl);
  const [framing, setFraming] = useState<PortraitFraming>(() => clampFraming(art?.framing));
  // Dernier point du glisser : cadrer, c'est déplacer le visuel dans le cadre.
  const panRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const src = imageUrl.trim() || art?.src || "";
  const previewArt: CardArt | null = src ? { src, local: false, framing } : null;
  const position = parsePosition(framing.objectPosition);

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!src) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    panRef.current = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan) return;
    const dx = (event.clientX - pan.x) / pan.width;
    const dy = (event.clientY - pan.y) / pan.height;
    panRef.current = { ...pan, x: event.clientX, y: event.clientY };
    setFraming((current) => panFraming(current, dx, dy));
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <form action={saveCardEdit} className="grid content-start gap-3 sm:grid-cols-2">
        <input type="hidden" name="cardId" value={card.id} />

        <label className="flex flex-col gap-1 text-[12px] text-white/55">
          Nom
          <input
            name="name"
            defaultValue={values.name}
            className="rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 outline-none focus:border-cyan/45"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12px] text-white/55">
          Rareté
          <select
            name="rarity"
            defaultValue={values.rarity}
            className="rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 outline-none focus:border-cyan/45"
          >
            {rarities.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[12px] text-white/55">
          Univers
          <select
            name="universe"
            defaultValue={values.universe}
            className="rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 outline-none focus:border-cyan/45"
          >
            {universes.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[12px] text-white/55">
          Emoji (repli sans visuel)
          <input
            name="emoji"
            defaultValue={values.emoji}
            placeholder="🔹"
            className="rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 outline-none focus:border-cyan/45"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12px] text-white/55 sm:col-span-2">
          Visuel (URL http(s), vide = visuel actuel)
          <input
            name="imageUrl"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://…"
            className="rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 outline-none focus:border-cyan/45"
          />
        </label>

        {/* Cadrage : relu tel quel par `atelier_save_card_edit`. */}
        <input type="hidden" name="imageFit" value={framing.objectFit} />
        <input type="hidden" name="imagePosition" value={framing.objectPosition} />
        <input type="hidden" name="imageZoom" value={framing.zoom ?? ""} />

        <button
          type="submit"
          className="btn btn-primary px-4 text-xs sm:col-span-2 sm:justify-self-start"
        >
          Enregistrer et publier
        </button>
      </form>

      <aside className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Aperçu</p>
        <div
          className="flex justify-center"
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDragStart={(event) => event.preventDefault()}
          style={{
            touchAction: src ? "none" : undefined,
            cursor: src ? "grab" : "default",
          }}
        >
          <CardFace
            card={card}
            art={previewArt}
            size="md"
            tilt={false}
            className="aspect-[3/4] w-[220px]"
          />
        </div>

        <div className="space-y-2 border border-white/10 bg-white/[0.02] p-2.5">
          <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-white/40">
            <span>Cadrage</span>
            <span className="font-mono normal-case tracking-normal text-white/30">
              {position.x}% · {position.y}% · ×{(framing.zoom ?? 1).toFixed(2)}
            </span>
          </div>
          <label className="block">
            <span className="sr-only">Zoom du visuel</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={framing.zoom ?? 1}
              onChange={(event) =>
                setFraming((current) => zoomFraming(current, Number(event.target.value)))
              }
              className="w-full accent-cyan"
            />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setFraming((current) => fitFraming(current))}
              className="btn btn-outline flex-1 px-2 text-[10px]"
            >
              {framing.objectFit === "cover" ? "Voir toute l'image" : "Remplir le cadre"}
            </button>
            <button
              type="button"
              onClick={() =>
                setFraming(clampFraming({ objectFit: "cover", objectPosition: "50% 0%" }))
              }
              className="btn btn-outline px-2 text-[10px]"
            >
              Réinitialiser
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-white/30">
            Glisse dans l&apos;aperçu pour recentrer, la barre pour zoomer. Le cadrage porte sur
            l&apos;image affichée, même sans changer l&apos;URL.
          </p>
        </div>

        <form
          action={deleteCard}
          className="flex flex-col gap-2 border border-white/10 p-2.5"
        >
          <input type="hidden" name="cardId" value={card.id} />
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
            <input type="checkbox" name="confirme" value="1" className="mt-0.5" />
            Je confirme la suppression définitive (copies, annonces, fiches)
          </label>
          <button
            type="submit"
            className="btn btn-outline border-rose-400/40 px-3 text-[11px] text-rose-200"
          >
            Supprimer la carte
          </button>
        </form>
      </aside>
    </div>
  );
}
