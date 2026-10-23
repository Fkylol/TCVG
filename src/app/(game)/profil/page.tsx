import { ProfileEditor, type AvatarChoice } from "@/components/profile-editor";
import { requireSession } from "@/lib/auth";
import { CARDS, getCardNumber, getUniverseLabel, type Card } from "@/lib/cards";
import { getCollection, getProfile } from "@/lib/data";
import { collectionStats, unlockedFrames } from "@/lib/profile";
import { getPortrait } from "@/lib/portraits";
import { collectionScore } from "@/lib/stats";

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
  const score = collectionScore(owned);
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

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScoreTile label="Score de collection" value={score.quality} accent="text-acid" />
        <ScoreTile label="Puissance" value={score.power} />
        <ScoreTile label="Aura" value={score.aura} />
        <ScoreTile label="Cartes uniques" value={score.unique} />
      </div>
      <p className="mt-2 text-[11px] text-white/30">
        Le score additionne la qualité (60 % puissance, 40 % aura) de chaque carte possédée, une
        seule fois par personnage.
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

function ScoreTile({
  label,
  value,
  accent = "text-white/85",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${accent}`}>
        {value.toLocaleString("fr-FR")}
      </p>
    </div>
  );
}
