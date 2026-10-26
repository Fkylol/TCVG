import { AgoraPanel } from "@/components/chat/agora-panel";
import { requireSession } from "@/lib/auth";
import { getChatCardOptions, getChatHistory, getChatState } from "@/lib/chat/data";
import { APP_CHAT_NAME } from "@/lib/chat/config";

/**
 * Chargement serveur du panneau.
 *
 * Le premier rendu est complet (salons, fil, cartes proposables) : le chat
 * est lisible même si le navigateur refuse la connexion temps réel. Si la
 * migration 031 n'est pas appliquée, on affiche un état d'attente au lieu de
 * casser la page qui l'accueille.
 */
export async function AgoraLoader({ variant = "sidebar" }: { variant?: "sidebar" | "page" }) {
  const { supabase, user } = await requireSession();
  const state = await getChatState(supabase);

  if (!state) {
    return (
      <section aria-label={APP_CHAT_NAME} className="panel p-4">
        <h2 className="display text-sm tracking-[0.08em]">{APP_CHAT_NAME}</h2>
        <p className="mt-2 text-xs text-white/45">
          Le salon communautaire n&apos;est pas encore ouvert sur cette installation.
        </p>
      </section>
    );
  }

  const [history, cardOptions] = await Promise.all([
    getChatHistory(supabase, state.roomId, { limit: state.settings.historyPage }),
    getChatCardOptions(supabase, user.id),
  ]);

  return (
    <AgoraPanel
      initialState={state}
      initialMessages={history.messages}
      initialHasMore={history.hasMore}
      cardOptions={cardOptions}
      currentUserId={user.id}
      variant={variant}
    />
  );
}
