import Link from "next/link";
import { AgoraLoader } from "@/components/chat/agora-loader";
import { APP_CHAT_NAME } from "@/lib/chat/config";

export const metadata = { title: `${APP_CHAT_NAME} — TCVG` };

/**
 * Agora en pleine page (et version mobile du panneau du marché).
 *
 * Le panneau est le même composant que dans la colonne du marché : un seul
 * code à maintenir, deux contextes d'affichage.
 */
export default function AgoraPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Communauté</span>
          <h1 className="display mt-2 text-4xl">{APP_CHAT_NAME}</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Le salon du marché : annonce les cartes que tu échanges, dis ce que tu cherches, et
            discute avec les autres collectionneurs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/agora/offres" className="btn btn-cyan btn-sm">
            Mes échanges
          </Link>
          <Link href="/regles-chat" className="btn btn-outline btn-sm">
            Règles du chat
          </Link>
        </div>
      </div>

      <AgoraLoader variant="page" />
    </div>
  );
}
