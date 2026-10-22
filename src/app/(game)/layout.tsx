import { requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { SiteHeader } from "@/components/site-header";

// Toutes les pages de jeu dépendent de la session : jamais de rendu statique.
export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireSession();
  const profile = await getProfile(supabase, user);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader username={profile.username} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-white/10 px-4 py-6 text-center text-[11px] text-white/30">
        Projet de fan, non officiel — personnages appartenant à leurs studios respectifs.
      </footer>
    </div>
  );
}
