import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardBack } from "@/components/card-back";
import { PACKS, type Pack } from "@/lib/packs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Laboratoire dos de carte — TCVG",
  robots: { index: false, follow: false },
};

// Page de travail : elle ne doit jamais être servie en cache ni indexée.
export const dynamic = "force-dynamic";

/** Le dos standard d'abord, puis celui de chacun des dix packs. */
const BOARDS: { label: string; pack: Pack | null }[] = [
  { label: "Dos standard", pack: null },
  ...PACKS.map((pack) => ({ label: pack.name, pack })),
];

/** Planche de contrôle : aucun tirage, aucune écriture en base. */
export default async function CardBackLabPage() {
  // En développement, la planche s'ouvre sans compte — elle ne lit rien. En
  // ligne, elle reste réservée à l'administration, comme les autres labos.
  if (process.env.NODE_ENV === "production") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();

    const { data: admin } = await supabase.rpc("is_admin");
    if (admin !== true) notFound();
  }

  return (
    <article>
      <span className="eyebrow">Atelier</span>
      <h1 className="display mt-2 text-4xl">Laboratoire dos de carte</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Le dos standard, puis celui de chaque pack : même dessin, couleurs du genre. La rangée
        du bas montre la vignette de 34 px du pied de révélation, qui est une réduction exacte du
        grand dos — le wordmark s&apos;y efface tout seul.
      </p>

      <div className="mt-8 flex flex-wrap gap-6">
        {BOARDS.map(({ label, pack }) => (
          <div key={label} className="flex w-[168px] flex-col gap-2">
            <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl">
              <CardBack pack={pack} />
            </span>
            <span className="text-xs text-white/55">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {BOARDS.map(({ label, pack }) => (
          <span key={`thumb-${label}`} className="deck-thumb">
            <CardBack pack={pack} />
          </span>
        ))}
      </div>
    </article>
  );
}
