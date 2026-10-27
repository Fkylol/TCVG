import { DailyBonusNote } from "@/components/daily-bonus-note";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { canUseAtelier } from "@/lib/atelier-access";
import { getSession } from "@/lib/auth";
import { claimDailyBonus, getProfile, type DailyBonus } from "@/lib/data";
import { recordActivityDay } from "@/lib/referral/service";
import { serverNowMs } from "@/lib/game";

// Les pages d'information sont publiques, mais l'en-tête doit refléter la
// session (pseudo, solde) : rendu dynamique, jamais mis en cache.
export const dynamic = "force-dynamic";

export default async function PagesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  let profile = null;
  let bonus: DailyBonus | null = null;
  // Le drapeau d'administration et l'atelier sont calculés ici aussi : sinon
  // la barre du haut change d'onglets d'une page à l'autre.
  let admin = false;
  if (session) {
    bonus = await claimDailyBonus(session.supabase);
    await recordActivityDay(session.supabase);
    const [loaded, isAdmin] = await Promise.all([
      getProfile(session.supabase, session.user),
      session.supabase.rpc("is_admin").then(({ data }) => data === true),
    ]);
    profile = loaded;
    admin = isAdmin;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        username={profile?.username}
        avatarCardId={profile?.avatarCardId}
        frame={profile?.frame}
        pixels={profile?.pixels}
        boosterStock={profile?.boosterStock}
        bonusBoosters={profile?.bonusBoosters ?? 0}
        boosterAnchor={profile?.lastBoosterAt}
        serverNow={serverNowMs()}
        admin={admin}
        atelier={canUseAtelier(profile?.username)}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <DailyBonusNote bonus={bonus} />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
