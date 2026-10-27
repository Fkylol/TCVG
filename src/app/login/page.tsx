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
        <div className="panel panel-accent w-full max-w-sm p-7 backdrop-blur">
          <span className="eyebrow">Connexion</span>
          <h1 className="display mt-2 text-3xl">Content de te revoir</h1>
          <span className="title-rule" aria-hidden />
          <p className="mb-6 mt-1 text-sm text-white/50">
            La connexion se fait uniquement avec Discord.
          </p>

          {erreur === "discord" && (
            <p
              role="alert"
              className="mb-4 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              La connexion Discord a échoué. Réessaie dans un instant.
            </p>
          )}

          {erreur === "confirmation" && (
            <p
              role="alert"
              className="mb-4 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              La connexion n&apos;a pas abouti : le retour de Discord a expiré, ou la session
              s&apos;est ouverte dans un autre onglet. Reclique sur le bouton ci-dessous.
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
