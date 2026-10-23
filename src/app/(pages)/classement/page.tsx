import Image from "next/image";
import { FRAMES, frameOf } from "@/lib/profile";
import { getPortrait } from "@/lib/portraits";
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
};

// Le tri et le calcul des rangs sont faits en base (`leaderboard()`), qui ne
// renvoie que pseudo, avatar, cadre et compteurs — jamais un email ou un id.
async function getRanking(): Promise<{ rows: Row[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard", { p_limit: 50 });

  if (error) {
    console.error("leaderboard", error);
    return { rows: [], failed: true };
  }

  return { rows: (data ?? []) as Row[], failed: false };
}

export default async function LeaderboardPage() {
  const { rows, failed } = await getRanking();

  return (
    <article>
      <span className="eyebrow">Classement</span>
      <h1 className="display mt-2 text-4xl">Les plus grands collectionneurs</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Classement par nombre de personnages différents possédés, puis par nombre total de cartes
        (doublons compris). Seuls les joueurs ayant ouvert au moins un booster apparaissent.
      </p>

      {failed ? (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          Le classement est momentanément indisponible. Réessaie dans un instant.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">
          Personne n&apos;est encore classé. Ouvre ton premier booster pour ouvrir la voie.
        </p>
      ) : (
        <ol className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          {rows.map((row) => {
            const portrait = row.avatar_card_id ? getPortrait(row.avatar_card_id) : undefined;
            const frame = FRAMES[frameOf(row.frame ?? "steel")];
            const initial = row.username.charAt(0).toUpperCase();

            return (
              <li
                key={`${row.rank}-${row.username}`}
                className="flex items-center gap-3 border-b border-white/[0.07] px-3 py-2.5 last:border-b-0 odd:bg-white/[0.02]"
              >
                <span className="w-7 shrink-0 text-center font-mono text-xs text-white/40">
                  {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
                </span>
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-acid to-cyan text-[11px] font-bold text-ink ring-2 ${frame.ring} ${frame.glow}`}
                >
                  {portrait ? (
                    <Image
                      src={portrait.url}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    initial
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white/80">{row.username}</span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm text-white">{row.total_cards}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-white/35">
                    {row.unique_cards} perso.
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
