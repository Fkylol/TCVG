import Link from "next/link";
import { DiscordButton } from "@/components/discord-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Inscription — TCVG" };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="panel panel-accent w-full max-w-sm p-7 backdrop-blur">
          <span className="eyebrow">Inscription</span>
          <h1 className="display mt-2 text-3xl">Crée ta collection</h1>
          <span className="title-rule" aria-hidden />
          <p className="mb-6 mt-1 text-sm text-white/50">
            Gratuit, uniquement avec Discord. Ton premier booster t&apos;attend juste après.
          </p>

          <DiscordButton label={"Créer mon compte avec Discord"} />

          <p className="mt-5 text-center text-sm text-white/50">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-acid underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
