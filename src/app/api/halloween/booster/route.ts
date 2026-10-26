import { getSession } from "@/lib/auth";
import { createHalloweenBoosterHandler } from "@/lib/halloween/claim";

export const dynamic = "force-dynamic";

/** POST /api/halloween/booster — la sorcière offre un booster bonus par heure. */
export const POST = createHalloweenBoosterHandler({ getSession });
