import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FRAMES,
  FRAME_TOTAL,
  evaluateFrameSet,
  frameDisplayName,
  frameProgress,
  getFrame,
  nextFrameToUnlock,
  resolveSelectedFrame,
  type FrameDefinition,
  type FrameEvaluation,
  type FrameLane,
  type FrameProgress,
  type FrameStats,
  type PendingFrame,
  type UnlockedFrame,
} from "@/lib/frames.config";

/**
 * Côté serveur des cadres : lecture des statistiques agrégées, évaluation et
 * écriture. Aucune collection n'est chargée carte par carte : `frame_stats`
 * renvoie des compteurs déjà agrégés par la base, et `frame_apply` applique le
 * résultat en une transaction, avec la contrainte d'unicité `(user_id,
 * frame_id)`.
 */

export type FrameStatsPayload = FrameStats & {
  selectedFrameId: string | null;
  unlocked: UnlockedFrame[];
  pending: PendingFrame[];
  disabled: string[];
};

export type FrameView = {
  id: string;
  name: string;
  lane: FrameLane;
  prestige: number;
  secret: boolean;
  description: string;
  hiddenHint: string | null;
  colors: readonly string[];
  gradient: "linear" | "conic";
  animated: boolean;
  motif: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  active: boolean;
  soon: boolean;
  expired: boolean;
  progress: FrameProgress | null;
};

export type FrameOverview = {
  frames: FrameView[];
  unlockedCount: number;
  activeTotal: number;
  selectedFrameId: string;
  bestFrameId: string;
  next: { frameId: string; name: string; remaining: string; percent: number } | null;
  stats: FrameStats;
  disabled: string[];
};

const EMPTY_STATS: FrameStats = {
  totalActive: 0,
  ownedDistinct: 0,
  rarities: { UR: { total: 0, owned: 0 }, L: { total: 0, owned: 0 } },
  genres: {},
  franchises: [],
  sales: 0,
  referralsPaid: 0,
  boostersOpened: 0,
  streakDays: 0,
  createdAt: new Date(0).toISOString(),
  lastSeenAt: null,
};

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseUnlocked(value: unknown): UnlockedFrame[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = object(entry);
    const frameId = typeof row.frameId === "string" ? row.frameId : null;
    const unlockedAt = typeof row.unlockedAt === "string" ? row.unlockedAt : null;
    return frameId ? [{ frameId, unlockedAt: unlockedAt ?? new Date(0).toISOString() }] : [];
  });
}

function parsePending(value: unknown): PendingFrame[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = object(entry);
    const frameId = typeof row.frameId === "string" ? row.frameId : null;
    const firstMetAt = typeof row.firstMetAt === "string" ? row.firstMetAt : null;
    return frameId ? [{ frameId, firstMetAt: firstMetAt ?? new Date(0).toISOString() }] : [];
  });
}

