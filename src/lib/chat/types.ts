import type { ChatLanguage } from "./config";

/** Types partagés entre les requêtes serveur, les actions et l'interface. */

export type ChatRoom = {
  id: number;
  language: ChatLanguage;
  number: number;
  capacity: number;
  readOnly: boolean;
  /** Joueurs vus dans les 60 dernières secondes. */
  online: number;
};

export type ChatMessageKind = "text" | "have" | "want" | "system";

export type ChatAnnouncement = {
  id: number;
  kind: "have" | "want";
  status: "active" | "expired" | "withdrawn" | "removed";
  expiresAt: string;
};

export type ChatMessage = {
  id: number;
  roomId: number;
  kind: ChatMessageKind;
  body: string;
  /** Carte embarquée, résolue depuis le catalogue local. */
  cardId: string | null;
  createdAt: string;
  userId: string | null;
  username: string | null;
  avatarCardId: string | null;
  frame: string;
  mine: boolean;
  /** Exemplaires que **le lecteur** possède de la carte embarquée. */
  owned: number;
  announcement: ChatAnnouncement | null;
};

export type ChatSettings = {
  historyPage: number;
  retentionDays: number;
  rateSeconds: number;
  ratePerMinute: number;
  maxAnnouncements: number;
  announcementMinutes: number;
  unlockBoosters: number;
  unlockHours: number;
};

/**
 * Droit d'écrire, décidé en base : déblocage progressif et sanction.
 * `ok: false` porte toujours une raison lisible par `chatErrorText`.
 */
export type ChatWriteGate = {
  ok: boolean;
  reason: string | null;
  muted: boolean;
  mutedUntil: string | null;
  unlocked: boolean;
  boosters: number;
  boostersNeeded: number;
  hoursLeft: number;
  hoursNeeded: number;
};

export type ChatState = {
  rooms: ChatRoom[];
  language: ChatLanguage;
  roomId: number | null;
  hideAnnouncements: boolean;
  canWrite: ChatWriteGate;
  blocked: string[];
  admin: boolean;
  unread: number;
  myAnnouncements: number;
  settings: ChatSettings;
};

export type ChatPage = { messages: ChatMessage[]; hasMore: boolean };

export type ChatAdminContextMessage = {
  id: number;
  username: string | null;
  body: string;
  kind: ChatMessageKind;
};

export type ChatAdminReport = {
  id: number;
  reason: string;
  note: string | null;
  createdAt: string;
  reportedBy: string | null;
  message: {
    id: number;
    roomId: number;
    kind: ChatMessageKind;
    body: string;
    createdAt: string;
    userId: string | null;
    username: string | null;
    deletedAt: string | null;
  } | null;
  before: ChatAdminContextMessage[];
  after: ChatAdminContextMessage[];
};

export type ChatAdminSanction = {
  id: number;
  userId: string;
  username: string | null;
  until: string | null;
  reason: string;
  createdAt: string;
};

export type ChatAdminAudit = {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  reason: string | null;
  createdAt: string;
};

export type ChatAdminQueue = {
  reports: ChatAdminReport[];
  sanctions: ChatAdminSanction[];
  audit: ChatAdminAudit[];
};

// ————— Lecture du JSON renvoyé par la base —————
// Les clés SQL sont en `snake_case` ; tout est converti ici, une fois.

type Raw = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRoom(row: Raw): ChatRoom {
  return {
    id: number(row.id),
    language: (text(row.language) ?? "fr") as ChatLanguage,
    number: number(row.number),
    capacity: number(row.capacity),
    readOnly: row.read_only === true,
    online: number(row.online),
  };
}

function parseMessage(row: Raw): ChatMessage {
  const payload = (row.payload ?? {}) as Raw;
  const announcement = row.announcement as Raw | null;
  const kind = (text(row.kind) ?? "text") as ChatMessageKind;

  return {
    id: number(row.id),
    roomId: number(row.room_id),
    kind,
    body: text(row.body) ?? "",
    cardId: text(payload.card_id),
    createdAt: text(row.created_at) ?? new Date(0).toISOString(),
    userId: text(row.user_id),
    username: text(row.username),
    avatarCardId: text(row.avatar_card_id),
    frame: text(row.frame) ?? "steel",
    mine: row.mine === true,
    owned: number(row.owned),
    announcement: announcement
      ? {
          id: number(announcement.id),
          kind: (text(announcement.kind) ?? "have") as "have" | "want",
          status: (text(announcement.status) ?? "active") as ChatAnnouncement["status"],
          expiresAt: text(announcement.expires_at) ?? "",
        }
      : null,
  };
}

function parseGate(value: unknown): ChatWriteGate {
  const row = (value ?? {}) as Raw;
  const reason = text(row.reason);

  return {
    ok: row.ok === true,
    reason,
    muted: row.muted === true || reason === "muted",
    mutedUntil: text(row.muted_until),
    unlocked: row.unlocked === true,
    boosters: number(row.boosters),
    boostersNeeded: number(row.boosters_needed),
    hoursLeft: number(row.hours_left),
    hoursNeeded: number(row.hours_needed),
  };
}

