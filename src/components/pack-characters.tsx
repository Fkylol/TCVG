"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCard, getCardGradient, type Rarity } from "@/lib/cards";
import { RARITY, RARITY_ORDER } from "@/lib/game";
import { getPortraitFraming } from "@/lib/portraits";

type CardRow = {
  id: string;
  name: string;
  franchise: string;
  rarity: Rarity;
  owned: boolean;
  quantity: number;
  imageUrl: string | null;
};

type Counts = Record<string, { owned: number; total: number }>;

type Section = {
  cards: CardRow[];
  nextCursor: number | null;
  loading: boolean;
};

const PAGE = 18;
const PAGE_MORE = 60;
const DEBOUNCE_MS = 250;

/**
 * État de la modale mémorisé par pack (filtre, recherche, défilement) :
 * ouvrir une fiche puis revenir doit retrouver la liste au même endroit.
 */
function stateKey(packId: string): string {
  return `tcvg:persos:${packId}`;
}

type SavedState = { filter: "all" | "missing"; query: string; scrollTop: number };

function readState(packId: string): SavedState | null {
  try {
    const raw = sessionStorage.getItem(stateKey(packId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      filter: parsed.filter === "missing" ? "missing" : "all",
      query: typeof parsed.query === "string" ? parsed.query : "",
      scrollTop: typeof parsed.scrollTop === "number" ? parsed.scrollTop : 0,
    };
  } catch {
    return null;
  }
}

/** Raretés affichées de la plus rare à la plus commune. */
const SECTION_ORDER: Rarity[] = ["L", "UR", "SR", "R", "C"];

function emptySections(): Record<string, Section> {
  return Object.fromEntries(
    SECTION_ORDER.map((rarity) => [rarity, { cards: [], nextCursor: null, loading: true }]),
  );
}

/**
 * Modale de la liste des personnages d'un pack.
 *
 * Les compteurs et les listes viennent de `/api/packs/[id]/cards` : le
 * navigateur ne reçoit jamais toute la collection, et les images ne sont
 * chargées qu'à l'affichage (`loading="lazy"`).
 */
export function PackCharacters({
  packId,
  packName,
  onClose,
}: {
  packId: string;
  packName: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [sections, setSections] = useState<Record<string, Section>>(emptySections);
  const [counts, setCounts] = useState<Counts>({});
  const [ownedTotal, setOwnedTotal] = useState(0);
  const [total, setTotal] = useState(0);
  // État restauré au montage : la modale rouvre là où le joueur l'avait
  // laissée (même pack uniquement).
  const restored = useRef(false);
  const [query, setQuery] = useState(() => readState(packId)?.query ?? "");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<"all" | "missing">(
    () => readState(packId)?.filter ?? "all",
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mémorise filtre, recherche et position de défilement à chaque changement.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(
          stateKey(packId),
          JSON.stringify({ filter, query, scrollTop: bodyRef.current?.scrollTop ?? 0 }),
        );
      } catch {
        // Navigation privée : la modale fonctionne sans mémoire.
      }
    }, 200);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [packId, filter, query]);

  // Recherche retardée : on n'appelle pas l'API à chaque frappe.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (debounced) search.set("q", debounced);
    if (filter === "missing") search.set("filter", "missing");
    return search;
  }, [debounced, filter]);

  /** Charge la première page de chaque rareté. */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const results = await Promise.all(
        SECTION_ORDER.map(async (rarity) => {
          const search = new URLSearchParams(params);
          search.set("rarity", rarity);
          search.set("limit", String(PAGE));
          const response = await fetch(`/api/packs/${packId}/cards?${search.toString()}`);
          if (!response.ok) return [rarity, null, null] as const;
          const data = (await response.json()) as {
            cards: CardRow[];
            counts: Counts;
            ownedTotal: number;
            total: number;
            nextCursor: number | null;
          };
          return [rarity, data, null] as const;
        }),
      );

      if (cancelled) return;

      setSections((previous) => {
        const next = { ...previous };
        for (const [rarity, data] of results) {
          if (!data) continue;
          next[rarity] = { cards: data.cards, nextCursor: data.nextCursor, loading: false };
        }
        return next;
      });

      const first = results.find(([, data]) => data)?.[1];
      if (first) {
        setCounts(first.counts);
        setOwnedTotal(first.ownedTotal);
        setTotal(first.total);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [packId, params]);

  /** Replace le défilement une fois la première page affichée. */
  useEffect(() => {
    if (restored.current) return;
    const hasContent = Object.values(sections).some((section) => section.cards.length > 0);
    if (!hasContent) return;

    const saved = readState(packId);
    if (saved && bodyRef.current) bodyRef.current.scrollTop = saved.scrollTop;
    restored.current = true;
  }, [packId, sections]);

  /** Bouton « Voir N de plus » d'une section. */
  async function loadMore(rarity: Rarity) {
    const section = sections[rarity];
    if (!section || section.nextCursor === null || section.loading) return;

    setSections((previous) => ({
      ...previous,
      [rarity]: { ...previous[rarity], loading: true },
    }));

    const search = new URLSearchParams(params);
    search.set("rarity", rarity);
    search.set("cursor", String(section.nextCursor));
    search.set("limit", String(PAGE_MORE));

    const response = await fetch(`/api/packs/${packId}/cards?${search.toString()}`);
    const data = response.ok
      ? ((await response.json()) as { cards: CardRow[]; nextCursor: number | null })
      : { cards: [], nextCursor: null };

    setSections((previous) => ({
      ...previous,
      [rarity]: {
        cards: [...previous[rarity].cards, ...data.cards],
        nextCursor: data.nextCursor,
        loading: false,
      },
    }));
  }

  // Échap ferme, le focus reste dans la modale.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    searchInput.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;

      const focusables = dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer" onClick={onClose} />

      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`${packName} : les persos`}
        className="relative flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#080a0c] sm:h-[88vh] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Personnages</p>
            <h2 className="display mt-1 truncate text-xl">{packName}</h2>
            <p className="mt-1 font-mono text-xs text-white/45">
              {ownedTotal} / {total} possédés
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm shrink-0">
            Fermer
          </button>
        </header>

        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-3 sm:flex-row sm:items-center">
          <input
            ref={searchInput}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSections(emptySections());
            }}
            placeholder="Rechercher un perso ou une franchise…"
            aria-label="Rechercher un personnage"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-acid/60 focus:outline-none"
          />
          <div className="flex gap-1" role="group" aria-label="Filtrer les personnages">
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setSections(emptySections());
              }}
              aria-pressed={filter === "all"}
              className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-outline"}`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => {
                setFilter("missing");
                setSections(emptySections());
              }}
              aria-pressed={filter === "missing"}
              className={`btn btn-sm ${filter === "missing" ? "btn-primary" : "btn-outline"}`}
            >
              Manquants
            </button>
          </div>
        </div>

        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-5 py-4"
          onScroll={() => {
            if (!restored.current || !bodyRef.current) return;
            const scrollTop = bodyRef.current.scrollTop;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
              try {
                sessionStorage.setItem(
                  stateKey(packId),
                  JSON.stringify({ filter, query, scrollTop }),
                );
              } catch {
                // Rien à faire : la mémoire de la modale est un confort.
              }
            }, 200);
          }}
        >
          {SECTION_ORDER.map((rarity) => {
            const section = sections[rarity];
            const count = counts[rarity];
            if (!section || !count || count.total === 0) return null;
            if (section.cards.length === 0 && !section.loading) return null;

            const info = RARITY[rarity];
            const remaining = section.nextCursor === null ? 0 : count.total - section.cards.length;

            return (
              <section key={rarity} className="mb-7 last:mb-2">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className={`display flex items-center gap-2 text-sm ${info.text}`}>
                    <span className={`chip px-1.5 py-0.5 text-[10px] font-bold ${info.badge}`}>
                      {info.short}
                    </span>
                    {info.label}
                  </h3>
                  <span className="font-mono text-xs text-white/40">
                    {count.owned}/{count.total}
                  </span>
                </div>

                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {section.cards.map((card) => (
                    <li key={card.id}>
                      <PackCardTile card={card} packId={packId} />
                    </li>
                  ))}
                </ul>

                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => void loadMore(rarity)}
                    disabled={section.loading}
                    className="btn btn-outline btn-sm mt-3"
                  >
                    {section.loading
                      ? "Chargement…"
                      : `Voir ${Math.min(PAGE_MORE, remaining)} de plus · ${remaining} restants`}
                  </button>
                )}
              </section>
            );
          })}

          {total === 0 && (
            <p className="py-10 text-center text-sm text-white/45">
              Aucun personnage dans ce pack pour le moment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Vignette : image en couleur si possédée, grise avec « ? » sinon.
 *
 * Une carte sans visuel garde son emoji quand elle est possédée : le « ? » est
 * réservé aux cartes manquantes, sinon un personnage possédé mais sans image
 * ressemblerait à un personnage à collectionner.
 *
 * Toutes les cartes mènent à leur fiche, possédées ou non ; l'URL de retour
 * permet de rouvrir la modale du pack au même endroit.
 */
function PackCardTile({ card, packId }: { card: CardRow; packId: string }) {
  const [broken, setBroken] = useState(false);
  const info = RARITY[card.rarity];
  const showImage = Boolean(card.imageUrl) && !broken;
  const initial = card.name.trim().charAt(0).toUpperCase();
  // Même cadrage que la fiche carte : haut-centré, avec les exceptions par
  // personnage. Sans ça, `object-cover` centré coupait la tête des visuels
  // debout (ou ne gardait qu'un pan de décor sur les illustrations larges).
  const framing = getPortraitFraming(card.id);
  const full = getCard(card.id);
  const { from, to } = full
    ? getCardGradient(full)
    : { from: "#1f2937", to: "#0b0f14" };

  const content = (
    <>
      <span
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-md"
        style={{ background: `radial-gradient(115% 90% at 50% -5%, ${from} 0%, ${to} 70%)` }}
      >
        {showImage && card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt=""
            fill
            sizes="120px"
            unoptimized
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            style={framing}
            className={card.owned ? "" : "grayscale opacity-45"}
          />
        ) : card.owned ? (
          <span
            aria-hidden
            className={`absolute inset-0 grid place-items-center text-3xl ${info.text}`}
          >
            {full?.emoji ?? initial}
          </span>
        ) : null}

        {!card.owned && (
          <span
            aria-hidden
            className={`absolute inset-0 grid place-items-center text-2xl font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] ${info.text}`}
          >
            ?
          </span>
        )}

        {card.quantity > 1 && (
          <span className="absolute right-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
            ×{card.quantity}
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-[11px] leading-tight text-white/80">{card.name}</span>
    </>
  );

  return (
    <Link
      href={`/card/${card.id}?retour=persos&pack=${packId}`}
      className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-acid/70"
      title={`${card.name} — ${card.franchise}`}
    >
      {content}
    </Link>
  );
}

/** Ordre partagé, utilisé par la page pour trier les raretés. */
export { RARITY_ORDER as PACK_RARITY_ORDER };
