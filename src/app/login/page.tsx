import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Connexion — TCVG" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur">
          <h1 className="text-2xl font-bold">Content de te revoir</h1>
          <p className="mb-6 mt-1 text-sm text-white/50">Retrouve ta collection là où tu l&apos;as laissée.</p>
          <AuthForm mode="login" />
        </div>
      </main>
    </div>
  );
}
