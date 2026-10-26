import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  APP_CHAT_NAME,
  CHAT_LANGUAGES,
  CHAT_DEFAULTS,
  MAX_CHAT_BODY,
  chatLanguageInfo,
  chatRoomLabel,
  formatChatTime,
  formatRemaining,
} from "../src/lib/chat/config";
import {
  checkChatBody,
  chatErrorText,
  containsLink,
  isShouting,
  maskBannedWords,
  normalizeChatBody,
  sentenceCase,
} from "../src/lib/chat/text";
import {
  parseChatAdminQueue,
  parseChatPage,
  parseChatState,
  parseChatUserHistory,
} from "../src/lib/chat/types";

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/031_agora.sql"),
  "utf8",
);

// ————— Configuration —————
test("Agora : nom, langues et valeurs de repli cohérents", () => {
  assert.equal(APP_CHAT_NAME, "L'Agora");
  assert.equal(new Set(CHAT_LANGUAGES.map((item) => item.key)).size, 4);
  assert.ok(CHAT_LANGUAGES.every((item) => item.label && item.short));
  assert.equal(chatLanguageInfo("int").label, "International");
  assert.equal(chatRoomLabel("fr", 2), "Français · Salon 2");

  for (const value of Object.values(CHAT_DEFAULTS)) {
    assert.ok(value > 0, "toutes les limites doivent être positives");
  }
  assert.equal(MAX_CHAT_BODY, 300);
});

test("Agora : réglages lus depuis la base, avec les mêmes replis", () => {
  // Les constantes TypeScript doivent rester le miroir des clés SQL : une
  // divergence créerait un décalage entre le message affiché et le refus réel.
  for (const key of [
    "chat_history_page",
    "chat_retention_days",
    "chat_rate_seconds",
    "chat_rate_per_minute",
    "chat_max_announcements",
    "chat_announcement_minutes",
    "chat_unlock_boosters",
    "chat_unlock_hours",
  ]) {
    assert.ok(MIGRATION.includes(`'${key}'`), `réglage ${key} absent de la migration`);
  }
});

// ————— Texte —————
test("texte : nettoyage des caractères de contrôle et des espaces", () => {
  assert.equal(normalizeChatBody("  bonjour\n\n  le   monde  "), "bonjour le monde");
  assert.equal(normalizeChatBody("salut\u0000\u001b"), "salut");
  assert.equal(normalizeChatBody("   "), "");
});

test("texte : longueur maximale de 300 caractères", () => {
  assert.equal(checkChatBody("a".repeat(300)).ok, true);
  const tooLong = checkChatBody("a".repeat(301));
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.ok === false && tooLong.reason, "too_long");

  // Les emoji comptent pour un caractère, comme `char_length` en base.
  assert.equal(checkChatBody("🎴".repeat(300)).ok, true);
});

test("texte : vide refusé, sauf pour une annonce", () => {
  const empty = checkChatBody("   ");
  assert.equal(empty.ok, false);
  assert.equal(empty.ok === false && empty.reason, "empty");
  assert.deepEqual(checkChatBody("   ", true), { ok: true, body: "" });
});

test("texte : liens refusés sous toutes leurs formes", () => {
  for (const value of [
    "https://exemple.com",
    "http://tcv.fun/carte",
    "www.exemple.fr",
    "viens sur discord.gg/abc",
    "mon site exemple.io",
  ]) {
    assert.ok(containsLink(value), `lien non détecté : ${value}`);
    const check = checkChatBody(value);
    assert.equal(check.ok, false, `message accepté : ${value}`);
    assert.equal(check.ok === false && check.reason, "links_forbidden");
  }

  // Le texte normal reste accepté, y compris les nombres à virgule et les
  // abréviations courantes.
  for (const value of [
    "Bonjour à tous !",
    "Je cherche 2 cartes, pas 3.",
    "La carte #12 est à 4.5 étoiles",
    "J'ai fini mes boosters",
  ]) {
    assert.equal(containsLink(value), false, `faux positif : ${value}`);
    assert.equal(checkChatBody(value).ok, true);
  }
});

