"use client";

import { useMemo, useState } from "react";
import { AvatarFrame } from "@/components/avatar-frame";
import { getCardArt } from "@/lib/card-art";
import { podiumRank } from "@/lib/leaderboard-ranks";

export type LeaderboardRow = {
  rank: number;
  username: string;
  avatar_card_id: string | null;
  frame: string | null;
  unique_cards: number;
  total_cards: number;
  collection_score: number;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Part de l'album possédée, en clair : « 62 % de l'album ».
 *
 * Le classement n'a qu'un vocabulaire de rang, celui du podium (Souverain,
 * Régent, Vizir, dans `src/lib/leaderboard-ranks.ts`). La couverture de l'album
 * se dit donc en pourcentage, jamais par un titre que le jeu n'a pas.
 */
function albumShare(ratio: number): string {
  return `${Math.round(ratio * 100)} % de l'album`;
}

export function LeaderboardBoard({
  rows,
  viewer,
  catalogSize,
}: {
  rows: LeaderboardRow[];
  viewer: string | null;
  catalogSize: number;
}) {
  const [query, setQuery] = useState("");
  const needle = normalize(query);
  const leaderScore = rows[0]?.collection_score ?? 0;

  const visible = useMemo(
    () => (needle ? rows.filter((row) => normalize(row.username).includes(needle)) : rows),
    [needle, rows],
  );

  // Le podium n'a de sens que sur le classement complet.
  const podium = needle ? [] : visible.slice(0, 3);
  const rest = needle ? visible : visible.slice(3);

  // La barre du bas suit le joueur : sa ligne s'il est classé, sinon le leader.
  const viewerRow = viewer ? rows.find((row) => row.username === viewer) : undefined;
  const pinned = viewerRow ?? rows[0];
  const pinnedIsViewer = Boolean(viewerRow);
  const coverage = (unique: number) => (catalogSize > 0 ? Math.min(1, unique / catalogSize) : 0);

  return (
    <>
      {/* ————— Recherche ————— */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="group relative block w-full sm:max-w-sm">
          <span className="sr-only">Chercher un joueur</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-cyan/70"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher un joueur pour te comparer…"
            autoComplete="off"
            className="w-full rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white/85 outline-none transition-colors placeholder:text-white/30 focus:border-cyan/45 focus:bg-cyan/[0.03]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <span className="chip">
            {needle
              ? `${visible.length} résultat${visible.length > 1 ? "s" : ""}`
              : rows.length >= 50
                ? "Top 50"
                : `${rows.length} classé${rows.length > 1 ? "s" : ""}`}
          </span>
          <span className="chip">{catalogSize} personnages</span>
          <span className="chip">Score de collection</span>
        </div>
      </div>

      {/* ————— Podium ————— */}
      {podium.length > 0 && (
        <ol aria-label="Podium" className="mt-9 grid gap-3 sm:grid-cols-3 sm:items-end">
          {podium.map((row) => (
            <PodiumCard
              key={`podium-${row.rank}-${row.username}`}
              row={row}
              leaderScore={leaderScore}
              coverage={coverage(row.unique_cards)}
              isViewer={viewer !== null && row.username === viewer}
            />
          ))}
        </ol>
      )}

      {/* ————— Suite du classement ————— */}
      {rest.length > 0 ? (
        <>
          <div className="mt-10 flex items-end justify-between gap-4">
            <h2 className="display text-lg text-white/85">
              {needle ? "Résultats" : "La suite du classement"}
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/30">
              {needle
                ? `${visible.length} joueur${visible.length > 1 ? "s" : ""}`
                : `rangs ${rest[0].rank} à ${rest[rest.length - 1].rank}`}
            </span>
          </div>
          <span className="section-rule section-rule-tight" aria-hidden />

          <ol
            start={rest[0].rank}
            aria-label="Suite du classement"
            className="overflow-hidden rounded-[var(--radius)] border border-white/10 bg-[var(--panel-bg-deep)]"
          >
            {rest.map((row) => (
              <RankRow
                key={`${row.rank}-${row.username}`}
                row={row}
                coverage={coverage(row.unique_cards)}
                isViewer={viewer !== null && row.username === viewer}
              />
            ))}
          </ol>
        </>
      ) : (
        <p className="panel mt-8 px-4 py-10 text-center text-sm text-white/45">
          Aucun joueur ne correspond à « {query.trim()} ».{" "}
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-cyan underline-offset-4 hover:underline"
          >
            Effacer la recherche
          </button>
        </p>
      )}

      <p className="mt-6 font-mono text-[11px] leading-relaxed text-white/30">
        Score = somme de la qualité des personnages possédés (60 % puissance, 40 % aura), une fois
        par personnage. À égalité, l&apos;album le plus large l&apos;emporte, puis le total de
        cartes. Les comptes sans booster ouvert sont exclus.
      </p>

      {/* Laisse la place à la barre épinglée. */}
      <div aria-hidden className="h-16" />

      {/* ————— Barre épinglée : le joueur suit le scroll ————— */}
      {pinned && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-2 pb-2 sm:px-4 sm:pb-3">
          <div
            className={`mx-auto flex max-w-6xl items-center gap-3 rounded-[var(--radius)] border px-3 py-2 backdrop-blur-md ${
              pinnedIsViewer
                ? "border-cyan/30 bg-ink/90 shadow-[0_-12px_40px_-18px_rgba(54,226,255,0.35)]"
                : "border-white/12 bg-ink/85"
            }`}
          >
            <span className="w-8 shrink-0 text-center font-mono text-xs tabular-nums text-white/45">
              {String(pinned.rank).padStart(2, "0")}
            </span>
            <AvatarFrame
              avatar={pinned.avatar_card_id ? getCardArt(pinned.avatar_card_id) : null}
              initial={pinned.username.charAt(0).toUpperCase()}
              frameId={pinned.frame}
              size={34}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm text-white/85">{pinned.username}</span>
                <span
                  className={`rounded-[var(--radius-sm)] border px-1 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${
                    pinnedIsViewer
                      ? "border-cyan/40 text-cyan"
                      : "border-white/15 text-white/40"
                  }`}
                >
                  {pinnedIsViewer ? "toi" : "leader"}
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 sm:inline">
                  {albumShare(coverage(pinned.unique_cards))}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-[1px] bg-white/[0.08]">
                <span
                  className={`block h-full ${pinnedIsViewer ? "bg-cyan/70" : "bg-white/30"}`}
                  style={{ width: `${coverage(pinned.unique_cards) * 100}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="block font-mono text-sm tabular-nums text-white">
                {pinned.collection_score.toLocaleString("fr-FR")}
                <span className="ml-1 text-[9px] uppercase tracking-[0.12em] text-white/30">
                  pts
                </span>
              </span>
              <span className="block font-mono text-[10px] tabular-nums text-white/30">
                {pinned.total_cards} cartes
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PodiumCard({
  row,
  leaderScore,
  coverage,
  isViewer,
}: {
  row: LeaderboardRow;
  leaderScore: number;
  coverage: number;
  isViewer: boolean;
}) {
  // Libellés et couleurs du podium : `src/lib/leaderboard-ranks.ts`.
  const medal = podiumRank(row.rank);
  const art = row.avatar_card_id ? getCardArt(row.avatar_card_id) : null;
  const ratio = leaderScore > 0 ? Math.max(0.06, row.collection_score / leaderScore) : 0;
  const isFirst = row.rank === 1;

  return (
    <li
      className={`relative flex flex-col items-center ${
        isFirst ? "sm:order-2" : row.rank === 2 ? "sm:order-1" : "sm:order-3"
      }`}
    >
      <div className="relative">
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full blur-2xl ${
            isFirst ? "bg-[#f6cd61]/20" : "bg-white/[0.06]"
          }`}
        />
        <AvatarFrame
          avatar={art}
          initial={row.username.charAt(0).toUpperCase()}
          frameId={row.frame}
          size={isFirst ? 92 : 70}
        />
      </div>

      <p
        className={`mt-3 max-w-full truncate font-display uppercase tracking-[0.06em] ${
          isFirst ? "text-xl text-white" : "text-base text-white/85"
        }`}
      >
        {row.username}
      </p>
      <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className={medal.text}>{albumShare(coverage)}</span>
        <span className="text-white/15">·</span>
        <span className="text-white/35">{medal.label}</span>
        {isViewer && <span className="text-cyan">toi</span>}
      </p>

      <div
        className={`relative mt-3 w-full rounded-[var(--radius)] border text-center ${medal.border} ${medal.wash} ${
          isFirst ? `px-4 pb-4 pt-6 ${medal.glow}` : "px-4 pb-3.5 pt-5"
        }`}
      >
        <span
          className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-px font-mono text-[11px] font-semibold tabular-nums ${medal.border} bg-ink ${medal.text}`}
        >
          {row.rank}
        </span>

        <p
          className={`display tabular-nums ${isFirst ? `text-4xl ${medal.text}` : `text-2xl ${medal.text}`}`}
        >
          {row.collection_score.toLocaleString("fr-FR")}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          points
        </p>

        <div className="mt-3 h-[3px] overflow-hidden rounded-[1px] bg-white/10">
          <span className={`block h-full ${medal.bar}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="mt-2 font-mono text-[11px] text-white/40">
          <span className="text-white/70">{row.unique_cards}</span> personnages
          <span className="mx-1.5 text-white/15">/</span>
          {row.total_cards} cartes
        </p>
      </div>
    </li>
  );
}

function RankRow({
  row,
  coverage,
  isViewer,
}: {
  row: LeaderboardRow;
  coverage: number;
  isViewer: boolean;
}) {
  const art = row.avatar_card_id ? getCardArt(row.avatar_card_id) : null;

  return (
    <li
      className={`group grid grid-cols-[2rem_auto_1fr_auto] items-center gap-3 border-b border-white/[0.07] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.04] sm:grid-cols-[2.5rem_auto_1fr_auto_auto_auto] sm:gap-4 ${
        isViewer
          ? "bg-cyan/[0.06] shadow-[inset_2px_0_0_0_var(--cyan)]"
          : "odd:bg-white/[0.02]"
      }`}
    >
      <span className="text-center font-mono text-xs tabular-nums text-white/35">
        {String(row.rank).padStart(2, "0")}
      </span>

      <AvatarFrame
        avatar={art}
        initial={row.username.charAt(0).toUpperCase()}
        frameId={row.frame}
        size={34}
      />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-white/85">{row.username}</span>
          {isViewer && (
            <span className="rounded-[var(--radius-sm)] border border-cyan/40 px-1 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-cyan">
              toi
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="hidden h-[3px] w-full max-w-[220px] overflow-hidden rounded-[1px] bg-white/[0.08] sm:block">
            <span
              className="block h-full bg-white/25 transition-colors group-hover:bg-cyan/70"
              style={{ width: `${coverage * 100}%` }}
            />
          </span>
          <span className="font-mono text-[10px] tabular-nums text-white/30">
            {row.unique_cards}
            <span className="text-white/15"> persos</span>
          </span>
        </div>
      </div>

      <span className="hidden min-w-[7.5rem] items-center justify-center rounded-[var(--radius-sm)] border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45 sm:inline-flex">
        {albumShare(coverage)}
      </span>

      <span className="text-right">
        <span className="block font-mono text-sm tabular-nums text-white/90">
          {row.collection_score.toLocaleString("fr-FR")}
        </span>
        <span className="block font-mono text-[10px] tabular-nums text-white/25">pts</span>
      </span>

      <span className="hidden min-w-[4.5rem] text-right font-mono text-[11px] tabular-nums text-white/30 sm:block">
        {row.total_cards} cartes
      </span>
    </li>
  );
}