function parseSettings(value: unknown): ChatSettings {
  const row = (value ?? {}) as Raw;
  return {
    historyPage: number(row.history_page) || 50,
    retentionDays: number(row.retention_days) || 7,
    rateSeconds: number(row.rate_seconds) || 3,
    ratePerMinute: number(row.rate_per_minute) || 20,
    maxAnnouncements: number(row.max_announcements) || 3,
    announcementMinutes: number(row.announcement_minutes) || 30,
    unlockBoosters: number(row.unlock_boosters) || 20,
    unlockHours: number(row.unlock_hours) || 24,
  };
}

export function parseChatState(value: unknown): ChatState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Raw;

  return {
    rooms: ((row.rooms ?? []) as Raw[]).map(parseRoom),
    language: (text(row.language) ?? "fr") as ChatLanguage,
    roomId: row.room_id == null ? null : number(row.room_id),
    hideAnnouncements: row.hide_announcements === true,
    canWrite: parseGate(row.can_write),
    blocked: ((row.blocked ?? []) as unknown[]).filter(
      (id): id is string => typeof id === "string",
    ),
    admin: row.admin === true,
    unread: number(row.unread),
    myAnnouncements: number(row.my_announcements),
    settings: parseSettings(row.settings),
  };
}

export function parseChatPage(value: unknown): ChatPage {
  if (!value || typeof value !== "object") return { messages: [], hasMore: false };
  const row = value as Raw;

  return {
    messages: ((row.messages ?? []) as Raw[]).map(parseMessage),
    hasMore: row.has_more === true,
  };
}

function parseContext(rows: unknown): ChatAdminContextMessage[] {
  return ((rows ?? []) as Raw[]).map((row) => ({
    id: number(row.id),
    username: text(row.username),
    body: text(row.body) ?? "",
    kind: (text(row.kind) ?? "text") as ChatMessageKind,
  }));
}

export type ChatUserHistoryEntry = {
  id: number;
  body: string;
  kind: ChatMessageKind;
  createdAt: string;
  deletedAt: string | null;
};

export type ChatUserHistory = {
  username: string | null;
  messages: ChatUserHistoryEntry[];
  sanctions: {
    id: number;
    until: string | null;
    reason: string;
    createdAt: string;
    liftedAt: string | null;
  }[];
};

/** Historique complet d'un joueur, réservé à la modération. */
export function parseChatUserHistory(value: unknown): ChatUserHistory | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Raw;
  if (row.ok !== true) return null;

  return {
    username: text(row.username),
    messages: ((row.messages ?? []) as Raw[]).map((message) => ({
      id: number(message.id),
      body: text(message.body) ?? "",
      kind: (text(message.kind) ?? "text") as ChatMessageKind,
      createdAt: text(message.created_at) ?? "",
      deletedAt: text(message.deleted_at),
    })),
    sanctions: ((row.sanctions ?? []) as Raw[]).map((sanction) => ({
      id: number(sanction.id),
      until: text(sanction.until),
      reason: text(sanction.reason) ?? "",
      createdAt: text(sanction.created_at) ?? "",
      liftedAt: text(sanction.lifted_at),
    })),
  };
}

export function parseChatAdminQueue(value: unknown): ChatAdminQueue | null {
  if (!value || typeof value !== "object" || value === null) return null;
  const row = value as Raw;
  if (row.ok === false) return null;

  return {
    reports: ((row.reports ?? []) as Raw[]).map((report) => {
      const message = report.message as Raw | null;
      return {
        id: number(report.id),
        reason: text(report.reason) ?? "other",
        note: text(report.note),
        createdAt: text(report.created_at) ?? "",
        reportedBy: text(report.reporter),
        message: message
          ? {
              id: number(message.id),
              roomId: number(message.room_id),
              kind: (text(message.kind) ?? "text") as ChatMessageKind,
              body: text(message.body) ?? "",
              createdAt: text(message.created_at) ?? "",
              userId: text(message.user_id),
              username: text(message.username),
              deletedAt: text(message.deleted_at),
            }
          : null,
        before: parseContext(report.before),
        after: parseContext(report.after),
      };
    }),
    sanctions: ((row.sanctions ?? []) as Raw[]).map((sanction) => ({
      id: number(sanction.id),
      userId: text(sanction.user_id) ?? "",
      username: text(sanction.username),
      until: text(sanction.until),
      reason: text(sanction.reason) ?? "",
      createdAt: text(sanction.created_at) ?? "",
    })),
    audit: ((row.audit ?? []) as Raw[]).map((entry) => ({
      id: number(entry.id),
      actor: text(entry.actor),
      action: text(entry.action) ?? "",
      target: text(entry.target),
      reason: text(entry.reason),
      createdAt: text(entry.created_at) ?? "",
    })),
  };
}
