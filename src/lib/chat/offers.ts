/**
 * Échanges carte contre carte (C4 de L'Agora).
 *
 * La base tranche tout : séquestre, limites, expiration, acceptation
 * atomique. Ce module ne fait que typer et lire les réponses, plus quelques
 * constantes d'affichage et de repli.
 */

/** Durée d'une offre, plafonds par joueur (miroir des réglages SQL `chat_offer*`). */
export const OFFER_DEFAULTS = {
  hours: 24,
  activeMax: 5,
  perDay: 10,
} as const;

/** Longueur maximale du message joint à une proposition. */
export const MAX_OFFER_MESSAGE = 100;

export type ChatOfferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "countered"
  | "expired"
  | "cancelled"
  | "removed";

export type ChatOfferDirection = "in" | "out";

export type OfferPlayer = {
  name: string;
  avatarCardId: string | null;
  frame: string;
};

export type ChatOffer = {
  id: number;
  status: ChatOfferStatus;
  direction: ChatOfferDirection;
  message: string;
  createdAt: string;
  expiresAt: string;
  /** Carte apportée par le proposeur (séquestrée tant que l'offre vit). */
  offeredCardId: string;
  offeredHolo: boolean;
  /**
   * Carte demandée. `null` quand l'offre répond à « Je cherche » : le
   * destinataire choisit ce qu'il donne en contre-proposant.
   */
  requestedCardId: string | null;
  proposer: OfferPlayer;
  owner: OfferPlayer;
};

export type ChatOfferBoard = {
  incoming: ChatOffer[];
  outgoing: ChatOffer[];
};

export const OFFER_STATUS_LABEL: Record<ChatOfferStatus, string> = {
  pending: "En attente",
  accepted: "Échangée",
  declined: "Refusée",
  countered: "Contre-proposée",
  expired: "Expirée",
  cancelled: "Retirée",
  removed: "Annulée",
};

/** Une offre encore vivante peut être acceptée, refusée ou retirée. */
export function isOfferOpen(offer: ChatOffer, now = Date.now()): boolean {
  return offer.status === "pending" && new Date(offer.expiresAt).getTime() > now;
}

/** Une offre « Je cherche » attend une contre-proposition avant tout échange. */
export function needsCounter(offer: ChatOffer): boolean {
  return offer.status === "pending" && offer.requestedCardId === null;
}

type Raw = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStatus(value: unknown): ChatOfferStatus {
  const status = text(value);
  return status && Object.prototype.hasOwnProperty.call(OFFER_STATUS_LABEL, status)
    ? (status as ChatOfferStatus)
    : "pending";
}

function parsePlayer(name: unknown, avatar: unknown, frame: unknown): OfferPlayer {
  return {
    name: text(name) ?? "Joueur",
    avatarCardId: text(avatar),
    frame: text(frame) ?? "steel",
  };
}

function parseOffer(row: Raw): ChatOffer {
  return {
    id: number(row.id),
    status: parseStatus(row.status),
    direction: row.direction === "out" ? "out" : "in",
    message: text(row.message) ?? "",
    createdAt: text(row.created_at) ?? new Date(0).toISOString(),
    expiresAt: text(row.expires_at) ?? new Date(0).toISOString(),
    offeredCardId: text(row.offered_card_id) ?? "",
    offeredHolo: row.offered_holo === true,
    requestedCardId: text(row.requested_card_id),
    proposer: parsePlayer(row.proposer, row.proposer_avatar, row.proposer_frame),
    owner: parsePlayer(row.owner, row.owner_avatar, row.owner_frame),
  };
}

/** Lecture de `chat_offer_list()` ; `null` si la fonction n'est pas déployée. */
export function parseOfferBoard(value: unknown): ChatOfferBoard | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Raw;
  if (row.ok === false) return null;
  const incoming = row.incoming ?? [];
  const outgoing = row.outgoing ?? [];
  const validRows = (items: unknown): items is Raw[] =>
    Array.isArray(items) && items.every((item) => item !== null && typeof item === "object" && !Array.isArray(item));
  if (!validRows(incoming) || !validRows(outgoing)) return null;

  return {
    incoming: incoming.map(parseOffer),
    outgoing: outgoing.map(parseOffer),
  };
}

/** Note affichée à la place de l'ancienne préférence e-mail. */
export const OFFER_DISCORD_NOTE =
  "Chaque proposition t'est aussi envoyée en message privé sur Discord, par le bot du jeu.";
