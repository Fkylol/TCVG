import type { Card, Rarity } from "@/lib/cards";
import type { PortraitFraming } from "@/lib/framing";

/**
 * Couche d'édition du catalogue, relue à chaque rendu.
 *
 * Le catalogue de base vit dans `src/lib/cards.ts` ; cette couche, stockée en
 * base (`public.card_edits`), porte par-dessus :
 *   • les champs remplacés par l'atelier (nom, rareté, univers, emoji, visuel) ;
 *   • les cartes retirées du jeu (`hidden`), y compris après suppression de la
 *     ligne `cards` — la trace de suppression doit survivre à la carte.
 *
 * Le serveur l'installe avant de rendre (voir `card-edits.server.ts`) ; le
 * navigateur reçoit le même contenu au tout début de la page, donc rendu
 * serveur et hydratation lisent exactement la même chose.
 */
export type CardEdit = {
  cardId: string;
  name: string | null;
  rarity: Rarity | null;
  universe: string | null;
  emoji: string | null;
  imageUrl: string | null;
  /** Cadrage choisi dans l'atelier (zoom, position) ; `null` = celui du catalogue. */
  framing: PortraitFraming | null;
  hidden: boolean;
};

/** Clé posée dans la page par le layout racine, lue au chargement du module. */
type Boot = { __CARD_EDITS__?: CardEdit[] };

let EDITS = new Map<string, CardEdit>();
/** Incrémenté à chaque installation : les totaux dérivés savent se recalculer. */
let VERSION = 0;

export function setCardEdits(rows: CardEdit[]): void {
  EDITS = new Map(rows.map((row) => [row.cardId, row]));
  VERSION += 1;
}

/** Version courante de la couche d'édition (mémoïsation des totaux). */
export function cardEditsVersion(): number {
  return VERSION;
}

export function cardEdit(id: string): CardEdit | undefined {
  return EDITS.get(id);
}

export function isHiddenCard(id: string): boolean {
  return EDITS.get(id)?.hidden === true;
}

/** Applique les remplacements à une carte du catalogue, sans la muter. */
export function applyCardEdit(card: Card): Card {
  const edit = EDITS.get(card.id);
  if (!edit) return card;
  return {
    ...card,
    name: edit.name ?? card.name,
    rarity: edit.rarity ?? card.rarity,
    universe: (edit.universe as Card["universe"] | null) ?? card.universe,
    emoji: edit.emoji ?? card.emoji,
  };
}

/** Même chose, pour une liste : filtre les cartes retirées et applique les edits. */
export function applyCardEdits(cards: Card[]): Card[] {
  return cards.filter((card) => !isHiddenCard(card.id)).map(applyCardEdit);
}

// Le bootstrap navigateur : le layout racine pose ce contenu avant le bundle.
const boot = (globalThis as Boot).__CARD_EDITS__;
if (Array.isArray(boot)) setCardEdits(boot);
