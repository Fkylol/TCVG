import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  MAX_OFFER_MESSAGE,
  OFFER_DEFAULTS,
  OFFER_STATUS_LABEL,
  isOfferOpen,
  needsCounter,
  parseOfferBoard,
  type ChatOffer,
} from "../src/lib/chat/offers";
import { chatErrorText } from "../src/lib/chat/text";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const MIGRATION = read("supabase/migrations/033_echanges.sql");
const DISCORD_MIGRATION = read("supabase/migrations/045_discord_mp.sql");
const DIALOG = read("src/components/chat/offer-dialog.tsx");
const BOARD = read("src/components/chat/offers-board.tsx");
const ACTIONS = read("src/app/actions/swap.ts");
const MESSAGE = read("src/components/chat/chat-message.tsx");

/** Ligne brute telle que la renvoie `chat_offer_list()`. */
function offerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    status: "pending",
    message: "Ça te va ?",
    created_at: "2026-10-24T12:00:00.000Z",
    expires_at: "2026-10-25T12:00:00.000Z",
    offered_card_id: "arthas",
    offered_holo: false,
    requested_card_id: "yshtola",
    proposer: "Nova",
    proposer_avatar: null,
    proposer_frame: "steel",
    owner: "Kaito",
    owner_avatar: "link",
    owner_frame: "gold",
    direction: "in",
    ...overrides,
  };
}

test("échange : lecture d'une offre reçue, carte demandée comprise", () => {
  const board = parseOfferBoard({ ok: true, incoming: [offerRow()], outgoing: [] });
  assert.ok(board);
  assert.equal(board.incoming.length, 1);

  const offer = board.incoming[0];
  assert.equal(offer.id, 12);
  assert.equal(offer.status, "pending");
  assert.equal(offer.direction, "in");
  assert.equal(offer.offeredCardId, "arthas");
  assert.equal(offer.requestedCardId, "yshtola");
  assert.equal(offer.proposer.name, "Nova");
  assert.equal(offer.owner.avatarCardId, "link");
  assert.equal(offer.owner.frame, "gold");
});

test("échange : une offre « Je cherche » n'a pas de carte demandée", () => {
  const board = parseOfferBoard({
    ok: true,
    incoming: [offerRow({ requested_card_id: null, status: "countered" })],
    outgoing: [offerRow({ id: 13, direction: "out" })],
  });
  assert.ok(board);

  const incoming = board.incoming[0];
  assert.equal(incoming.requestedCardId, null);
  assert.equal(incoming.status, "countered");
  assert.equal(needsCounter(incoming), false, "une offre close n'attend plus rien");

  const pendingSeek = parseOfferBoard({
    ok: true,
    incoming: [offerRow({ requested_card_id: null })],
  });
  assert.ok(pendingSeek);
  assert.equal(needsCounter(pendingSeek.incoming[0]), true);

  assert.equal(board.outgoing[0].direction, "out");
});

test("échange : statut inconnu ramené à « en attente », refus sans tableau", () => {
  const board = parseOfferBoard({
    ok: true,
    incoming: [offerRow({ status: "pirate", direction: undefined })],
  });
  assert.ok(board);
  assert.equal(board.incoming[0].status, "pending");
  assert.equal(board.incoming[0].direction, "in");

  // La fonction n'est pas déployée : on ne fabrique pas un tableau vide.
  assert.equal(parseOfferBoard({ ok: false, reason: "error" }), null);
  assert.equal(parseOfferBoard("nope"), null);
});

test("échange : les réponses malformées ne cassent pas le tableau", () => {
  for (const incoming of [{}, "texte", [null], ["offre"], [[]]]) {
    assert.equal(parseOfferBoard({ ok: true, incoming, outgoing: [] }), null);
  }
  assert.equal(parseOfferBoard({ ok: true, incoming: [], outgoing: {} }), null);
  const board = parseOfferBoard({ ok: true, incoming: [offerRow({ status: "toString" })] });
  assert.equal(board?.incoming[0].status, "pending");
});

test("échange : une offre n'est ouverte que tant qu'elle vit", () => {
  const base: ChatOffer = {
    id: 1,
    status: "pending",
    direction: "in",
    message: "",
    createdAt: "2026-10-24T12:00:00.000Z",
    expiresAt: "2026-10-25T12:00:00.000Z",
    offeredCardId: "arthas",
    offeredHolo: false,
    requestedCardId: "yshtola",
    proposer: { name: "A", avatarCardId: null, frame: "steel" },
    owner: { name: "B", avatarCardId: null, frame: "steel" },
  };

  const before = Date.parse("2026-10-25T11:59:00.000Z");
  const after = Date.parse("2026-10-25T12:01:00.000Z");

  assert.equal(isOfferOpen(base, before), true);
  assert.equal(isOfferOpen(base, after), false, "expirée à l'échéance");
  assert.equal(isOfferOpen({ ...base, status: "accepted" }, before), false);
});

test("échange : libellés de statut complets", () => {
  for (const status of [
    "pending",
    "accepted",
    "declined",
    "countered",
    "expired",
    "cancelled",
    "removed",
  ] as const) {
    assert.ok(OFFER_STATUS_LABEL[status], `libellé manquant : ${status}`);
  }

  assert.equal(MAX_OFFER_MESSAGE, 100);
  assert.ok(OFFER_DEFAULTS.hours > 0);
  assert.ok(OFFER_DEFAULTS.activeMax > 0);
  assert.ok(OFFER_DEFAULTS.perDay >= OFFER_DEFAULTS.activeMax);
});

