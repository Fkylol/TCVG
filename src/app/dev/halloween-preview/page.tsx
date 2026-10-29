import { CardBack } from "@/components/card-back";
import { CardFace } from "@/components/card-face";
import { BoosterPack } from "@/components/booster-pack";
import { CARDS } from "@/lib/cards";
import { getPack } from "@/lib/packs";
import { RARITY_ORDER } from "@/lib/game";

/** Banc d'essai temporaire : le pack d'Halloween, son dos et ses vingt cartes. */
export default function HalloweenPreview() {
  const halloween = getPack("halloween");
  const mix = getPack("mix");
  if (!halloween) return <p>Pack Halloween introuvable</p>;

  const seasonal = CARDS.filter((card) => card.season === "halloween").sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
  );

  return (
    <div className="flex flex-col gap-8 bg-[#0b0b14] p-8">
      <div className="flex flex-wrap items-start gap-8">
        <div className="w-[210px]">
          <BoosterPack pack={halloween} />
        </div>
        <div className="w-[260px]">
          <BoosterPack pack={halloween} flat />
        </div>
        <span className="relative block aspect-[3/4] w-[168px] overflow-hidden rounded-2xl">
          <CardBack pack={halloween} />
        </span>
        <span className="relative block aspect-[3/4] w-[168px] overflow-hidden rounded-2xl">
          <CardBack pack={mix} />
        </span>
        <span className="deck-thumb">
          <CardBack pack={halloween} />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {seasonal.map((card) => (
          // Hauteur imposée par le cadre : `.card-art` prend le reste en flex.
          <div key={card.id} className="aspect-[3/4]">
            <CardFace card={card} size="sm" className="h-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
