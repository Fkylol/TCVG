import Link from "next/link";
import { redirect } from "next/navigation";
import { ModerationQueue } from "@/components/chat/moderation-queue";
import { requireSession } from "@/lib/auth";
import { APP_CHAT_NAME } from "@/lib/chat/config";
import { getChatAdminQueue, getChatState } from "@/lib/chat/data";

export const metadata = { title: `Modération — ${APP_CHAT_NAME}` };

/**
 * File de modération, réservée aux administrateurs.
 *
 * La page vérifie le drapeau, mais c'est la fonction SQL `chat_admin_queue()`
 * qui refuse réellement les données : un joueur qui forcerait la route
 * n'obtiendrait que `{ ok: false, reason: 'not_admin' }`.
 */
export default async function AgoraModerationPage() {
  const { supabase } = await requireSession();

  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) redirect("/agora");

  const [queue, state] = await Promise.all([
    getChatAdminQueue(supabase),
    getChatState(supabase),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Administration</span>
          <h1 className="display mt-2 text-3xl">Modération de {APP_CHAT_NAME}</h1>
          <span className="title-rule" aria-hidden />
        </div>
        <Link href="/agora" className="btn btn-outline btn-sm">
          Retour au chat
        </Link>
      </div>

      {queue ? (
        <ModerationQueue queue={queue} rooms={state?.rooms ?? []} />
      ) : (
        <p className="panel p-4 text-sm text-white/45">
          La file de modération n&apos;est pas disponible : la migration du chat n&apos;est pas
          appliquée.
        </p>
      )}
    </div>
  );
}
