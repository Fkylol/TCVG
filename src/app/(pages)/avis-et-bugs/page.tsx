import { FeedbackForm } from "@/components/feedback-form";

export const metadata = { title: "Avis et bugs — TCVG" };

export default function FeedbackPage() {
  return (
    <article>
      <span className="eyebrow">Avis et bugs</span>
      <h1 className="display mt-2 text-4xl">Dis-nous ce qui cloche</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Une carte mal classée, un booster qui ne s&apos;ouvre pas, une règle incompréhensible, une
        idée qui te semble évidente : écris-le ici. Tu peux envoyer un message sans être connecté.
      </p>

      <div className="panel mt-6 p-4 text-sm leading-relaxed text-white/50">
        <p className="font-semibold text-white/70">Pour un bug, trois détails font gagner du temps</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>la page où c&apos;est arrivé,</li>
          <li>ce que tu as fait juste avant,</li>
          <li>ce que tu attendais à la place.</li>
        </ul>
      </div>

      <FeedbackForm />
    </article>
  );
}
