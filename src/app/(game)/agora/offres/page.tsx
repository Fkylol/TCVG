import { OffersBoard } from "@/components/chat/offers-board";
import { requireSession } from "@/lib/auth";
import { APP_CHAT_NAME } from "@/lib/chat/config";
import { parseOfferBoard } from "@/lib/chat/offers";

export const metadata = { title: `Échanges — ${APP_CHAT_NAME} — TCVG` };

/**
 * Page des échanges : offres reçues et envoyées, lues en base par
 * `chat_offer_list()` (qui purge d'abord les offres échues). Sans la
 * migration 033, la page affiche un état vide plutôt que de casser.
 */
export default async function OffersPage() {
  const { supabase } = await requireSession();
  const { data, error } = await supabase.rpc("chat_offer_list");

  if (error && error.code !== "PGRST202" && error.code !== "42883") {
    console.error("chat_offer_list", error);
  }

  const board = parseOfferBoard(data) ?? { incoming: [], outgoing: [] };

  return (
    <>
      {error && (
        <p className="mb-4 border-l-2 border-amber-400/60 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Les échanges ne sont pas encore activés sur ce serveur : applique la migration{" "}
          <code className="font-mono">033_echanges.sql</code>.
        </p>
      )}
      <OffersBoard initial={board} />
    </>
  );
}
