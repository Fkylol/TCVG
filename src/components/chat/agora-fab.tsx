"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_CHAT_NAME } from "@/lib/chat/config";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Bouton flottant « Agora » sur mobile, avec la pastille des messages non lus.
 *
 * Le compteur est lu en base (`chat_unread_count`) toutes les minutes. Discret
 * par construction : masqué sur la page du chat, et sans pastille quand tout
 * est lu.
 */
export function AgoraFab() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const hidden = pathname.startsWith("/agora");

  useEffect(() => {
    if (hidden) return;

    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("chat_unread_count");
      if (!alive || error) return;
      setUnread(typeof data === "number" ? data : 0);
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <Link
      href="/agora"
      aria-label={`${APP_CHAT_NAME}${unread > 0 ? `, ${unread} nouveau${unread > 1 ? "x" : ""} message${unread > 1 ? "s" : ""}` : ""}`}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-acid px-4 py-2.5 text-[12px] font-semibold text-ink shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:hidden"
    >
      {APP_CHAT_NAME}
      {unread > 0 && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 font-mono text-[9px] text-acid">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
