import { notFound } from "next/navigation";
import { AvatarFrame } from "@/components/avatar-frame";
import { ProfileShowcase, type ShowcaseCard } from "@/components/profile-showcase";
import { catalogCards, getCard } from "@/lib/cards";
import { getCollection } from "@/lib/data";
import { getCardArt } from "@/lib/card-art";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profil public — TCVG" };
export const dynamic = "force-dynamic";

type ProfileRow = {
  username: string;
  avatar_card_id: string | null;
  frame: string | null;
  is_owner: boolean;
  slot: number;
  card_id: string | null;
  holo_quantity: number;
  variant: string;
};

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(username).trim();
  } catch {
    notFound();
  }
  if (!decoded || decoded.length > 80) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_profile_showcase", { p_username: decoded });
  if (error) {
    console.error("public_profile_showcase", error);
    return (
      <article>
        <span className="eyebrow">Profil public</span>
        <h1 className="display mt-2 text-3xl">La vitrine est momentanément indisponible</h1>
        <p className="mt-2 text-sm text-white/45">La migration 063 doit être appliquée pour activer les profils publics.</p>
      </article>
    );
  }

  const rows = (data ?? []) as ProfileRow[];
  if (rows.length === 0) notFound();
  const profile = rows[0];
  const cards = catalogCards();
  const { data: completionData, error: completionError } = await supabase.rpc(
    "public_profile_completion",
    { p_username: decoded },
  );
  if (completionError) console.error("public_profile_completion", completionError);
  const completionRow = ((completionData ?? []) as { owned_unique: number; total_active: number }[])[0];
  const ownedUnique = Number(completionRow?.owned_unique ?? 0);
  const totalActive = Number(completionRow?.total_active ?? 0);
  const completion = totalActive > 0 ? Math.round((ownedUnique / totalActive) * 100) : 0;
  const { data: auth } = await supabase.auth.getUser();
  const collection = profile.is_owner && auth.user ? await getCollection(supabase, auth.user.id) : [];
  const selected: ShowcaseCard[] = rows.map((row) => ({
    id: row.card_id && cards.some((card) => card.id === row.card_id) ? row.card_id : null,
    holo: row.holo_quantity > 0,
    variant: row.variant,
  }));
  const ownedCards = profile.is_owner
    ? collection.map((row) => getCard(row.cardId)).filter((card): card is NonNullable<typeof card> => Boolean(card))
    : [];
  const avatar = profile.avatar_card_id ? getCardArt(profile.avatar_card_id) : null;

  return (
    <article>
      <div className="panel flex flex-wrap items-center gap-4 p-5 sm:p-7">
        <AvatarFrame avatar={avatar} initial={profile.username} frameId={profile.frame} size={76} />
        <div className="min-w-0 flex-1">
          <span className="eyebrow">Collectionneur</span>
          <h1 className="display mt-1 truncate text-3xl sm:text-4xl">{profile.username}</h1>
          <p className="mt-1 text-sm text-white/40">Ses cartes à l’honneur</p>
          {completionRow && (
            <div className="mt-4 w-full max-w-sm">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-white/50">
                <span>Complétion de l’album</span>
                <span className="font-mono tabular-nums">
                  {completion} % · {ownedUnique}/{totalActive}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Complétion de l’album"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion}
                className="h-1.5 overflow-hidden rounded-full bg-white/10"
              >
                <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
      <ProfileShowcase cards={cards} availableCards={ownedCards} selectedIds={selected} editable={profile.is_owner} />
    </article>
  );
}
