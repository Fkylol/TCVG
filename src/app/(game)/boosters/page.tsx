import { BoosterStation } from "@/components/booster-station";
import { BoosterShop } from "@/components/booster-shop";
import { requireSession } from "@/lib/auth";
import { getBoosterCatalog, getBoosterState, getCollection } from "@/lib/data";
import { CARDS, CARDS_PER_BOOSTER } from "@/lib/game";

export const metadata = { title: "Boosters — TCVG" };

export default async function BoostersPage() {
  const { supabase, user } = await requireSession();
  const [booster, collection, offers] = await Promise.all([
    getBoosterState(supabase, user),
    getCollection(supabase, user.id),
    getBoosterCatalog(supabase),
  ]);

  return (
    <div>
      <div className="mb-7">
        <span className="eyebrow">Boosters</span>
        <h1 className="display mt-2 text-4xl">Boosters</h1>
        <p className="mt-1 text-sm text-white/50">
          {CARDS_PER_BOOSTER} cartes par pack. Un booster toutes les 10 minutes, cumulables jusqu&apos;à 10 —
          le stock est géré côté serveur.
        </p>
      </div>

      <BoosterStation
        initialStock={booster.profile.boosterStock}
        initialAnchor={booster.profile.lastBoosterAt}
        serverNow={booster.serverNow}
        boostersOpened={booster.profile.boostersOpened}
        uniqueOwned={collection.length}
        totalCards={CARDS.length}
      />

      <BoosterShop offers={offers} initialPixels={booster.profile.pixels} />
    </div>
  );
}
