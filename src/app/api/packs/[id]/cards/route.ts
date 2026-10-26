import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { CARDS, getCard, getUniverseLabel, type Rarity } from "@/lib/cards";
import { RARITY_ORDER } from "@/lib/game";
import { getPack } from "@/lib/packs";
import { getCardArt } from "@/lib/card-art";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 18;
const MAX_LIMIT = 60;

type Filter = "all" | "owned" | "missing";

/**
 * GET /api/packs/[id]/cards?rarity=&q=&filter=&cursor=&limit=
 *
 * Liste paginée des personnages d'un pack (cartes jouables uniquement), avec
 * le statut possédé du joueur connecté et les compteurs par rareté. Les
 * compteurs sont calculés ici, à partir de `pack_cards()` : pas d'images ni de
 * collection complète chargées côté navigateur.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pack = getPack(id);
  if (!pack) {
    return NextResponse.json({ error: "Pack inconnu" }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rarityParam = url.searchParams.get("rarity");
  const rarity = RARITY_ORDER.includes(rarityParam as Rarity) ? (rarityParam as Rarity) : null;
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const filterParam = url.searchParams.get("filter");
  const filter: Filter = filterParam === "missing" || filterParam === "owned" ? filterParam : "all";
  const cursor = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );

  const [poolResult, ownedResult] = await Promise.all([
    session.supabase.rpc("pack_cards", { p_slug: pack.id }),
    session.supabase
      .from("collection")
      .select("card_id, quantity")
      .eq("user_id", session.user.id),
  ]);

  if (poolResult.error) {
    console.error("pack_cards", poolResult.error);
    return NextResponse.json({ error: "Liste indisponible" }, { status: 500 });
  }

  const owned = new Map<string, number>();
  for (const row of ownedResult.data ?? []) {
    owned.set(row.card_id as string, (row.quantity as number) ?? 1);
  }

  type Entry = {
    id: string;
    name: string;
    universe: string;
    franchise: string;
    rarity: Rarity;
    owned: boolean;
    quantity: number;
    imageUrl: string | null;
    number: number;
  };

  const poolRows = (poolResult.data ?? []) as { id: string; rarity: Rarity }[];

  const entries: Entry[] = poolRows
    .map((row): Entry | null => {
      const card = getCard(row.id);
      if (!card) return null;
      return {
        id: card.id,
        name: card.name,
        universe: card.universe,
        franchise: getUniverseLabel(card.universe),
        rarity: card.rarity,
        owned: owned.has(card.id),
        quantity: owned.get(card.id) ?? 0,
        imageUrl: getCardArt(card.id)?.src ?? null,
        number: CARDS.findIndex((item) => item.id === card.id) + 1,
      } satisfies Entry;
    })
    .filter((entry): entry is Entry => entry !== null);

  // Compteurs par rareté sur tout le pack (indépendants de la recherche).
  const counts: Record<string, { owned: number; total: number }> = {};
  for (const key of RARITY_ORDER) counts[key] = { owned: 0, total: 0 };
  for (const entry of entries) {
    counts[entry.rarity].total += 1;
    if (entry.owned) counts[entry.rarity].owned += 1;
  }

  const selected = entries
    .filter((entry) => (rarity ? entry.rarity === rarity : true))
    .filter((entry) => (filter === "owned" ? entry.owned : filter === "missing" ? !entry.owned : true))
    .filter((entry) =>
      query
        ? entry.name.toLowerCase().includes(query) || entry.franchise.toLowerCase().includes(query)
        : true,
    )
    .sort((a, b) => {
      const rank = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
      return rank !== 0 ? rank : a.number - b.number;
    });

  const page = selected.slice(cursor, cursor + limit);
  const nextCursor = cursor + page.length < selected.length ? cursor + page.length : null;

  return NextResponse.json({
    pack: { id: pack.id, name: pack.name },
    rarity,
    counts,
    ownedTotal: entries.filter((entry) => entry.owned).length,
    total: entries.length,
    matched: selected.length,
    nextCursor,
    cards: page,
  });
}
