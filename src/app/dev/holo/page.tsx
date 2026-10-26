import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CARDS, type Card, type Rarity } from "@/lib/cards";
import { RARITY_ORDER } from "@/lib/game";
import { createClient } from "@/lib/supabase/server";
import { HoloLab } from "./holo-lab";

export const metadata: Metadata = {
  title: "Laboratoire holo — TCVG",
  robots: { index: false, follow: false },
};

// Page de travail : elle ne doit jamais être servie en cache ni indexée.
export const dynamic = "force-dynamic";

const VARIANTS = ["normal", "misprint", "ghosting", "off_center", "holo_bleed"] as const;

/** Une carte représentative par rareté, pour comparer les traitements. */
function sampleByRarity(): { rarity: Rarity; card: Card }[] {
  return RARITY_ORDER.map((rarity) => {
    const card = CARDS.find((candidate) => candidate.rarity === rarity);
    return card ? { rarity, card } : null;
  }).filter((entry): entry is { rarity: Rarity; card: Card } => entry !== null);
}

export default async function HoloLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) notFound();

  return (
    <article>
      <span className="eyebrow">Atelier</span>
      <h1 className="display mt-2 text-4xl">Laboratoire holo</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Les six raretés, puis les variantes misprint. Le curseur fixe l&apos;intensité des
        effets (0 = carte au repos, 1 = survol) : il sert à vérifier ce qui reste lisible
        sans pointeur, notamment sur mobile.
      </p>

      <HoloLab samples={sampleByRarity()} variants={[...VARIANTS]} />
    </article>
  );
}
