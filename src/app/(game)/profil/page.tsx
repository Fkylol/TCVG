import { ProfileEditor, type AvatarChoice } from "@/components/profile-editor";
import { requireSession } from "@/lib/auth";
import { CARDS, getCardNumber, getUniverseLabel, type Card } from "@/lib/cards";
import { getCollection, getProfile } from "@/lib/data";
import { collectionStats, unlockedFrames } from "@/lib/profile";
import { getPortrait } from "@/lib/portraits";

export const metadata = { title: "Profil — TCVG" };

export default async function ProfilePage() {
  const { supabase, user } = await requireSession();
  const [profile, collection] = await Promise.all([
    getProfile(supabase, user),
    getCollection(supabase, user.id),
  ]);

  const owned = collection
    .map((row) => CARDS.find((card) => card.id === row.cardId))
    .filter((card): card is Card => Boolean(card));

  const stats = collectionStats(owned);
  const unlocked = unlockedFrames(stats);

  const choices: AvatarChoice[] = owned
    .map((card) => ({
      id: card.id,
      name: card.name,
      number: getCardNumber(card.id) ?? 0,
      universe: getUniverseLabel(card.universe),
      url: getPortrait(card.id)?.url ?? null,
    }))
    .sort((a, b) => a.number - b.number);

  return (
    <div>
      <span className="eyebrow">Profil</span>
      <h1 className="display mt-2 text-4xl">{profile.username}</h1>
      <p className="mt-1 text-sm text-white/50">
        {stats.unique} personnage{stats.unique > 1 ? "s" : ""} · {stats.legendary} légendaire
        {stats.legendary > 1 ? "s" : ""} · {stats.mythic} mythique{stats.mythic > 1 ? "s" : ""}
      </p>

      <ProfileEditor
        username={profile.username}
        avatarCardId={profile.avatarCardId}
        frame={profile.frame}
        choices={choices}
        unlocked={unlocked}
      />
    </div>
  );
}
