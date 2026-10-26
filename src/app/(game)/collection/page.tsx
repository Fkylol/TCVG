import { CollectionBrowser } from "@/components/collection-browser";
import { requireSession } from "@/lib/auth";
import { getCardOwners, getCollection, getRecycleValues } from "@/lib/data";
import { CARDS, RARITY, RARITY_ORDER, collectionCompletion } from "@/lib/game";
import { getCard } from "@/lib/cards";

export const metadata = { title: "Collection — TCVG" };

export default async function CollectionPage() {
  const { supabase, user } = await requireSession();
  const [collection, recycleValues, owners] = await Promise.all([
    getCollection(supabase, user.id),
    getRecycleValues(supabase),
    getCardOwners(supabase),
  ]);

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
          <span className="eyebrow">Collection</span>
          <h1 className="display mt-2 text-4xl">Collection</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 text-sm text-white/50">
            {collection.length} personnage{collection.length > 1 ? "s" : ""} sur {CARDS.length} ·{" "}
            {copies} carte{copies > 1 ? "s" : ""} · {copies - collection.length} doublon
            {copies - collection.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="min-w-[220px]">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Complétion</span>
            <span className="font-mono">{completion} %</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden bg-white/10">
            <div className="h-full bg-acid transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {byRarity.map(({ key, owned, total }) => {
          const info = RARITY[key];
          return (
            <div key={key} className="panel px-2.5 py-1.5">
              <span
                className={`block text-[10px] leading-tight font-bold uppercase ${info.text}`}
              >
                {info.label}
              </span>
              <p className="font-mono text-sm text-white/70">
                {owned}
                <span className="text-white/30"> / {total}</span>
              </p>
            </div>
          );
        })}
      </div>

      <CollectionBrowser
        recycleValues={recycleValues}
        owners={owners}
        entries={collection.map((row) => ({
          cardId: row.cardId,
          quantity: row.quantity,
          holoQuantity: row.holoQuantity,
          variant: row.variant,
          retired: row.retired,
          firstObtainedAt: row.firstObtainedAt,
        }))}
      />
    </div>
  );
}
