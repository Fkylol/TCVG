import { requireSession } from "@/lib/auth";
import { claimDailyBonus, getProfile } from "@/lib/data";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Toutes les pages de jeu dépendent de la session : jamais de rendu statique.
export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireSession();
  // Arriver sur une page de jeu vaut connexion : le bonus de 24 h est réclamé
  // ici, avant la lecture du profil pour que le solde affiché soit à jour.
  await claimDailyBonus(supabase);
  const profile = await getProfile(supabase, user);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        username={profile.username}
        avatarCardId={profile.avatarCardId}
        frame={profile.frame}
        pixels={profile.pixels}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
