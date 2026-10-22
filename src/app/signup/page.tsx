import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Inscription — TCVG" };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur">
          <h1 className="text-2xl font-bold">Crée ta collection</h1>
          <p className="mb-6 mt-1 text-sm text-white/50">
            Gratuit. Ton premier booster t&apos;attend juste après.
          </p>
          <AuthForm mode="signup" />
          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/30">
            Projet de fan, non officiel. Les personnages appartiennent à leurs studios respectifs.
          </p>
        </div>
      </main>
    </div>
  );
}
