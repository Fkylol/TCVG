import { FrameLab } from "@/app/dev/frames/frame-lab";

export const metadata = { title: "Démo cadres — TCVG", robots: { index: false, follow: false } };

export default function FramesLabPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <span className="eyebrow">Développement</span>
      <h1 className="display mt-2 text-4xl">Cadres d&apos;avatar</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-2 max-w-2xl text-sm text-white/50">
        Tous les cadres de la configuration, sur trois avatars et trois tailles. L&apos;interrupteur
        « débloqué / verrouillé » désature les aperçus ; « animations réduites » force le rendu
        statique, comme <code>prefers-reduced-motion</code>.
      </p>
      <FrameLab />
    </main>
  );
}