test("échange : chaque refus a un message lisible", () => {
  for (const reason of [
    "own_announcement",
    "blocked",
    "same_card",
    "not_requested_card",
    "offer_too_long",
    "too_many_offers",
    "offer_daily_limit",
    "need_copy",
    "needs_counter",
    "invalid_action",
  ]) {
    const message = chatErrorText(reason);
    assert.ok(message.length > 10, `message trop court pour ${reason}`);
    assert.notEqual(message, chatErrorText("inconnu"), `motif non traduit : ${reason}`);
  }
});

// ————— Garde-fous de la migration —————

test("échange : tables, séquestre et historique immuable", () => {
  assert.match(MIGRATION, /create table if not exists public\.chat_offers/);
  assert.match(MIGRATION, /create table if not exists public\.trades_swaps/);

  // Le séquestre passe par la collection, comme le marché.
  assert.match(MIGRATION, /update public\.collection c\s+set quantity = c\.quantity - 1/);
  assert.match(MIGRATION, /on conflict \(user_id, card_id\) do update/);

  // Un double-clic ne crée jamais deux échanges.
  assert.match(MIGRATION, /offer_id bigint not null unique/);
  assert.match(MIGRATION, /client_key uuid not null unique/);
  assert.match(MIGRATION, /before update or delete on public\.trades_swaps/);
});

test("échange : acceptation atomique et vérifications côté base", () => {
  // Verrou de l'offre : deux acceptations concurrentes ne peuvent pas gagner.
  assert.match(MIGRATION, /from public\.chat_offers o where o\.id = p_offer_id for update/);
  assert.match(MIGRATION, /for update skip locked/);

  // Annonce active, pas la sienne, pas de blocage, droit d'écrire.
  assert.match(MIGRATION, /own_announcement/);
  assert.match(MIGRATION, /public\.chat_blocks/);
  assert.match(MIGRATION, /public\.chat_can_write\(\)/);

  // Carte retirée : l'offre est annulée et la copie rendue.
  assert.match(MIGRATION, /v_reason := 'removed'/);
  assert.match(MIGRATION, /perform public\.chat_release_card\(/);

  // Expiration et notification.
  assert.match(MIGRATION, /v_reason := 'expired'/);
  assert.match(MIGRATION, /'swap_expired'/);
});

test("échange : écriture impossible en direct, actions réservées aux connectés", () => {
  assert.match(MIGRATION, /alter table public\.chat_offers enable row level security/);
  assert.match(MIGRATION, /alter table public\.trades_swaps enable row level security/);
  assert.match(MIGRATION, /revoke all on public\.chat_offers from authenticated/);
  assert.match(MIGRATION, /revoke all on public\.trades_swaps from authenticated/);

  for (const fn of ["chat_offer_create", "chat_offer_respond", "chat_offer_cancel", "chat_offer_list"]) {
    assert.match(
      MIGRATION,
      new RegExp(`grant execute on function public\\.${fn}[^;]+to authenticated;`),
      `action ${fn} non accordée aux joueurs`,
    );
  }

  // Les primitives de séquestre ne sortent pas du serveur.
  for (const fn of ["chat_escrow_card", "chat_release_card", "chat_offer_sweep"]) {
    assert.match(
      MIGRATION,
      new RegExp(`revoke all on function public\\.${fn}[^;]+from authenticated;`),
      `${fn} ne doit pas être appelable par un joueur`,
    );
  }
});

test("échange : la notification privée passe par le serveur, en Discord", () => {
  assert.match(ACTIONS, /notifyOfferByDiscord/);
  assert.match(ACTIONS, /sendDiscordDm/);
  assert.match(ACTIONS, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(DIALOG, /loadSwapCards/);

  // Le destinataire n'est renvoyé qu'au proposeur, et jamais au navigateur.
  assert.match(MIGRATION, /v_offer\.proposer_id <> v_uid/);

  // L'identifiant Discord vit dans une table que le client ne peut pas lire.
  assert.match(DISCORD_MIGRATION, /create table if not exists public\.discord_links/);
  assert.match(DISCORD_MIGRATION, /alter table public\.discord_links enable row level security/);
  assert.match(DISCORD_MIGRATION, /revoke all on public\.discord_links from anon, authenticated/);
  assert.match(DISCORD_MIGRATION, /provider = 'discord'/);
  assert.match(ACTIONS, /from\("discord_links"\)/);
});

test("échange : l'interface passe par les actions, jamais par la table", () => {
  assert.match(MESSAGE, /<OfferDialog/);
  assert.match(MESSAGE, /Proposer un échange/);
  assert.match(MESSAGE, /Faire une offre/);
  assert.match(BOARD, /accept|refuse/i);
  assert.match(BOARD, /OFFER_DISCORD_NOTE/);
  assert.match(ACTIONS, /chat_offer_create/);
  assert.match(ACTIONS, /chat_offer_respond/);
  assert.match(ACTIONS, /chat_offer_cancel/);

  // Aucun composant client n'écrit directement dans les tables d'échange.
  for (const source of [DIALOG, BOARD, MESSAGE]) {
    assert.doesNotMatch(source, /from\("chat_offers"\)/);
    assert.doesNotMatch(source, /from\("trades_swaps"\)/);
  }
});
