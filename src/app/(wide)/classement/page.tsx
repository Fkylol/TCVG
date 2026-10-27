import { catalogSize } from "@/lib/cards";
import { LeaderboardBoard, type LeaderboardRow } from "@/components/leaderboard-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Classement — TCVG" };

type Row = LeaderboardRow & { boosters_opened: number };

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

  return (
    <article>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Classement</span>
          <h1 className="display mt-2 text-3xl sm:text-4xl">Les plus grands collectionneurs</h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-white/50">
          Chaque personnage possédé compte une fois, à sa valeur. Les égalités se tranchent à
          l&apos;album le plus large.
        </p>
      </div>
      <span className="title-rule" aria-hidden />

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
        <LeaderboardBoard rows={rows} viewer={viewer} catalogSize={catalogSize()} />
      )}
    </article>
  );
}
