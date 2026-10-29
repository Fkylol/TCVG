import Link from "next/link";
import { MotionToggle } from "@/components/motion-toggle";
import { ProfileEditor, type AvatarChoice } from "@/components/profile-editor";
import { requireSession } from "@/lib/auth";
import { getCard, getCardNumber, getUniverseLabel, type Card } from "@/lib/cards";
import { getCollection, getProfile } from "@/lib/data";
import { evaluateFrames, getFrameOverview } from "@/lib/frames";
import { collectionStats } from "@/lib/profile";
import { getCardArt } from "@/lib/card-art";
import { collectionScore } from "@/lib/stats";

export const metadata = { title: "Profil — TCVG" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ cadre?: string }>;
}) {
  const { cadre } = await searchParams;
  const { supabase, user } = await requireSession();

  // Les déblocages sont permanents : on évalue à chaque visite du profil, ce
  // qui rattrape aussi une vente ou un changement de catalogue.
  const evaluation = await evaluateFrames(user.id);

  const [profile, collection, overview] = await Promise.all([
    getProfile(supabase, user),
    getCollection(supabase, user.id),
    getFrameOverview(supabase, user.id),
  ]);

  const owned = collection
    .map((row) => getCard(row.cardId))
    .filter((card): card is Card => Boolean(card));

  const stats = collectionStats(owned);
  const score = collectionScore(owned);

  const choices: AvatarChoice[] = owned
    .map((card) => ({
      id: card.id,
      name: card.name,
      number: getCardNumber(card.id) ?? 0,
      universe: getUniverseLabel(card.universe),
      url: getCardArt(card.id)?.src ?? null,
    }))
    .sort((a, b) => a.number - b.number);

  const initialFrame =
    cadre && overview.frames.some((frame) => frame.id === cadre && frame.unlocked)
      ? cadre
      : null;

  return (
    <div>
      <span className="eyebrow">Profil</span>
      <h1 className="display mt-2 text-4xl">{profile.username}</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 font-mono text-sm text-white/50">
        {stats.unique} personnage{stats.unique > 1 ? "s" : ""} · {stats.legendary} légendaire
        {stats.legendary > 1 ? "s" : ""} · {stats.mythic} mythique{stats.mythic > 1 ? "s" : ""}
      </p>
      <Link
        href={`/joueur/${encodeURIComponent(profile.username)}`}
        className="btn btn-outline btn-sm mt-4"
      >
        Voir mon profil public →
      </Link>

      {evaluation.newlyUnlocked.length > 0 && (
        <div className="mt-4 border-l-2 border-cyan bg-cyan/[0.08] px-4 py-3 text-sm">
          <span className="font-semibold text-cyan">
            {evaluation.newlyUnlocked.length > 1
              ? "Nouveaux cadres débloqués"
              : "Nouveau cadre débloqué"}
            {" : "}
          </span>
          <span className="text-white/80">
            {evaluation.newlyUnlocked.map((frame) => frame.name).join(", ")}
          </span>
          {" "}
          <Link href="#cadres" className="text-[12px] text-cyan hover:underline">
            Choisir →
          </Link>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScoreTile label="Score de collection" value={score.quality} accent="text-cyan" />
        <ScoreTile label="Puissance" value={score.power} />
        <ScoreTile label="Aura" value={score.aura} />
        <ScoreTile label="Cartes uniques" value={score.unique} />
      </div>
      <p className="mt-2 text-[11px] text-white/30">
        Le score additionne la qualité (60 % puissance, 40 % aura) de chaque carte possédée, une
        seule fois par personnage.
      </p>

      {/* Envies et parrainage ne sont plus dans l'en-tête : ils vivent ici. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/envies"
          className="panel flex items-center justify-between gap-3 p-3.5 transition hover:border-cyan/50"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-white/35">
              Envies
            </span>
            <span className="mt-1 block text-sm text-white/80">
              Les cartes qui te manquent, et les annonces à ton prix
            </span>
          </span>
          <span aria-hidden className="text-cyan">
            →
          </span>
        </Link>
        <Link
          href="/parrainage"
          className="panel flex items-center justify-between gap-3 p-3.5 transition hover:border-cyan/50"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-white/35">
              Parrainage
            </span>
            <span className="mt-1 block text-sm text-white/80">
              Ton code, tes filleuls et les boosters gagnés
            </span>
          </span>
          <span aria-hidden className="text-cyan">
            →
          </span>
        </Link>
      </div>

      <ProfileEditor
        username={profile.username}
        avatarCardId={profile.avatarCardId}
        selectedFrameId={overview.selectedFrameId}
        choices={choices}
        frames={overview.frames}
        unlockedCount={overview.unlockedCount}
        activeTotal={overview.activeTotal}
        next={overview.next}
        initialFrame={initialFrame}
      />

      <MotionToggle />
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
    <div className="panel p-3.5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${accent}`}>
        {value.toLocaleString("fr-FR")}
      </p>
    </div>
  );
}