test("texte : majuscules abusives adoucies", () => {
  assert.equal(isShouting("SALUT TOUT LE MONDE"), true);
  assert.equal(isShouting("OK"), false);
  assert.equal(isShouting("Salut tout le monde"), false);
  assert.equal(sentenceCase("SALUT TOUT LE MONDE"), "Salut tout le monde");
  assert.equal(sentenceCase(""), "");
});

test("texte : mots interdits masqués, casse comprise", () => {
  const words = ["connard", "idiot"];
  assert.equal(maskBannedWords("espèce de connard", words), "espèce de •••••••");
  assert.equal(maskBannedWords("CONNARD", words), "•••••••");
  // Seul le mot interdit est masqué : le pluriel garde sa marque, comme en
  // base (`overlay` remplace exactement la longueur du mot).
  assert.equal(maskBannedWords("un idiot, deux idiots", words), "un •••••, deux •••••s");
  assert.equal(maskBannedWords("tout va bien", words), "tout va bien");
  // Un mot de trois lettres ne doit pas boucler : chaque occurrence est
  // remplacée une fois, puis la recherche reprend après le masque.
  assert.equal(maskBannedWords("bbb bbb", ["bbb"]), "••• •••");
});

test("texte : messages d'erreur lisibles pour chaque motif", () => {
  const reasons = [
    "empty",
    "too_long",
    "links_forbidden",
    "too_fast",
    "rate_limited",
    "flood",
    "muted",
    "locked",
    "read_only",
    "need_duplicate",
    "already_owned",
    "card_unavailable",
    "too_many",
    "not_admin",
    "room_full",
    "forbidden",
    "not_active",
    "unknown_room",
  ];

  for (const reason of reasons) {
    const message = chatErrorText(reason);
    assert.ok(message.length > 10, `message trop court pour ${reason}`);
    assert.notEqual(message, chatErrorText("inconnu"), `motif non traduit : ${reason}`);
  }
});

test("heures et expirations : rendu stable", () => {
  // Fuseau fixe : le serveur et le navigateur affichent la même chose.
  assert.equal(formatChatTime("2026-01-01T12:00:00.000Z"), "13:00");
  assert.equal(formatChatTime("pas une date"), "");

  const now = Date.parse("2026-01-01T12:00:00.000Z");
  assert.equal(formatRemaining("2026-01-01T12:12:00.000Z", now), "12 min");
  assert.equal(formatRemaining("2026-01-01T13:00:00.000Z", now), "1 h");
  assert.equal(formatRemaining("2026-01-01T13:05:00.000Z", now), "1 h 05");
  assert.equal(formatRemaining("2026-01-01T11:00:00.000Z", now), "expirée");
});

// ————— Lecture du JSON de la base —————
const roomRow = {
  id: 1,
  language: "fr",
  number: 1,
  capacity: 150,
  read_only: false,
  online: 3,
};

const messageRow = {
  id: 42,
  room_id: 1,
  kind: "have",
  body: "Un doublon à échanger",
  payload: { card_id: "c1" },
  created_at: "2026-01-01T12:00:00.000Z",
  user_id: "u2",
  username: "Joueur",
  avatar_card_id: null,
  frame: "steel",
  mine: false,
  owned: 2,
  announcement: {
    id: 7,
    kind: "have",
    status: "active",
    expires_at: "2026-01-01T12:30:00.000Z",
  },
};

