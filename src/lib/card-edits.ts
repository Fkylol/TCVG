import type { Card, Rarity } from "@/lib/cards";
import type { PortraitFraming } from "@/lib/framing";

/** Public card fields created by the admin suggestion workflow. */
export type PublishedCard = {
  id: string;
  name: string;
  universe: string;
  emoji: string;
  rarity: Rarity;
  number: number;
  tagline?: string | null;
  bio?: string | null;
  quote?: string | null;
  power?: string | null;
};

export type CardEdit = {
  cardId: string;
  name: string | null;
  rarity: Rarity | null;
  universe: string | null;
  emoji: string | null;
  imageUrl: string | null;
  framing: PortraitFraming | null;
  hidden: boolean;
  publishedCard?: PublishedCard | null;
  publishedGenres?: string[] | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageSourceName?: string | null;
  imageSourcePage?: string | null;
  imageFile?: string | null;
  imageCredit?: string | null;
  imageLicense?: string | null;
};

type Boot = { __CARD_EDITS__?: CardEdit[] };
let EDITS = new Map<string, CardEdit>();
let VERSION = 0;
let BOOT: CardEdit[] | undefined;

export function setCardEdits(rows: CardEdit[]): void {
  EDITS = new Map(rows.map((row) => [row.cardId, row]));
  VERSION += 1;
}

export function publishCardEdits(rows: CardEdit[]): void {
  (globalThis as Boot).__CARD_EDITS__ = rows;
  setCardEdits(rows);
}

function syncBoot(): void {
  const boot = (globalThis as Boot).__CARD_EDITS__;
  if (!Array.isArray(boot) || boot === BOOT) return;
  BOOT = boot;
  setCardEdits(boot);
}

export function cardEditsVersion(): number {
  syncBoot();
  return VERSION;
}

export function cardEdit(id: string): CardEdit | undefined {
  syncBoot();
  return EDITS.get(id);
}

export function publishedCardEdits(): CardEdit[] {
  syncBoot();
  return [...EDITS.values()].filter((edit) => Boolean(edit.publishedCard) && !edit.hidden);
}

export function publishedCardRows(): CardEdit[] {
  return publishedCardEdits();
}

export function publishedCards(): Card[] {
  return publishedCardEdits().flatMap((edit) => {
    const card = edit.publishedCard;
    if (!card) return [];
    return [{ ...card, name: edit.name ?? card.name, rarity: edit.rarity ?? card.rarity,
      universe: (edit.universe as Card["universe"] | null) ?? (card.universe as Card["universe"]),
      emoji: edit.emoji ?? card.emoji, tagline: card.tagline ?? null, bio: card.bio ?? null,
      quote: card.quote ?? null, power: card.power ?? null } as Card];
  });
}

export function publishedCardEdit(id: string): CardEdit | undefined {
  syncBoot();
  const edit = EDITS.get(id);
  return edit?.publishedCard && !edit.hidden ? edit : undefined;
}

export function isHiddenCard(id: string): boolean {
  syncBoot();
  return EDITS.get(id)?.hidden === true;
}

export function applyCardEdit(card: Card): Card {
  syncBoot();
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

export function applyCardEdits(cards: Card[]): Card[] {
  return cards.filter((card) => !isHiddenCard(card.id)).map(applyCardEdit);
}

export function applyPublishedCardEdit(card: Card): Card {
  const edit = publishedCardEdit(card.id);
  if (!edit) return card;
  return {
    ...card,
    name: edit.name ?? card.name,
    rarity: edit.rarity ?? card.rarity,
    universe: (edit.universe as Card["universe"] | null) ?? card.universe,
    emoji: edit.emoji ?? card.emoji,
  };
}

syncBoot();
