import Image from "next/image";
import { CATALOG_SIZE } from "@/lib/cards";
import { getCardArt } from "@/lib/card-art";
import { AvatarFrame } from "@/components/avatar-frame";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Classement — TCVG" };

type Row = {
  rank: number;
  username: string;
  avatar_card_id: string | null;
  frame: string | null;
  unique_cards: number;
  total_cards: number;
  boosters_opened: number;
  collection_score: number;
};

// Le tri et le calcul des rangs sont faits en base (`leaderboard()`), qui ne
// renvoie que pseudo, avatar, cadre et compteurs — jamais un email ou un id.
async function getRanking(): Promise<{ rows: Row[]; failed: boolean; viewer: string | null }> {
  const supabase = await createClient();
  const [{ data, error }, session] = await Promise.all([
    supabase.rpc("leaderboard", { p_limit: 50 }),
    supabase.auth.getUser(),
  ]);

  if (error) {
    console.error("leaderboard", error);
    return { rows: [], failed: true, viewer: null };
  }

  let viewer: string | null = null;
  if (session.data.user) {
    const profile = await supabase
      .from("profiles")
      .select("username")
      .eq("id", session.data.user.id)
      .maybeSingle();
    viewer = (profile.data?.username as string | null) ?? null;
  }

  return { rows: (data ?? []) as Row[], failed: false, viewer };
}

export default async function LeaderboardPage() {
  const { rows, failed, viewer } = await getRanking();

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const leaderScore = rows[0]?.collection_score ?? 0;

  return (
    <article>
      <span className="eyebrow">Classement</span>
      <h1 className="display mt-2 text-4xl">Les plus grands collectionneurs</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Le score additionne la qualité de chaque personnage possédé, comptée une seule fois. À
        égalité, l&apos;album le plus large l&apos;emporte, puis le total de cartes. Seuls les
        joueurs ayant ouvert au moins un booster apparaissent.
      </p>

      {!failed && rows.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="chip">
            {rows.length >= 50
              ? "Top 50"
              : `${rows.length} joueur${rows.length > 1 ? "s" : ""} classé${rows.length > 1 ? "s" : ""}`}
          </span>
          <span className="chip">{CATALOG_SIZE} personnages au catalogue</span>
          <span className="chip">Score de collection</span>
        </div>
      )}

      {failed ? (
        <p
          role="alert"
          className="mt-8 border-l-2 border-amber-400/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          Le classement est momentanément indisponible. Réessaie dans un instant.
        </p>
      ) : rows.length === 0 ? (
        <p className="panel mt-8 px-4 py-10 text-center text-sm text-white/45">
          Personne n&apos;est encore classé. Ouvre ton premier booster pour ouvrir la voie.
        </p>
      ) : (
        <>
          {/* ————— Podium ————— */}
          <ol aria-label="Podium" className="mt-8 grid gap-3 sm:grid-cols-3 sm:items-end">
            {podium.map((row) => (
              <PodiumCard
                key={`podium-${row.rank}-${row.username}`}
                row={row}
                leaderScore={leaderScore}
                isViewer={viewer !== null && row.username === viewer}
              />
            ))}
          </ol>

          {rest.length > 0 && (
            <>
              <div className="mt-10 flex items-end justify-between gap-4">
                <h2 className="display text-lg text-white/85">La suite du classement</h2>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/30">
                  rangs 4 à {rows.length}
                </span>
              </div>
              <span className="section-rule section-rule-tight" aria-hidden />

              <ol
                start={4}
                aria-label="Suite du classement"
                className="overflow-hidden rounded-[var(--radius)] border border-white/10"
              >
                {rest.map((row) => (
                  <RankRow
                    key={`${row.rank}-${row.username}`}
                    row={row}
                    isViewer={viewer !== null && row.username === viewer}
                  />
                ))}
              </ol>
            </>
          )}

          <p className="mt-6 font-mono text-[11px] leading-relaxed text-white/30">
            Score = somme de la qualité des personnages possédés (60 % puissance, 40 % aura), une
            fois par personnage. Les comptes sans booster ouvert sont exclus du classement.
          </p>
        </>
      )}
    </article>
  );
}

/** Couleurs de marche du podium : or, argent, bronze. */
const STEP = [
  { label: "1", medal: "Champion", num: "text-acid", bar: "bg-acid" },
  { label: "2", medal: "Dauphin", num: "text-slate-200", bar: "bg-slate-300" },
  { label: "3", medal: "Podium", num: "text-amber-300", bar: "bg-amber-400" },
] as const;

