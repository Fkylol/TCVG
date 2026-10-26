import { PLANNED, UPDATES } from "@/lib/changelog";

export const metadata = { title: "Nouveautés — TCVG" };

export default function UpdatesPage() {
  return (
    <article>
      <span className="eyebrow">Nouveautés</span>
      <h1 className="display mt-2 text-4xl">Ce qui a changé</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Les évolutions du site, de la plus récente à la plus ancienne. Rien n&apos;est annoncé ici
        avant d&apos;être en ligne.
      </p>

      <ol className="mt-8 space-y-8">
        {UPDATES.map((entry) => (
          <li key={`${entry.date}-${entry.title}`}>
            <span className="section-rule section-rule-tight" aria-hidden />
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">{entry.date}</p>
            <h2 className="display mt-2 text-xl">{entry.title}</h2>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-white/55">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <section className="mt-10 border-t border-white/10 pt-6">
        <h2 className="display text-xl">En préparation</h2>
        <p className="mt-2 text-sm text-white/45">Sans date annoncée.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PLANNED.map((entry) => (
            <li key={entry.title} className="panel p-4">
              <h3 className="display text-base">{entry.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{entry.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
