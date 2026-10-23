import { MarketBrowser } from "@/components/market-browser";
import { requireSession } from "@/lib/auth";
import { getGenres, getMarketListings, getProfile } from "@/lib/data";

export const metadata = { title: "Marché — TCVG" };

export default async function MarketPage() {
  const { supabase, user } = await requireSession();
  const [profile, listings, genres] = await Promise.all([
    getProfile(supabase, user),
    getMarketListings(supabase),
    getGenres(supabase),
  ]);

  const active = listings.filter((listing) => listing.status === "active").length;
  const mine = listings.filter((listing) => listing.mine && listing.status === "active").length;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Échanges</span>
          <h1 className="display mt-2 text-4xl">Marché</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Achète et vends des doublons en Pixels. Commission de 5 % à la vente, prix recalculés
            sur les ventes récentes de chaque carte.
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-white/40">En vente</span>{" "}
            <span className="font-mono text-white/75">{active}</span>
          </span>
          <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-white/40">Tes annonces</span>{" "}
            <span className="font-mono text-white/75">{mine}</span>
          </span>
          <span className="rounded-xl border border-acid/30 bg-acid/10 px-3 py-2 text-acid">
            <span className="text-acid/60">Solde</span>{" "}
            <span className="font-mono font-semibold">◆ {profile.pixels}</span>
          </span>
        </div>
      </div>

      <MarketBrowser
        listings={listings}
        genres={genres}
        pixels={profile.pixels}
        userId={user.id}
      />
    </div>
  );
}
