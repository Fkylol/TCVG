import { BoosterStation } from "@/components/booster-station";
import { requireSession } from "@/lib/auth";
import { getBoosterState, getCollection } from "@/lib/data";
import { CARDS, CARDS_PER_BOOSTER } from "@/lib/game";

export const metadata = { title: "Boosters — TCVG" };

export default async function BoostersPage() {
  const { supabase, user } = await requireSession();
  const [booster, collection] = await Promise.all([
    getBoosterState(supabase, user),
    getCollection(supabase, user.id),
  ]);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-bold">Boosters</h1>
        <p className="mt-1 text-sm text-white/50">
          {CARDS_PER_BOOSTER} cartes par pack, tirées au hasard. Le cooldown est vérifié côté serveur.
        </p>
      </div>

      <BoosterStation
        initialNextAt={booster.nextAt}
        serverNow={booster.serverNow}
        boostersOpened={booster.profile.boostersOpened}
        uniqueOwned={collection.length}
        totalCards={CARDS.length}
      />
    </div>
  );
}
