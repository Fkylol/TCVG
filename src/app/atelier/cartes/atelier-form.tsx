"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  prepareAction,
  insertAction,
  inspectPortraitAction,
  loadCardAction,
} from "@/app/atelier/cartes/actions";
import type { CardDraft, PortraitCandidate } from "@/lib/atelier-core";
import type { GenreSlug } from "@/lib/card-genres";
import type { Card, Rarity } from "@/lib/cards";
import { CardFace } from "@/components/card-face";
import type { CardArt } from "@/lib/card-art";
import { atelierImageSrc } from "@/lib/atelier-image";
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

const RARITIES: { value: Rarity; label: string }[] = [
  { value: "C", label: "Commune" },
  { value: "UC", label: "Peu commune" },
  { value: "R", label: "Rare" },
  { value: "SR", label: "Épique" },
  { value: "UR", label: "Légendaire" },
  { value: "L", label: "Mythique" },
];

type Universe = { slug: string; label: string; count: number };
type Genre = { slug: GenreSlug; name: string };
type CatalogCard = { id: string; name: string; universe: string };

type Prepared = {
  draft: CardDraft;
  candidates: PortraitCandidate[];
  notes: string[];
  rarityNote: string;
  guess: { universe: string; label: string; note: string } | null;
};

function framingOf(draft: CardDraft): CardArt {
  return {
    // Le visuel passe par le relais de l'atelier : la page est ouverte depuis
    // `localhost`, et les CDN refusent le referer local (voir `atelier-image`).
    src: atelierImageSrc(draft.portrait?.url ?? ""),
    local: false,
    framing: clampFraming(draft.portrait?.framing),
  };
}

