import { DailyBonusNote } from "@/components/daily-bonus-note";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { canUseAtelier } from "@/lib/atelier-access";
import { getSession } from "@/lib/auth";
import { claimDailyBonus, getProfile, type DailyBonus } from "@/lib/data";
import { recordActivityDay } from "@/lib/referral/service";
import { serverNowMs } from "@/lib/game";

// Pages publiques à contenu large (classement) : même en-tête que le reste du
// site, mais une colonne plus large que les pages de texte.
export const dynamic = "force-dynamic";

export default async function WideLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  let profile = null;
  let bonus: DailyBonus | null = null;
  // Même calcul que dans les autres layouts : la barre du haut ne doit pas
  // changer d'onglets quand on passe d'une page à l'autre.
  let admin = false;
  let atelier = false;
  if (session) {
    bonus = await claimDailyBonus(session.supabase);
    await recordActivityDay(session.supabase);
    const [loaded, isAdmin, isAtelier] = await Promise.all([
      getProfile(session.supabase, session.user),
      session.supabase.rpc("is_admin").then(({ data }) => data === true),
      canUseAtelier(session.supabase),
    ]);
    profile = loaded;
    admin = isAdmin;
    atelier = isAtelier;
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
        atelier={atelier}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <DailyBonusNote bonus={bonus} />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