function parseStats(value: unknown): FrameStatsPayload | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const rarities = object(row.rarities);
  const genres = object(row.genres);

  return {
    totalActive: number(row.totalActive),
    ownedDistinct: number(row.ownedDistinct),
    rarities: {
      UR: {
        total: number(object(rarities.UR).total),
        owned: number(object(rarities.UR).owned),
      },
      L: {
        total: number(object(rarities.L).total),
        owned: number(object(rarities.L).owned),
      },
    },
    genres: Object.fromEntries(
      Object.entries(genres).map(([slug, counts]) => [
        slug,
        { total: number(object(counts).total), owned: number(object(counts).owned) },
      ]),
    ),
    franchises: Array.isArray(row.franchises)
      ? row.franchises.map((entry) => {
          const franchise = object(entry);
          return {
            slug: String(franchise.slug ?? ""),
            name: String(franchise.name ?? franchise.slug ?? ""),
            total: number(franchise.total),
            owned: number(franchise.owned),
          };
        })
      : [],
    sales: number(row.sales),
    referralsPaid: number(row.referralsPaid),
    boostersOpened: number(row.boostersOpened),
    streakDays: number(row.streakDays),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date(0).toISOString(),
    lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : null,
    selectedFrameId: typeof row.selectedFrameId === "string" ? row.selectedFrameId : null,
    unlocked: parseUnlocked(row.unlocked),
    pending: parsePending(row.pending),
    disabled: Array.isArray(row.disabled)
      ? row.disabled.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

/**
 * Statistiques agrégées du joueur. Le client lié à la session suffit : la
 * fonction SQL vérifie que l'appelant demande bien ses propres compteurs.
 */
export async function fetchFrameStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<FrameStatsPayload | null> {
  const { data, error } = await supabase.rpc("frame_stats", { p_user_id: userId });
  if (error) {
    // Migration absente : le profil reste utilisable, simplement sans cadres.
    if (error.code !== "PGRST202") console.error("frame_stats", error);
    return null;
  }
  return parseStats(data);
}

export type EvaluationResult = FrameEvaluation & {
  skipped: boolean;
  newlyUnlocked: FrameDefinition[];
  appliedIds: string[];
  /** Statistiques lues avant l'application (null si la migration manque). */
  stats: FrameStatsPayload | null;
};

function emptyEvaluation(): EvaluationResult {
  return {
    progress: {},
    unlocks: [],
    newUnlockedIds: [],
    pendingAdd: [],
    pendingRemove: [],
    skipped: true,
    newlyUnlocked: [],
    appliedIds: [],
    stats: null,
  };
}

/**
 * Évalue et applique les déblocages d'un joueur.
 *
 * `frame_apply` insère les cadres avec `on conflict do nothing` et ne renvoie
 * que les lignes réellement créées : deux évaluations simultanées ne peuvent
 * pas produire deux déblocages ni deux notifications. Le client de service est
 * requis (l'écriture n'est pas ouverte aux joueurs) ; sans lui, l'évaluation
 * est simplement ignorée et la tâche de recalcul prend le relais.
 */
export async function evaluateFramesForUser(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<EvaluationResult> {
  const stats = await fetchFrameStats(admin, userId);
  if (!stats) return emptyEvaluation();

  const evaluation = evaluateFrameSet({
    stats,
    unlocked: stats.unlocked,
    pending: stats.pending,
    now,
    disabled: stats.disabled,
  });

  const { data, error } = await admin.rpc("frame_apply", {
    p_user_id: userId,
    p_unlock: evaluation.unlocks.map((frame) => ({ id: frame.id, name: frame.name })),
    p_pending_add: evaluation.pendingAdd,
    p_pending_remove: evaluation.pendingRemove,
  });

  if (error) {
    console.error("frame_apply", error);
    return emptyEvaluation();
  }

  const appliedIds = Array.isArray(data)
    ? data.filter((id): id is string => typeof id === "string")
    : [];
  const newlyUnlocked = appliedIds
    .map((id) => getFrame(id))
    .filter((frame): frame is FrameDefinition => Boolean(frame));

  return {
    ...evaluation,
    skipped: false,
    newlyUnlocked,
    appliedIds,
    stats,
  };
}

/** Variante qui crée elle-même le client de service (pages et actions). */
export async function evaluateFrames(userId: string): Promise<EvaluationResult> {
  const admin = createAdminClient();
  if (!admin) return emptyEvaluation();
  return evaluateFramesForUser(admin, userId);
}

/**
 * Vue prête à rendre : progression de chaque cadre, sélection effective et
 * prochain objectif. Les cadres secrets verrouillés ne transmettent ni leur
 * nom, ni leur condition, ni leurs chiffres au navigateur.
 */
export function buildFrameOverview(
  stats: FrameStatsPayload,
  now: Date = new Date(),
): FrameOverview {
  const unlockedIds = new Set(stats.unlocked.map((entry) => entry.frameId));
  const unlockedDates = new Map(stats.unlocked.map((entry) => [entry.frameId, entry.unlockedAt]));
  const selected = resolveSelectedFrame(stats.selectedFrameId, unlockedIds, stats.disabled);
  const best = resolveSelectedFrame(null, unlockedIds, stats.disabled);
  const progress: Record<string, FrameProgress> = {};

  const frames = FRAMES.map((frame): FrameView => {
    const isUnlocked = unlockedIds.has(frame.id);
    const state = frameProgress(frame, stats, {
      now,
      unlocked: isUnlocked,
      disabled: stats.disabled,
    });
    progress[frame.id] = state;

    const hidden = frame.secret && !isUnlocked;
    return {
      id: frame.id,
      name: frameDisplayName(frame, isUnlocked),
      lane: frame.lane,
      prestige: frame.prestige,
      secret: frame.secret,
      description: hidden ? (frame.hiddenHint ?? "Une condition secrète.") : frame.description,
      hiddenHint: frame.hiddenHint ?? null,
      colors: frame.colors,
      gradient: frame.gradient,
      animated: frame.animated === true,
      motif: frame.motif ?? null,
      unlocked: isUnlocked,
      unlockedAt: unlockedDates.get(frame.id) ?? null,
      active:
        state.available ||
        (isUnlocked && frame.active && !stats.disabled.includes(frame.id)),
      soon: state.soon,
      expired: state.expired,
      progress: hidden
        ? { ...state, current: 0, target: 0, percent: 0, remaining: "", detail: "Condition secrète" }
        : state,
    };
  });

  const soonest = nextFrameToUnlock(progress, unlockedIds);

  return {
    frames,
    unlockedCount: FRAMES.filter((frame) => unlockedIds.has(frame.id)).length,
    // Les cadres désactivés restent comptés s'ils ont été débloqués : un cadre
    // acquis ne disparaît pas du compteur, même retiré du catalogue.
    activeTotal: FRAMES.filter((frame) => frame.active || unlockedIds.has(frame.id)).length,
    selectedFrameId: selected,
    bestFrameId: best,
    next: soonest
      ? {
          frameId: soonest.frame.id,
          name: soonest.frame.name,
          remaining: soonest.progress.remaining,
          percent: soonest.progress.percent,
        }
      : null,
    stats,
    disabled: stats.disabled,
  };
}

export async function getFrameOverview(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<FrameOverview> {
  const stats = await fetchFrameStats(supabase, userId);
  if (!stats) {
    return buildFrameOverview({
      ...EMPTY_STATS,
      createdAt: new Date().toISOString(),
      selectedFrameId: null,
      unlocked: [{ frameId: "steel", unlockedAt: new Date(0).toISOString() }],
      pending: [],
      disabled: [],
    });
  }
  return buildFrameOverview(stats, now);
}

export { FRAME_TOTAL };

export type FrameAdminRow = {
  id: string;
  name: string;
  lane: FrameLane;
  prestige: number;
  active: boolean;
  override: boolean;
  secret: boolean;
  soon: boolean;
  count: number;
};

export type FrameAuditRow = {
  at: string;
  actor: string | null;
  action: string;
  frameId: string | null;
  username: string | null;
  reason: string | null;
};

export type FrameAdminReport = {
  totalPlayers: number;
  queued: number;
  rows: FrameAdminRow[];
  audit: FrameAuditRow[];
};

/** Rapport d'administration, protégé par `is_admin()` côté SQL. */
export async function getFrameAdminReport(
  supabase: SupabaseClient,
): Promise<FrameAdminReport | null> {
  const { data, error } = await supabase.rpc("frame_admin_report");
  if (error || !data) {
    console.error("frame_admin_report", error);
    return null;
  }

  const payload = object(data);
  const counts = object(payload.counts);
  const overrides = object(payload.overrides);
  const audit = Array.isArray(payload.audit) ? payload.audit : [];

  return {
    totalPlayers: number(payload.totalPlayers),
    queued: number(payload.queued),
    rows: FRAMES.map((frame) => {
      const override = object(overrides[frame.id]);
      return {
        id: frame.id,
        name: frame.name,
        lane: frame.lane,
        prestige: frame.prestige,
        // La configuration reste la porte d'entrée du catalogue : une
        // surcharge ne peut que désactiver un cadre configuré actif.
        active: frame.active && (typeof override.active === "boolean" ? override.active : true),
        override: Object.keys(override).length > 0,
        secret: frame.secret,
        soon: frame.condition.type === "season" && !frame.active,
        count: number(counts[frame.id]),
      };
    }),
    audit: audit.map((entry) => {
      const row = object(entry);
      return {
        at: String(row.at ?? ""),
        actor: typeof row.actor === "string" ? row.actor : null,
        action: String(row.action ?? ""),
        frameId: typeof row.frameId === "string" ? row.frameId : null,
        username: typeof row.username === "string" ? row.username : null,
        reason: typeof row.reason === "string" ? row.reason : null,
      };
    }),
  };
}
