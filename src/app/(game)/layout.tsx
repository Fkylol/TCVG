import { AgoraFab } from "@/components/chat/agora-fab";
import { DailyBonusNote } from "@/components/daily-bonus-note";
import { requireSession } from "@/lib/auth";
import { claimDailyBonus, getProfile, getRarityUpdate, getUnreadNotificationCount } from "@/lib/data";
import { recordActivityDay } from "@/lib/referral/service";
import { RarityUpdateBanner } from "@/components/rarity-update-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { canUseAtelier } from "@/lib/atelier-access";
import { serverNowMs } from "@/lib/game";

// Toutes les pages de jeu dépendent de la session : jamais de rendu statique.
export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireSession();
  // Arriver sur une page de jeu vaut connexion : le bonus de 24 h est réclamé
  // ici, avant la lecture du profil pour que le solde affiché soit à jour.
  const bonus = await claimDailyBonus(supabase);
  // Une visite authentifiée compte comme jour d'activité (série « Assidu »).
  await recordActivityDay(supabase);
  const [profile, unread, admin, rarityUpdate] = await Promise.all([
    getProfile(supabase, user),
    getUnreadNotificationCount(supabase),
    supabase.rpc("is_admin").then(({ data }) => data === true),
    getRarityUpdate(supabase),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        username={profile.username}
        avatarCardId={profile.avatarCardId}
        frame={profile.frame}
        pixels={profile.pixels}
        boosterStock={profile.boosterStock}
        bonusBoosters={profile.bonusBoosters}
        boosterAnchor={profile.lastBoosterAt}
        serverNow={serverNowMs()}
        unread={unread}
        admin={admin}
        atelier={canUseAtelier(profile.username)}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <DailyBonusNote bonus={bonus} />
        <RarityUpdateBanner update={rarityUpdate} />
        {children}
      </main>
      <AgoraFab />
      <SiteFooter />
    </div>
  );
}