test("état : salons, préférences et droit d'écriture", () => {
  const state = parseChatState({
    rooms: [roomRow],
    language: "fr",
    room_id: 1,
    hide_announcements: false,
    can_write: {
      ok: false,
      reason: "locked",
      boosters: 14,
      boosters_needed: 6,
      hours_left: 3.5,
      hours_needed: 24,
    },
    blocked: ["u9"],
    admin: true,
    unread: 4,
    my_announcements: 1,
    settings: { history_page: 50, retention_days: 7 },
  });

  assert.ok(state);
  assert.equal(state.rooms[0].online, 3);
  assert.equal(state.rooms[0].readOnly, false);
  assert.equal(state.canWrite.ok, false);
  assert.equal(state.canWrite.reason, "locked");
  assert.equal(state.canWrite.boostersNeeded, 6);
  assert.equal(state.settings.historyPage, 50);
  assert.equal(state.settings.retentionDays, 7);
  assert.equal(state.settings.ratePerMinute, 20, "repli quand le réglage manque");
  assert.deepEqual(state.blocked, ["u9"]);
  assert.equal(state.admin, true);

  assert.equal(parseChatState(null), null);
  assert.equal(parseChatState("nope"), null);
});

test("fil : message, carte embarquée et « owned » du lecteur", () => {
  const page = parseChatPage({ messages: [messageRow], has_more: true });

  assert.equal(page.hasMore, true);
  assert.equal(page.messages.length, 1);

  const message = page.messages[0];
  assert.equal(message.id, 42);
  assert.equal(message.kind, "have");
  assert.equal(message.cardId, "c1");
  assert.equal(message.owned, 2);
  assert.equal(message.mine, false);
  assert.equal(message.announcement?.status, "active");

  // Message système : pas de carte, pas d'annonce.
  const system = parseChatPage({
    messages: [
      {
        id: 1,
        room_id: 1,
        kind: "system",
        body: "Joueur entre dans le salon.",
        payload: { event: "join" },
        created_at: "2026-01-01T12:00:00.000Z",
        user_id: null,
      },
    ],
    has_more: false,
  }).messages[0];

  assert.equal(system.cardId, null);
  assert.equal(system.announcement, null);
  assert.equal(system.username, null);

  assert.deepEqual(parseChatPage(null), { messages: [], hasMore: false });
});

test("modération : file, contexte et refus", () => {
  const queue = parseChatAdminQueue({
    ok: true,
    reports: [
      {
        id: 3,
        reason: "spam",
        note: null,
        created_at: "2026-01-01T12:00:00.000Z",
        reporter: "Modo",
        message: {
          id: 42,
          room_id: 1,
          kind: "text",
          body: "achetez ma carte",
          created_at: "2026-01-01T11:59:00.000Z",
          user_id: "u2",
          username: "Joueur",
          deleted_at: null,
        },
        before: [{ id: 41, username: "A", body: "salut", kind: "text" }],
        after: [],
      },
    ],
    sanctions: [
      {
        id: 1,
        user_id: "u2",
        username: "Joueur",
        until: null,
        reason: "récidive",
        created_at: "2026-01-01T12:00:00.000Z",
      },
    ],
    audit: [
      {
        id: 9,
        actor: "Modo",
        action: "mute",
        target: "Joueur",
        reason: "récidive",
        created_at: "2026-01-01T12:00:00.000Z",
      },
    ],
  });

  assert.ok(queue);
  assert.equal(queue.reports.length, 1);
  assert.equal(queue.reports[0].reportedBy, "Modo");
  assert.equal(queue.reports[0].message?.username, "Joueur");
  assert.equal(queue.reports[0].before[0].body, "salut");
  assert.equal(queue.sanctions[0].until, null);
  assert.equal(queue.audit[0].action, "mute");

  // Un joueur qui forcerait l'appel ne reçoit rien.
  assert.equal(parseChatAdminQueue({ ok: false, reason: "not_admin" }), null);
});

test("modération : historique d'un joueur, messages supprimés compris", () => {
  const history = parseChatUserHistory({
    ok: true,
    username: "Joueur",
    messages: [
      {
        id: 5,
        body: "message retiré",
        kind: "text",
        created_at: "2026-01-01T12:00:00.000Z",
        deleted_at: "2026-01-01T12:05:00.000Z",
      },
      {
        id: 4,
        body: "",
        kind: "have",
        created_at: "2026-01-01T11:00:00.000Z",
        deleted_at: null,
      },
    ],
    sanctions: [
      { id: 1, until: null, reason: "récidive", created_at: "2026-01-01T12:00:00.000Z", lifted_at: null },
    ],
  });

  assert.ok(history);
  assert.equal(history.username, "Joueur");
  assert.equal(history.messages.length, 2);
  assert.ok(history.messages[0].deletedAt);
  assert.equal(history.sanctions[0].until, null);
  assert.equal(parseChatUserHistory({ ok: false, reason: "not_admin" }), null);
});

