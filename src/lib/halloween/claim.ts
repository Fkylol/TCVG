import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HALLOWEEN_BOOSTER_NAME,
  HALLOWEEN_COOLDOWN_MS,
  halloweenForceAllowed,
  isHalloweenActive,
} from "./config";

type HalloweenSession = {
  supabase: SupabaseClient;
  user: { id: string };
};

type ClaimPayload = {
  ok: boolean;
  reason?: string;
  retryAfterMs?: number;
  booster?: { name?: string };
  bonusBoosters?: number;
  nextAt?: string | null;
};

export type HalloweenHandlerOptions = {
  getSession: () => Promise<HalloweenSession | null>;
  /** Injectable pour les tests de la fenêtre saisonnière. */
  now?: () => Date;
  /** `force=1` n'est accepté que si cette fonction renvoie vrai. */
  forceEnabled?: () => boolean;
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

/** Première IP publique fournie par le proxy (Cloudflare en production). */
function clientIp(request: Request): string | null {
  const direct = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim().slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : null;
}

/**
 * POST /api/halloween/booster
 *
 * Le serveur seul décide : session obligatoire, fenêtre saisonnière, limite de
 * débit, puis `claim_halloween_booster()` en base. La fonction SQL fait le
 * contrôle d'une heure et l'ajout au stock bonus dans la même instruction
 * atomique ; le navigateur ne peut donc pas obtenir deux boosters avec un
 * double clic ou un appel direct.
 */
export function createHalloweenBoosterHandler(options: HalloweenHandlerOptions) {
  const now = options.now ?? (() => new Date());
  const forceEnabled = options.forceEnabled ?? halloweenForceAllowed;

  return async function POST(request: Request): Promise<Response> {
    const force = new URL(request.url).searchParams.get("force") === "1" && forceEnabled();
    if (!force && !isHalloweenActive(now())) {
      return json({ ok: false, reason: "inactive" }, 404);
    }

    const session = await options.getSession();
    if (!session) {
      return json({ ok: false, reason: "auth" }, 401);
    }

    const ip = clientIp(request);
    const { data, error } = await session.supabase.rpc("claim_halloween_booster", {
      p_ip: ip,
    });

    if (error) {
      if (error.message.includes("not_authenticated")) {
        return json({ ok: false, reason: "auth" }, 401);
      }
      if (error.message.includes("rate_limited")) {
        return json({ ok: false, retryAfterMs: 60_000 }, 429, { "Retry-After": "60" });
      }
      console.error("claim_halloween_booster", error);
      return json({ ok: false, reason: "server" }, 500);
    }

    const payload = data as ClaimPayload | null;
    if (!payload) {
      return json({ ok: false, reason: "server" }, 500);
    }

    if (!payload.ok) {
      if (payload.reason === "rate_limited" || payload.reason === "cooldown") {
        const retryAfterMs = Math.max(1_000, payload.retryAfterMs ?? HALLOWEEN_COOLDOWN_MS);
        return json(
          { ok: false, retryAfterMs },
          429,
          { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        );
      }
      if (payload.reason === "inactive") {
        return json({ ok: false, reason: "inactive" }, 404);
      }
      return json({ ok: false, reason: payload.reason ?? "server" }, 500);
    }

    return json({
      ok: true,
      // Le nom affiché ne dépend pas de la valeur stockée en base : la sorcière
      // a été retirée de l'overlay, le bonus reste celui d'Halloween.
      booster: { name: HALLOWEEN_BOOSTER_NAME },
      bonusBoosters: payload.bonusBoosters ?? null,
      nextAt: payload.nextAt ?? null,
      retryAfterMs: payload.retryAfterMs ?? HALLOWEEN_COOLDOWN_MS,
    });
  };
}
