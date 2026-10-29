import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPackStats } from "@/lib/data";
import { CARDS_PER_BOOSTER } from "@/lib/game";
import { GUARANTEE_ENABLED, MIN_POOL_SIZE, shopPacks } from "@/lib/packs";

/**
 * GET /api/packs
 *
 * Pour chaque pack : disponibilité, taille du pool actif, seuil, chances par
 * rareté. Tout vient de `pack_stats()` en base — aucune valeur inventée côté
 * interface. Cette route ne révèle jamais quelles cartes seront tirées, et ne
 * liste que les packs de la vitrine : celui d'Halloween ne s'obtient que par la
 * citrouille de l'overlay.
 */
export async function GET() {
  const supabase = await createClient();
  const stats = await getPackStats(supabase);

  const packs = shopPacks().map((pack) => {
    const stat = stats[pack.id];
    const poolSize = stat?.poolSize ?? 0;
    const minPoolSize = stat?.minPoolSize ?? MIN_POOL_SIZE;
    const available = stat?.available ?? false;

    return {
      id: pack.id,
      name: pack.name,
      subtitle: pack.subtitle,
      genre: pack.genre,
      available,
      reason: available ? null : `${poolSize} / ${minPoolSize} persos`,
      poolSize,
      minPoolSize,
      cardsCount: stat?.cardsCount ?? CARDS_PER_BOOSTER,
      guarantee: GUARANTEE_ENABLED,
      chances: stat?.chances ?? {},
    };
  });

  return NextResponse.json({ packs });
}
