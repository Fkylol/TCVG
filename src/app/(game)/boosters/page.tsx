import { BoosterPicker, type PackView } from "@/components/booster-picker";
import { requireSession } from "@/lib/auth";
import { getBoosterState, getCollection, getPackStats } from "@/lib/data";
import { catalogSize } from "@/lib/cards";
import { MIN_POOL_SIZE, shopPacks } from "@/lib/packs";

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
  // base : l'interface ne calcule aucune probabilité elle-même. Les packs de
  // la vitrine sont les dix packs de genre : celui d'Halloween s'ouvre par la
  // citrouille de l'overlay, pas ici.
  const packs: PackView[] = shopPacks().map((pack) => {
    const stat = stats[pack.id];
    return {
      ...pack,
      stats: {
        poolSize: stat?.poolSize ?? 0,
        minPoolSize: stat?.minPoolSize ?? MIN_POOL_SIZE,
        available: stat?.available ?? false,
        cardsCount: stat?.cardsCount ?? 5,
        chances: stat?.chances ?? {},
        guarantees: stat?.guarantees,
      },
    };
  });

  return (
    <BoosterPicker
      packs={packs}
      initialStock={booster.profile.boosterStock}
      initialBonus={booster.profile.bonusBoosters}
      standardBoostersOpened={booster.profile.standardBoostersOpened}
      pityMythic={booster.profile.pityMythic}
      initialAnchor={booster.profile.lastBoosterAt}
      serverNow={booster.serverNow}
      uniqueOwned={collection.length}
      totalCards={catalogSize()}
      initialPackId={packParam ?? null}
      openCharacters={persos === "1"}
    />
  );
}
