import { CollectionBrowser } from "@/components/collection-browser";
import { requireSession } from "@/lib/auth";
import { getCollection } from "@/lib/data";
import { CARDS, RARITY, RARITY_ORDER, collectionCompletion } from "@/lib/game";
import { getCard } from "@/lib/cards";

export const metadata = { title: "Collection — TCVG" };

export default async function CollectionPage() {
  const { supabase, user } = await requireSession();
  const collection = await getCollection(supabase, user.id);

  const copies = collection.reduce((sum, row) => sum + row.quantity, 0);
  const completion = collectionCompletion(collection.length);
  const byRarity = RARITY_ORDER.map((key) => ({
    key,
    owned: collection.filter((row) => getCard(row.cardId)?.rarity === key).length,
    total: CARDS.filter((card) => card.rarity === key).length,
  }));

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Collection</h1>
          <p className="mt-1 text-sm text-white/50">
            {collection.length} personnage{collection.length > 1 ? "s" : ""} sur {CARDS.length} ·{" "}
            {copies} carte{copies > 1 ? "s" : ""} au total
          </p>
        </div>

        <div className="min-w-[220px]">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Complétion</span>
            <span className="font-mono">{completion} %</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {byRarity.map(({ key, owned, total }) => {
          const info = RARITY[key];
          return (
            <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <span className={`text-[10px] font-bold uppercase ${info.text}`}>{info.label}</span>
              <p className="font-mono text-sm text-white/70">
                {owned}
                <span className="text-white/30"> / {total}</span>
              </p>
            </div>
          );
        })}
      </div>

      <CollectionBrowser
        entries={collection.map((row) => ({
          cardId: row.cardId,
          quantity: row.quantity,
          firstObtainedAt: row.firstObtainedAt,
        }))}
      />
    </div>
  );
}
