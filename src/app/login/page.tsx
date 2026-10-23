import { DiscordButton } from "@/components/discord-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Connexion — TCVG" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur">
          <span className="eyebrow">Connexion</span>
          <h1 className="display mt-2 text-3xl">Content de te revoir</h1>
          <p className="mb-6 mt-1 text-sm text-white/50">
            La connexion se fait uniquement avec Discord.
          </p>

          {erreur === "discord" && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              La connexion Discord a échoué. Réessaie dans un instant.
            </p>
          )}

          <DiscordButton />

          <p className="mt-5 text-center text-xs leading-relaxed text-white/35">
            Ton compte est créé automatiquement à ta première connexion.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
