import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth";
import { claimDailyBonus, getProfile } from "@/lib/data";

// Les pages d'information sont publiques, mais l'en-tête doit refléter la
// session (pseudo, solde) : rendu dynamique, jamais mis en cache.
export const dynamic = "force-dynamic";

export default async function PagesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  let profile = null;
  if (session) {
    await claimDailyBonus(session.supabase);
    profile = await getProfile(session.supabase, session.user);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        username={profile?.username}
        avatarCardId={profile?.avatarCardId}
        frame={profile?.frame}
        pixels={profile?.pixels}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">{children}</main>
      <SiteFooter />
    </div>
  );
}