function PodiumCard({
  row,
  leaderScore,
  isViewer,
}: {
  row: Row;
  leaderScore: number;
  isViewer: boolean;
}) {
  const step = STEP[row.rank - 1] ?? STEP[2];
  const art = row.avatar_card_id ? getCardArt(row.avatar_card_id) : null;
  const ratio = leaderScore > 0 ? Math.max(0.08, row.collection_score / leaderScore) : 0;
  const coverage = CATALOG_SIZE > 0 ? Math.min(1, row.unique_cards / CATALOG_SIZE) : 0;

  return (
    <li
      className={`panel ${row.rank === 1 ? "panel-accent" : ""} relative overflow-hidden px-4 pb-4 pt-5 ${
        row.rank === 1 ? "sm:pb-6 sm:pt-7" : ""
      }`}
    >
      {row.rank === 1 && (
        <>
          <span className="absolute inset-x-0 top-0 h-px bg-acid/60" aria-hidden />
          {art && (
            <Image
              src={art.src}
              alt=""
              width={176}
              height={176}
              unoptimized={!art.local}
              style={art.framing}
              className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 object-cover opacity-[0.18] [mask-image:radial-gradient(circle_at_62%_38%,black,transparent_72%)]"
              aria-hidden
            />
          )}
        </>
      )}
      <span
        className={`display pointer-events-none absolute -top-3 right-2 text-[5.5rem] leading-none ${step.num} opacity-[0.13]`}
        aria-hidden
      >
        {row.rank}
      </span>

      <div className="relative flex items-center gap-3">
        <AvatarFrame
          avatar={art}
          initial={row.username.charAt(0).toUpperCase()}
          frameId={row.frame}
          size={row.rank === 1 ? 56 : 46}
        />
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            {step.medal}
            {isViewer && <span className="ml-2 text-acid">toi</span>}
          </p>
          <p className="truncate font-display text-base text-white/90">{row.username}</p>
        </div>
      </div>

      <p className="relative mt-4 font-mono text-2xl font-semibold tabular-nums text-white">
        {row.collection_score.toLocaleString("fr-FR")}
        <span className="ml-1.5 text-[10px] font-normal uppercase tracking-[0.14em] text-white/35">
          pts
        </span>
      </p>

      <div className="relative mt-3 h-1 overflow-hidden rounded-[1px] bg-white/10">
        <span className={`block h-full ${step.bar}`} style={{ width: `${ratio * 100}%` }} />
      </div>

      <p className="relative mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-white/40">
        <span className="text-white/65">{row.unique_cards}</span> personnages
        <span className="text-white/15">/</span>
        <span>{Math.round(coverage * 100)} % de l&apos;album</span>
      </p>
    </li>
  );
}

function RankRow({ row, isViewer }: { row: Row; isViewer: boolean }) {
  const art = row.avatar_card_id ? getCardArt(row.avatar_card_id) : null;
  const coverage = CATALOG_SIZE > 0 ? Math.min(1, row.unique_cards / CATALOG_SIZE) : 0;

  return (
    <li
      className={`group flex items-center gap-3 border-b border-white/[0.07] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.04] ${
        isViewer ? "bg-acid/[0.06] shadow-[inset_2px_0_0_0_var(--acid)]" : "odd:bg-white/[0.02]"
      }`}
    >
      <span className="w-8 shrink-0 text-center font-mono text-xs tabular-nums text-white/35">
        {String(row.rank).padStart(2, "0")}
      </span>

      <AvatarFrame
        avatar={art}
        initial={row.username.charAt(0).toUpperCase()}
        frameId={row.frame}
        size={32}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-white/80">{row.username}</span>
          {isViewer && (
            <span className="rounded-[var(--radius-sm)] border border-acid/40 px-1 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-acid">
              toi
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="hidden h-[3px] w-full max-w-[180px] overflow-hidden rounded-[1px] bg-white/[0.08] sm:block">
            <span
              className="block h-full bg-white/30 transition-colors group-hover:bg-acid/70"
              style={{ width: `${coverage * 100}%` }}
            />
          </span>
          <span className="font-mono text-[10px] tabular-nums text-white/30">
            {row.unique_cards}
            <span className="text-white/15">/{CATALOG_SIZE}</span>
          </span>
        </div>
      </div>

      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm tabular-nums text-acid">
          {row.collection_score.toLocaleString("fr-FR")}
        </span>
        <span className="block font-mono text-[10px] tabular-nums text-white/25">
          {row.total_cards} cartes
        </span>
      </span>
    </li>
  );
}

