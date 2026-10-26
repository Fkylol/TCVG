import Link from "next/link";
import { CardFace } from "@/components/card-face";
import { WishlistAlert } from "@/components/wishlist-alert";
import { WishlistRemove } from "@/components/wishlist-remove";
import { requireSession } from "@/lib/auth";
import { getWishlist } from "@/lib/data";
import { getCard, type Card } from "@/lib/cards";
import { RARITY, WISHLIST_LIMIT } from "@/lib/game";

export const metadata = { title: "Envies — TCVG" };

type Entry = {
  card: Card;
  quantity: number;
  createdAt: string;
  maxPrice: number | null;
};

export default async function WishlistPage() {
  const { supabase, user } = await requireSession();
  const rows = await getWishlist(supabase, user.id);

  // Une carte retirée du catalogue sort de la liste sans rien casser.
  const entries: Entry[] = rows.flatMap((row) => {
    const card = getCard(row.cardId);
    return card
      ? [{ card, quantity: row.quantity, createdAt: row.createdAt, maxPrice: row.maxPrice }]
      : [];
  });

  const ownedCount = entries.filter((entry) => entry.quantity > 0).length;

  return (
    <div>
      <div className="mb-7">
        <span className="eyebrow">Envies</span>
        <h1 className="display mt-2 text-4xl">Mes envies</h1>
        <span className="title-rule" aria-hidden />
        <p className="mt-1 text-sm text-white/50">
          {entries.length} carte{entries.length > 1 ? "s" : ""} sur {WISHLIST_LIMIT} ·{" "}
          {ownedCount} déjà possédée{ownedCount > 1 ? "s" : ""} · liste privée · seuil d&apos;alerte
          au choix par carte
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="border border-dashed border-white/15 px-6 py-16 text-center">
          <p className="display text-lg text-white/70">Aucune envie pour l&apos;instant</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/40">
            Ouvre la fiche d&apos;un personnage et clique sur « Ajouter à mes envies » pour le
            retrouver ici.
          </p>
          <Link href="/boosters" className="btn btn-primary btn-sm mt-4">
            Ouvrir un booster
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {entries.map(({ card, quantity, maxPrice }) => {
            const info = RARITY[card.rarity];
            const owned = quantity > 0;

            return (
              <div key={card.id} className="flex flex-col">
                <Link
                  href={`/card/${card.id}`}
                  className="group block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-acid/70"
                >
                  <CardFace
                    card={card}
                    size="sm"
                    className={`aspect-[3/4] transition group-hover:-translate-y-0.5 ${
                      owned ? "" : "opacity-80"
                    }`}
                  />
                  <p className="mt-1.5 truncate text-xs text-white/75">{card.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">
                    {info.label} · {owned ? `possédée ×${quantity}` : "à trouver"}
                  </p>
                </Link>

                <WishlistAlert cardId={card.id} cardName={card.name} maxPrice={maxPrice} />

                <div className="mt-1.5">
                  <WishlistRemove cardId={card.id} cardName={card.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
