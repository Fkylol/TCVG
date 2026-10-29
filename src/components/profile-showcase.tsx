"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { saveProfileShowcase } from "@/app/actions";
import { getCardArt } from "@/lib/card-art";
import { getCardGradient, getUniverseLabel, type Card } from "@/lib/cards";
import { RARITY } from "@/lib/game";
import { framingStyle } from "@/lib/framing";
import { useLocale } from "@/components/locale-provider";

export type ShowcaseCard = { id: string | null; holo: boolean; variant: string };

export function ProfileShowcase({
  cards,
  selectedIds,
  availableCards,
  editable = false,
}: {
  cards: Card[];
  selectedIds: ShowcaseCard[];
  /** Cartes effectivement possédées par le propriétaire. */
  availableCards?: Card[];
  editable?: boolean;
}) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<Array<string | null>>(
    Array.from({ length: 8 }, (_, index) => selectedIds[index]?.id ?? null),
  );
  const [picker, setPicker] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const choices = availableCards ?? cards;
  const variantById = useMemo(() => new Map(selectedIds.filter((item): item is ShowcaseCard & { id: string } => item.id !== null).map((item) => [item.id, item])), [selectedIds]);
  const filtered = useMemo(() => {
    const needle = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return choices.filter((card) => {
      if (selected.includes(card.id)) return false;
      if (!needle) return true;
      return `${card.name} ${getUniverseLabel(card.universe)}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(needle);
    });
  }, [choices, query, selected]);

  function choose(id: string | null) {
    if (picker === null) return;
    setSelected((current) => current.map((value, index) => index === picker ? id : value));
    setPicker(null);
    setQuery("");
    setNote(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveProfileShowcase(selected.map((id) => id ?? ""));
      setNote(result.message ?? result.error ?? t("Impossible d'enregistrer la vitrine."));
    });
  }

  return (
    <section aria-labelledby="showcase-title" className="mt-9">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{t("Collection personnelle")}</span>
          <h2 id="showcase-title" className="display mt-1 text-2xl sm:text-3xl">{t("Ma vitrine")}</h2>
          <p className="mt-1 text-sm text-white/45">{t("Huit cartes choisies parmi ta collection, exposées sur des étagères de verre.")}</p>
        </div>
        {editable && <span className="chip">{selected.filter(Boolean).length}/8</span>}
      </div>

      <div className="glass-showcase mt-5 rounded-2xl border border-cyan/15 px-3 pb-2 pt-5 shadow-[0_24px_70px_-45px_rgba(40,210,240,0.7)] sm:px-6">
        {[0, 1].map((shelf) => (
          <div key={shelf} className="glass-shelf-row">
            <div className="grid grid-cols-4 gap-2.5 sm:gap-5">
              {[0, 1, 2, 3].map((column) => {
                const index = shelf * 4 + column;
                const id = selected[index];
                const card = id ? byId.get(id) : null;
                const art = card ? getCardArt(card.id) : null;
                const gradient = card ? getCardGradient(card) : { from: "#102330", to: "#081018" };
                const variant = id ? variantById.get(id)?.variant ?? "normal" : "normal";
                const holo = id ? variantById.get(id)?.holo ?? false : false;
                return (
                  <div key={index} className="showcase-slot min-w-0">
                    {card ? (
                      <Link href={`/card/${card.id}`} className="showcase-card group block" title={card.name}>
                        <div
                          data-rarity={card.rarity}
                          data-holo={holo ? "true" : undefined}
                          data-variant={variant !== "normal" ? variant : undefined}
                          className="showcase-card-art"
                          style={{ background: `linear-gradient(145deg, ${gradient.from}, ${gradient.to})` }}
                        >
                          {art && !imageErrors[card.id] ? <Image src={art.src} alt={card.name} fill sizes="(max-width: 640px) 22vw, 150px" unoptimized={!art.local} style={framingStyle(art.framing)} onError={() => setImageErrors((current) => ({ ...current, [card.id]: true }))} /> : <span className="text-3xl" aria-hidden>{card.emoji}</span>}
                          <span className="showcase-card-glass" aria-hidden />
                        </div>
                        <span className="mt-1 block truncate text-center text-[10px] font-semibold text-white/75 sm:text-xs">{card.name}</span>
                        <span className={`block text-center text-[9px] uppercase tracking-[0.12em] ${RARITY[card.rarity].text}`}>{RARITY[card.rarity].label}</span>
                      </Link>
                    ) : (
                      <div className="showcase-empty" aria-label={`${t("Emplacement")} ${index + 1}`}>
                        <span className="text-2xl text-cyan/35" aria-hidden>✦</span>
                        {editable && <span className="mt-1 text-[9px] text-white/35 sm:text-[10px]">{t("Carte à exposer")}</span>}
                      </div>
                    )}
                    {editable && (
                      <div className="mt-1 flex justify-center gap-1">
                        <button type="button" onClick={() => { setPicker(index); setQuery(""); }} className="showcase-edit-button">
                          {card ? t("Changer") : t("Choisir")}
                        </button>
                        {card && <button type="button" onClick={() => chooseFromSlot(index)} aria-label={`${t("Retirer")} ${card.name}`} className="showcase-edit-button">×</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="glass-shelf" aria-hidden><span /><span /></div>
          </div>
        ))}
      </div>

      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={isPending} className="btn btn-primary">
            {isPending ? t("Enregistrement…") : t("Enregistrer la vitrine")}
          </button>
          {note && <p role="status" className="text-sm text-white/60">{note}</p>}
        </div>
      )}

      {picker !== null && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPicker(null); setQuery(""); } }}>
          <div role="dialog" aria-modal="true" aria-labelledby="showcase-picker-title" className="panel w-full max-w-xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 id="showcase-picker-title" className="display text-xl">{t("Choisir une carte de ta collection")}</h3>
              <button type="button" onClick={() => { setPicker(null); setQuery(""); }} className="btn btn-outline btn-sm" aria-label={t("Fermer")}>×</button>
            </div>
            <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setPicker(null); }} placeholder={t("Rechercher un personnage ou un univers…")} className="field mt-4 w-full" />
            <div className="mt-4 grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {filtered.map((card) => {
                const art = getCardArt(card.id);
                const gradient = getCardGradient(card);
                return (
                  <button key={card.id} type="button" onClick={() => choose(card.id)} className="panel min-w-0 p-2 text-left transition hover:border-cyan/50">
                    <span className="relative block aspect-[3/4] overflow-hidden rounded-lg" style={{ background: `linear-gradient(145deg, ${gradient.from}, ${gradient.to})` }}>
                      {art ? <Image src={art.src} alt="" fill sizes="120px" unoptimized={!art.local} style={framingStyle(art.framing)} /> : <span className="grid h-full place-items-center text-2xl">{card.emoji}</span>}
                    </span>
                    <span className="mt-1 block truncate text-xs text-white/75">{card.name}</span>
                    <span className="block truncate text-[9px] text-white/35">{getUniverseLabel(card.universe)}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-white/45">{t("Aucune autre carte disponible.")}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );

  function chooseFromSlot(index: number) {
    setSelected((current) => current.map((value, position) => position === index ? null : value));
    setNote(null);
  }
}
