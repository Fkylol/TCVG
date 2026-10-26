import { AgoraLoader } from "@/components/chat/agora-loader";
import { MarketBrowser } from "@/components/market-browser";
import { requireSession } from "@/lib/auth";
import { getCard } from "@/lib/cards";
import {
  getGenres,
  getMarketListings,
  getMarketOverview,
  getMyBuyOrders,
  getProfile,
} from "@/lib/data";

export const metadata = { title: "Marché — TCVG" };

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ carte?: string }>;
}) {
  const { carte } = await searchParams;
  const { supabase, user } = await requireSession();
  const initialCard = carte && getCard(carte) ? carte : null;
  const [profile, listings, genres, orders, overview] = await Promise.all([
    getProfile(supabase, user),
    getMarketListings(supabase),
    getGenres(supabase),
    getMyBuyOrders(supabase),
    getMarketOverview(supabase),
  ]);

  const active = listings.filter((listing) => listing.status === "active").length;
  const mine = listings.filter((listing) => listing.mine && listing.status === "active").length;
  const activeOrders = orders.filter((order) => order.status === "active").length;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Échanges</span>
          <h1 className="display mt-2 text-4xl">Marché</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Achète et vends des cartes en Pixels, doublons comme dernière copie. Commission de 5 %
            à la vente, prix recalculés sur les ventes récentes de chaque carte.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="chip py-2 text-white/60">
            <span className="font-sans text-white/40">En vente</span>{" "}
            <span className="text-white/80">{active}</span>
          </span>
          <span className="chip py-2 text-white/60">
            <span className="font-sans text-white/40">Tes annonces</span>{" "}
            <span className="text-white/80">{mine}</span>
          </span>
          <span className="chip py-2 text-white/60">
            <span className="font-sans text-white/40">Tes ordres</span>{" "}
            <span className="text-white/80">{activeOrders}</span>
          </span>
          <span className="chip py-2 text-acid">
            <span className="font-sans text-acid/60">Solde</span>{" "}
            <span className="font-semibold">◆ {profile.pixels}</span>
          </span>
        </div>
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Ventes 24 h",
            value: String(overview.trades24h),
            hint: `◆ ${overview.volume24h} échangés`,
          },
          {
            label: "Ventes 7 jours",
            value: String(overview.trades7d),
            hint: `◆ ${overview.volume7d} échangés`,
          },
          {
            label: "Commission détruite 24 h",
            value: `◆ ${overview.fees24h}`,
            hint: "Retirée de l'économie à chaque vente",
          },
          {
            label: "Carnet",
            value: `${overview.listings} / ${overview.orders}`,
            hint: "annonces actives / ordres en attente",
          },
        ].map((tile) => (
          <div key={tile.label} className="panel p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{tile.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold text-white/90">{tile.value}</p>
            <p className="mt-0.5 text-[10px] text-white/30">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <MarketBrowser
            listings={listings}
            genres={genres}
            pixels={profile.pixels}
            userId={user.id}
            initialCard={initialCard}
            orders={orders}
          />
        </div>

        {/* L'Agora accompagne le marché : annonces et échanges se lisent côte à côte. */}
        <aside className="lg:sticky lg:top-20">
          <AgoraLoader />
        </aside>
      </div>
    </div>
  );
}
