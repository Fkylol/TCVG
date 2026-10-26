import { BoosterPicker, type PackView } from "@/components/booster-picker";
import { requireSession } from "@/lib/auth";
import { getBoosterState, getCollection, getPackStats } from "@/lib/data";
import { CARDS } from "@/lib/game";
import { MIN_POOL_SIZE, PACKS } from "@/lib/packs";

export const metadata = { title: "Boosters — TCVG" };

export default async function BoostersPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string; persos?: string }>;
}) {
  const { pack: packParam, persos } = await searchParams;
  const { supabase, user } = await requireSession();
  const [booster, collection, stats] = await Promise.all([
    getBoosterState(supabase, user),
    getCollection(supabase, user.id),
    getPackStats(supabase),
  ]);

  // Les visuels viennent de packs.ts, la disponibilité et les chances de la
  // base : l'interface ne calcule aucune probabilité elle-même.
  const packs: PackView[] = PACKS.map((pack) => {
    const stat = stats[pack.id];
    return {
      ...pack,
      stats: {
        poolSize: stat?.poolSize ?? 0,
        minPoolSize: stat?.minPoolSize ?? MIN_POOL_SIZE,
        available: stat?.available ?? false,
        cardsCount: stat?.cardsCount ?? 5,
        chances: stat?.chances ?? {},
      },
    };
  });

  return (
    <BoosterPicker
      packs={packs}
      initialStock={booster.profile.boosterStock}
      initialBonus={booster.profile.bonusBoosters}
      initialAnchor={booster.profile.lastBoosterAt}
      serverNow={booster.serverNow}
      uniqueOwned={collection.length}
      totalCards={CARDS.length}
      initialPackId={packParam ?? null}
      openCharacters={persos === "1"}
    />
  );
}