export function AtelierForm({
  universes,
  genres,
  cards,
  total,
  initialCard = null,
  initialCandidates = [],
}: {
  universes: Universe[];
  genres: Genre[];
  /** Catalogue existant, pour ouvrir une carte à corriger. */
  cards: CatalogCard[];
  total: number;
  /** Carte déjà chargée (`?edit=`), depuis un signalement. */
  initialCard?: CardDraft | null;
  initialCandidates?: PortraitCandidate[];
}) {
  // Vide = « déduire du nom » : on n'oblige pas à connaître la franchise.
  const [universe, setUniverse] = useState(initialCard?.universe ?? "");
  const [name, setName] = useState(initialCard?.name ?? "");
  const [busy, setBusy] = useState<"load" | "prepare" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(
    initialCard
      ? { draft: initialCard, candidates: initialCandidates, notes: [], rarityNote: "", guess: null }
      : null,
  );
  const [draft, setDraft] = useState<CardDraft | null>(initialCard);
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  // Modification d'une carte existante : elle est réécrite, pas dupliquée.
  const [cardQuery, setCardQuery] = useState(initialCard?.id ?? "");
  const [editing, setEditing] = useState(Boolean(initialCard));
  // Visuel collé depuis une recherche d'images (« Google Images », site officiel).
  const [artUrl, setArtUrl] = useState("");
  const [artBusy, setArtBusy] = useState(false);
  const [artError, setArtError] = useState<string | null>(null);
  const [artNote, setArtNote] = useState<string | null>(null);
  // Dernier point du glisser : cadrer, c'est déplacer le visuel dans le cadre.
  const panRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const patch = (values: Partial<CardDraft>) => setDraft((current) => (current ? { ...current, ...values } : current));
  const patchLore = (values: Partial<CardDraft["lore"]>) =>
    setDraft((current) => (current ? { ...current, lore: { ...current.lore, ...values } } : current));

  // En modification, les champs d'identité de l'étape 1 alimentent le brouillon
  // en direct : ce qu'on voit dans l'aperçu est ce qui sera enregistré.
  const changeName = (value: string) => {
    setName(value);
    patch({ name: value });
  };
  const changeUniverse = (value: string) => {
    setUniverse(value);
    patch({ universe: value });
  };

  /** Cartes du catalogue qui répondent à la recherche (nom, identifiant, franchise). */
  const matches = useMemo(() => {
    const term = cardQuery.trim().toLowerCase();
    if (!term) return [];
    const universeLabel = (slug: string) =>
      universes.find((entry) => entry.slug === slug)?.label ?? slug;
    return cards
      .filter(
        (card) =>
          card.name.toLowerCase().includes(term) ||
          card.id.includes(term) ||
          universeLabel(card.universe).toLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [cardQuery, cards, universes]);

  async function loadCard(target: string) {
    if (!target) return;
    setBusy("load");
    setError(null);
    setSaved(null);
    try {
      const result = await loadCardAction({ id: target });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPrepared({ draft: result.draft, candidates: result.candidates, notes: [], rarityNote: "", guess: null });
      setDraft(result.draft);
      setUniverse(result.draft.universe);
      setName(result.draft.name);
      setEditing(true);
      setArtError(null);
      setArtNote(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le chargement a échoué.");
    } finally {
      setBusy(null);
    }
  }

  /** Cadrage courant du brouillon (position et zoom). */
  const framing = clampFraming(draft?.portrait?.framing);
  const position = parsePosition(framing.objectPosition);

  function updateFraming(next: PortraitFraming) {
    setDraft((current) =>
      current && current.portrait
        ? { ...current, portrait: { ...current.portrait, framing: clampFraming(next) } }
        : current,
    );
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draft?.portrait) return;
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
    updateFraming(panFraming(framing, dx, dy));
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function checkArtUrl() {
    if (!draft) return;
    setArtBusy(true);
    setArtError(null);
    setArtNote(null);
    try {
      const result = await inspectPortraitAction({ url: artUrl, name: draft.name });
      if (!result.ok) {
        setArtError(result.error);
        return;
      }
      const candidate = result.candidate;
      setPrepared((current) =>
        current
          ? { ...current, candidates: [candidate, ...current.candidates.filter((item) => item.url !== candidate.url)] }
          : current,
      );
      patch({ portrait: candidate });
      setArtUrl("");
      setArtNote(`Visuel retenu : ${candidate.width}×${candidate.height}.`);
    } catch (cause) {
      setArtError(cause instanceof Error ? cause.message : "La vérification a échoué.");
    } finally {
      setArtBusy(false);
    }
  }

  const toggleGenre = (slug: GenreSlug) => {
    setDraft((current) => {
      if (!current) return current;
      const has = current.genres.includes(slug);
      return { ...current, genres: has ? current.genres.filter((g) => g !== slug) : [...current.genres, slug] };
    });
  };

  async function prepare() {
    setBusy("prepare");
    setError(null);
    setSaved(null);
    setPrepared(null);
    setDraft(null);
    try {
      const result = await prepareAction({ universe, name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPrepared(result);
      setDraft(result.draft);
      setEditing(false);
      if (result.guess) setUniverse(result.guess.universe);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La préparation a échoué.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setError(null);
    try {
      const result = await insertAction(draft);
      if (!result.ok) {
        setError(result.errors.join(" · "));
        return;
      }
      setSaved({ id: result.id, message: result.message });
      setPrepared(null);
      setDraft(null);
      setEditing(false);
      setCardQuery("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.");
    } finally {
      setBusy(null);
    }
  }

  const previewCard: Card | null = draft
    ? {
        id: draft.id,
        name: draft.name,
        universe: draft.universe as Card["universe"],
        emoji: draft.emoji,
        rarity: draft.rarity,
      }
    : null;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="border border-white/10 bg-ink-soft p-4">
          <h2 className="text-sm font-semibold text-white/80">Modifier une carte existante</h2>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={cardQuery}
              onChange={(event) => setCardQuery(event.target.value)}
              placeholder="Rechercher une carte (nom, identifiant, franchise)…"
              className="block h-9 w-full rounded border border-white/15 bg-ink px-2 text-sm text-white placeholder:text-white/25"
            />
            {busy === "load" && (
              <span className="shrink-0 text-[11px] text-white/40">Chargement…</span>
            )}
            {busy !== "load" && cardQuery.trim() !== "" && (
              <span className="shrink-0 font-mono text-[11px] text-white/35">
                {matches.length === 12 ? "12+" : matches.length}
              </span>
            )}
          </div>
          {cardQuery.trim() !== "" && (
            <ul className="mt-2 max-h-60 overflow-y-auto border border-white/10">
              {matches.length === 0 ? (
                <li className="px-2 py-2 text-[12px] text-white/40">Aucune carte ne correspond.</li>
              ) : (
                matches.map((card) => {
                  const current = draft?.id === card.id && editing;
                  return (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={() => void loadCard(card.id)}
                        disabled={busy !== null}
                        className={`flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-[12px] transition hover:bg-white/5 ${
                          current ? "bg-cyan/10 text-cyan" : "text-white/70"
                        }`}
                      >
                        <span className="truncate font-medium">{card.name}</span>
                        <span className="shrink-0 text-[10px] text-white/35">
                          {universes.find((entry) => entry.slug === card.universe)?.label ?? card.universe} ·{" "}
                          {card.id}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            Le formulaire reprend la carte telle qu&apos;elle est au catalogue (fiche, rareté,
            genres, visuel). Valider réécrit cette carte : elle n&apos;est pas dupliquée et son
            numéro d&apos;album ne bouge pas.
          </p>
        </section>

        <section className="border border-white/10 bg-ink-soft p-4">
          <h2 className="text-sm font-semibold text-white/80">
            1. Le personnage
            {editing && (
              <span className="ml-2 chip px-1.5 py-0.5 text-[10px] text-cyan">modification · {draft?.id}</span>
            )}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
              Franchise
              <select
                value={universe}
                onChange={(event) => changeUniverse(event.target.value)}
                className="mt-1 block h-9 w-full rounded border border-white/15 bg-ink px-2 text-sm text-white"
              >
                <option value="">Déduire du nom (auto)</option>
                {universes.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.label} · {entry.count} cartes
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
              Personnage
              <input
                value={name}
                onChange={(event) => changeName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void prepare();
                }}
                placeholder="Ex. Sylvanas"
                className="mt-1 block h-9 w-full rounded border border-white/15 bg-ink px-2 text-sm text-white placeholder:text-white/25"
              />
            </label>
            <button
              type="button"
              onClick={() => void prepare()}
              disabled={busy !== null}
              className="btn btn-primary h-9 self-end px-4 text-xs"
            >
              {busy === "prepare" ? "Recherche…" : "Préparer"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            Laisse la franchise sur « Déduire du nom » pour taper seulement le personnage :
            l&apos;atelier la retrouve sur Wikipédia. La recherche interroge ensuite le wiki de la
            franchise puis Wikipédia (fr, en), vérifie chaque visuel (taille, ratio, hotlink) et lit
            la page pour rédiger la fiche. Compte quelques secondes.
          </p>
          {editing && (
            <p className="mt-2 border-l-2 border-cyan/60 bg-cyan/10 px-3 py-2 text-[12px] text-cyan/90">
              Modification en cours : « Préparer » sert à créer un personnage absent du catalogue.
              Change ici le nom ou la franchise, et remplace le visuel à l&apos;étape 2 (URL collée
              depuis une recherche d&apos;images).
            </p>
          )}
          {prepared?.guess && (
            <p className="mt-2 border-l-2 border-cyan/60 bg-cyan/10 px-3 py-2 text-[12px] text-cyan/90">
              {prepared.guess.note}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          {saved && (
            <p className="mt-3 border-l-2 border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {saved.message}{" "}
              <a href={`/card/${saved.id}`} className="underline">
                Voir la fiche de {saved.id}
              </a>
              <span className="mt-1 block text-[11px] text-emerald-200/60">
                Si la page ne la voit pas encore, recharge : le serveur de dev relit les données.
              </span>
            </p>
          )}
          {prepared && prepared.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-[11px] text-white/40">
              {prepared.notes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          )}
        </section>

        {prepared && draft && (
          <>
            <section className="border border-white/10 bg-ink-soft p-4">
              <h2 className="text-sm font-semibold text-white/80">2. Le visuel</h2>
              {/* Les wikis de franchise n'ont pas toujours le beau visuel : on
                  accepte une adresse collée, vérifiée côté serveur. */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={artUrl}
                  onChange={(event) => setArtUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void checkArtUrl();
                  }}
                  placeholder="Coller l'URL d'une image (recherche Google Images, site officiel…)"
                  className="block h-9 w-full rounded border border-white/15 bg-ink px-2 text-sm text-white placeholder:text-white/25"
                />
                <button
                  type="button"
                  onClick={() => void checkArtUrl()}
                  disabled={!artUrl.trim() || artBusy}
                  className="btn h-9 shrink-0 px-4 text-xs"
                >
                  {artBusy ? "Vérification…" : "Vérifier et utiliser"}
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                L&apos;image doit répondre directement (pas une page d&apos;aperçu), faire au moins
                300 px de côté et rester dans un rapport de 0,4 à 2,5. La licence d&apos;un visuel
                hors wiki n&apos;est pas vérifiée : à toi de choisir une source utilisable.
              </p>
              {artError && (
                <p role="alert" className="mt-2 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                  {artError}
                </p>
              )}
              {artNote && (
                <p className="mt-2 border-l-2 border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100">
                  {artNote}
                </p>
              )}
              {prepared.candidates.length === 0 ? (
                <p className="mt-2 text-[12px] text-white/40">
                  Aucun visuel exploitable : la carte utilisera l&apos;emoji. Tu peux relancer la
                  recherche ou ajouter le visuel plus tard.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {prepared.candidates.map((candidate) => {
                    const selected = draft.portrait?.url === candidate.url;
                    return (
                      <button
                        key={candidate.url}
                        type="button"
                        onClick={() => patch({ portrait: selected ? null : candidate })}
                        className={`overflow-hidden rounded border text-left ${
                          selected ? "border-cyan bg-cyan/10" : "border-white/10 bg-ink hover:border-white/25"
                        }`}
                      >
                        <span className="relative flex h-36 items-center justify-center bg-black/40">
                          {/* `fill` : les anciens portraits de `portraits.json`
                              n'ont pas toujours leurs dimensions, et un
                              `width` manquant ferait planter la vignette. */}
                          <Image
                            src={atelierImageSrc(candidate.url)}
                            alt=""
                            fill
                            sizes="180px"
                            unoptimized
                            className="object-contain p-1"
                          />
                        </span>
                        <span className="block px-2 py-1.5 text-[10px] leading-tight text-white/55">
                          {candidate.sourceName}
                          {candidate.width > 0 && candidate.height > 0
                            ? ` · ${candidate.width}×${candidate.height}`
                            : ""}
                          {candidate.named ? " · nom dans le fichier" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="border border-white/10 bg-ink-soft p-4">
              <h2 className="text-sm font-semibold text-white/80">3. La fiche</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Identifiant
                  <input
                    value={draft.id}
                    onChange={(event) => patch({ id: event.target.value })}
                    className="mt-1 block h-9 w-full rounded border border-white/15 bg-ink px-2 font-mono text-sm text-white"
                  />
                </label>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Emoji (visuel de secours)
                  <input
                    value={draft.emoji}
                    onChange={(event) => patch({ emoji: event.target.value })}
                    className="mt-1 block h-9 w-full rounded border border-white/15 bg-ink px-2 text-sm text-white"
                  />
                </label>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Rareté
                  <select
                    value={draft.rarity}
                    onChange={(event) => patch({ rarity: event.target.value as Rarity })}
                    className="mt-1 block h-9 w-full rounded border border-white/15 bg-ink px-2 text-sm text-white"
                  >
                    {RARITIES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label} ({entry.value})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Genres
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {genres.map((genre) => {
                      const on = draft.genres.includes(genre.slug);
                      return (
                        <button
                          key={genre.slug}
                          type="button"
                          onClick={() => toggleGenre(genre.slug)}
                          aria-pressed={on}
                          className={`rounded-full border px-2 py-1 text-[10px] normal-case tracking-normal ${
                            on ? "border-cyan bg-cyan/15 text-cyan" : "border-white/15 text-white/50"
                          }`}
                        >
                          {genre.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {prepared.rarityNote && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/35">{prepared.rarityNote}</p>
              )}

              <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-white/45">
                Accroche
                <input
                  value={draft.lore.tagline}
                  onChange={(event) => patchLore({ tagline: event.target.value })}
                  className="mt-1 block h-9 w-full rounded border border-white/15 bg-ink px-2 text-sm text-white"
                />
              </label>
              <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-white/45">
                Biographie
                <textarea
                  value={draft.lore.bio}
                  onChange={(event) => patchLore({ bio: event.target.value })}
                  rows={4}
                  className="mt-1 block w-full rounded border border-white/15 bg-ink px-2 py-1.5 text-sm text-white"
                />
              </label>
              <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                Texte repris de la page source (souvent en anglais) : réécris-le dans le ton du
                catalogue avant de valider.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Citation (facultatif)
                  <textarea
                    value={draft.lore.quote ?? ""}
                    onChange={(event) => patchLore({ quote: event.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded border border-white/15 bg-ink px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Pouvoir (facultatif)
                  <textarea
                    value={draft.lore.power ?? ""}
                    onChange={(event) => patchLore({ power: event.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded border border-white/15 bg-ink px-2 py-1.5 text-sm text-white"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy !== null}
                className="btn btn-primary mt-4 px-5 text-xs"
              >
                {busy === "save"
                  ? "Enregistrement et synchro…"
                  : editing
                    ? "Enregistrer les modifications"
                    : "Valider et ajouter au jeu"}
              </button>
            </section>
          </>
        )}
      </div>

      <aside className="space-y-3">
        <div className="sticky top-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Aperçu</p>
          {/* Glisser sur l'aperçu déplace le visuel dans le cadre. */}
          <div
            className="mt-3 flex justify-center"
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onDragStart={(event) => event.preventDefault()}
            style={{
              touchAction: draft?.portrait ? "none" : undefined,
              cursor: draft?.portrait ? "grab" : "default",
            }}
          >
            {previewCard ? (
              <CardFace
                card={previewCard}
                art={draft?.portrait ? framingOf(draft) : null}
                size="lg"
                tilt={false}
                /* Sans hauteur imposée, `.card-art` (`flex: 1`) tombe à 0 : le
                   visuel est chargé mais invisible. Les autres écrans passent
                   le même `aspect-[3/4]` à la carte. */
                className="aspect-[3/4] w-[240px]"
              />
            ) : (
              <div className="grid h-64 w-full place-items-center border border-dashed border-white/15 text-[11px] text-white/30">
                La carte apparaîtra ici
              </div>
            )}
          </div>
          {draft?.portrait && (
            <div className="mt-3 space-y-2 border border-white/10 bg-ink-soft p-2.5">
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
                    updateFraming(zoomFraming(framing, Number(event.target.value)))
                  }
                  className="w-full accent-cyan"
                />
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => updateFraming(fitFraming(framing))}
                  className="btn btn-outline flex-1 px-2 text-[10px]"
                >
                  {framing.objectFit === "cover" ? "Voir toute l'image" : "Remplir le cadre"}
                </button>
                <button
                  type="button"
                  onClick={() => updateFraming({ objectFit: "cover", objectPosition: "50% 0%" })}
                  className="btn btn-outline px-2 text-[10px]"
                >
                  Réinitialiser
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-white/30">
                Glisse le visuel dans l&apos;aperçu pour le déplacer, la barre pour zoomer.
              </p>
            </div>
          )}

          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
            Catalogue actuel : {total} cartes
          </p>
        </div>
      </aside>
    </div>
  );
}