// ————— Garde-fous de la migration —————
test("migration : écriture impossible en direct, lecture ouverte à Realtime", () => {
  assert.ok(MIGRATION.includes("enable row level security"));
  assert.ok(MIGRATION.includes("create policy \"chat_messages: lecture\""));
  assert.ok(MIGRATION.includes("grant select on public.chat_messages to authenticated"));
  assert.ok(
    !/grant\s+(insert|update|delete)[^;]*on public\.chat_messages/i.test(MIGRATION),
    "les joueurs ne doivent pas écrire directement dans chat_messages",
  );
  assert.ok(MIGRATION.includes("alter publication supabase_realtime add table"));
  assert.ok(MIGRATION.includes("deleted_at is null and not public.chat_is_blocked"));
});

test("migration : contrôles serveur présents avant toute insertion", () => {
  for (const control of [
    "chat_can_write()",
    "chat_rate_gate",
    "chat_clean_body",
    "links_forbidden",
    "chat_mask_words",
    "chat_setting('chat_retention_days'",
  ]) {
    assert.ok(MIGRATION.includes(control), `contrôle manquant : ${control}`);
  }

  // Une annonce « j'échange » exige un doublon, « je cherche » une carte
  // absente ou dans les envies.
  assert.ok(MIGRATION.includes("v_owned, 0) < 2"));
  assert.ok(MIGRATION.includes("already_owned"));
});

test("fiche carte : annonce dans le salon courant, mêmes bornes que la base", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "src/app/(game)/card/[id]/page.tsx"),
    "utf8",
  );
  const action = fs.readFileSync(
    path.join(process.cwd(), "src/app/actions/chat.ts"),
    "utf8",
  );
  const component = fs.readFileSync(
    path.join(process.cwd(), "src/components/chat/card-announce.tsx"),
    "utf8",
  );

  // Les boutons n'apparaissent que dans les deux cas acceptés par
  // `chat_announce` : doublon pour « j'échange », carte absente ou en envie
  // pour « je cherche ».
  assert.ok(page.includes("canOffer={quantity >= 2}"));
  assert.ok(page.includes("canSeek={!owned || wishlisted}"));

  // Le salon n'est pas choisi par la page : `chat_join` reprend celui du
  // joueur, puis l'annonce passe par la même fonction que le panneau.
  const entry = action.slice(action.indexOf("export async function announceCardHere"));
  assert.ok(entry.length > 0, "action announceCardHere absente");
  assert.ok(entry.includes('rpc("chat_join"'));
  assert.ok(entry.includes("publishAnnouncement("));
  assert.ok(component.includes("announceCardHere"));
  assert.ok(!component.includes("roomId"), "la fiche ne doit pas fixer le salon à la main");
});

test("annonce : fenêtre légère, saisie différée et tri sans collateur par ligne", () => {
  const composer = fs.readFileSync(
    path.join(process.cwd(), "src/components/chat/chat-composer.tsx"),
    "utf8",
  );

  // Le backdrop-filter plein écran recalculait le flou à chaque frappe.
  assert.ok(!composer.includes("backdrop-blur"), "flou plein écran retiré de la modale");
  // La liste se recalcule sur une valeur différée : la saisie reste fluide.
  assert.ok(composer.includes("useDeferredValue(query)"));
  // Un seul collateur pour tout le tri, pas un par comparaison.
  assert.ok(composer.includes('new Intl.Collator("fr")'));
  assert.ok(composer.includes("SORT_FR.compare"));
});
