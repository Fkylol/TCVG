import { MAX_CHAT_BODY } from "./config";

/**
 * Validation du texte d'un message — miroir des contrôles SQL de la migration
 * 031. Le client s'en sert pour un retour immédiat, la base refait tout : une
 * requête forgée ne passe pas.
 */

/**
 * Domaines refusés : un lien dans un chat public sert presque toujours à
 * sortir les joueurs du site (arnaques, serveurs tiers). Le motif est
 * volontairement large.
 */
const LINK_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9][a-z0-9-]*\.(com|net|org|fr|be|ch|ca|io|gg|ly|me|tv|co|xyz|info|app|dev|shop|site|online|ru|cn|uk|de|es|it|nl|pt)(\b|\/))/i;

/** Nettoie sans valider : caractères de contrôle, espaces multiples, bords. */
export function normalizeChatBody(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsLink(text: string): boolean {
  return LINK_PATTERN.test(text);
}

/**
 * Majuscules abusives : au moins 15 lettres, toutes en capitales. Le message
 * n'est pas refusé, il est ramené en casse de phrase.
 */
export function isShouting(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 15) return false;
  return letters === letters.toUpperCase();
}

export function sentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/** Masque les mots interdits par des puces, sans toucher au reste. */
export function maskBannedWords(text: string, words: readonly string[]): string {
  let result = text;
  for (const word of words) {
    if (!word) continue;
    let index = result.toLowerCase().indexOf(word.toLowerCase());
    while (index !== -1) {
      result =
        result.slice(0, index) + "•".repeat(word.length) + result.slice(index + word.length);
      index = result.toLowerCase().indexOf(word.toLowerCase(), index + word.length);
    }
  }
  return result;
}

export type ChatBodyCheck =
  | { ok: true; body: string }
  | { ok: false; reason: "empty" | "too_long" | "links_forbidden" };

/**
 * Valide et prépare un message. `allowEmpty` sert aux annonces : la carte
 * embarquée suffit, le texte est facultatif.
 */
export function checkChatBody(raw: string, allowEmpty = false): ChatBodyCheck {
  const body = normalizeChatBody(raw);

  if (body.length === 0) {
    return allowEmpty ? { ok: true, body } : { ok: false, reason: "empty" };
  }

  // Les caractères sont comptés comme en base : `char_length` compte les
  // points de code, `Array.from` aussi (contrairement à `.length`).
  if (Array.from(body).length > MAX_CHAT_BODY) {
    return { ok: false, reason: "too_long" };
  }

  if (containsLink(body)) {
    return { ok: false, reason: "links_forbidden" };
  }

  return { ok: true, body };
}

/** Messages d'erreur rendus au joueur, à partir du motif renvoyé par la base. */
export function chatErrorText(reason: string | null | undefined): string {
  switch (reason) {
    case "empty":
      return "Écris un message avant de l'envoyer.";
    case "too_long":
      return `${MAX_CHAT_BODY} caractères maximum.`;
    case "links_forbidden":
      return "Les liens ne sont pas autorisés ici : décris ce que tu cherches en texte.";
    case "too_fast":
      return "Doucement : un message toutes les 3 secondes.";
    case "rate_limited":
      return "Tu as atteint la limite de messages par minute. Réessaie dans un instant.";
    case "flood":
      return "Tu répètes le même message : varie un peu.";
    case "muted":
      return "Tu es réduit au silence pour le moment.";
    case "locked":
      return "L'écriture s'ouvre après un peu d'activité : ouvre des boosters et laisse ton compte vieillir.";
    case "read_only":
      return "Ce salon est en lecture seule.";
    case "need_duplicate":
      return "Il te faut au moins deux exemplaires pour proposer cette carte.";
    case "already_owned":
      return "Tu possèdes déjà cette carte : ajoute-la à tes envies pour la chercher.";
    case "card_unavailable":
      return "Cette carte n'est plus échangeable.";
    case "too_many":
      return "Trois annonces actives au maximum : retire-en une avant d'en créer une autre.";
    case "not_admin":
      return "Action réservée à la modération.";
    case "room_full":
      return "Ce salon est complet : choisis-en un autre.";
    case "forbidden":
      return "Action non autorisée.";
    case "invalid_user":
      return "Ce joueur ne peut pas être bloqué.";
    case "not_active":
      return "Cette proposition n'est plus active.";
    case "own_announcement":
      return "C'est ta propre annonce : attends qu'un joueur te propose une carte.";
    case "blocked":
      return "Le blocage entre vous empêche cet échange.";
    case "same_card":
      return "Choisis une autre carte que celle de l'annonce.";
    case "not_requested_card":
      return "Cette annonce cherche une carte précise : propose celle-là.";
    case "offer_too_long":
      return "100 caractères maximum pour le message d'un échange.";
    case "too_many_offers":
      return "Trop d'échanges en attente : retire-en un avant d'en proposer un autre.";
    case "offer_daily_limit":
      return "Tu as atteint ta limite de propositions pour aujourd'hui.";
    case "need_copy":
      return "Tu n'as plus de copie disponible de cette carte.";
    case "needs_counter":
      return "Propose d'abord une carte en retour : cette annonce n'en désigne aucune.";
    case "invalid_action":
      return "Action inconnue sur cette proposition.";
    case "unknown_room":
      return "Ce salon n'existe plus.";
    case "no_room":
      return "Aucun salon disponible pour le moment.";
    default:
      return "L'action n'a pas abouti. Réessaie dans un instant.";
  }
}
