"use client";

import { useEffect, useMemo, useState } from "react";
import type { CardPricePoint } from "@/lib/data";

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/**
 * Courbe du prix médian par jour, médiane en pointillés et volume de ventes
 * en barres. Tout est en SVG natif : aucune dépendance de graphe. Le gabarit
 * se resserre sous 640 px pour garder des libellés lisibles.
 */
export function CardPriceChart({
  points,
  today,
}: {
  points: CardPricePoint[];
  /** Jour courant fourni par le serveur : évite un décalage d'hydratation. */
  today: string;
}) {
  const [range, setRange] = useState<7 | 30>(30);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const chart = useMemo(() => {
    const width = compact ? 380 : 640;
    const height = compact ? 292 : 248;
    const left = compact ? 38 : 46;
    const right = 10;
    const top = 18;
    const bottom = compact ? 188 : 178;
    const volumeTop = compact ? 208 : 194;
    const volumeBottom = compact ? 248 : 228;

    const start = shiftDay(today, -(range - 1));
    const shown = points
      .filter((point) => point.day >= start && point.day <= today)
      .sort((a, b) => a.day.localeCompare(b.day));

    const sorted = shown.map((point) => point.median).sort((a, b) => a - b);
    const reference =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[Math.floor(sorted.length / 2)]
          : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);

    const low = sorted.length > 0 ? sorted[0] : 0;
    const high = sorted.length > 0 ? sorted[sorted.length - 1] : 1;
    const spread = Math.max(1, high - low);
    const min = Math.max(0, low - spread * 0.2);
    const max = high + spread * 0.2;

    const plotWidth = width - left - right;
    const plotHeight = bottom - top;
    const span = Math.max(1, range - 1);

    const x = (day: string) =>
      left + Math.min(1, Math.max(0, daysBetween(start, day) / span)) * plotWidth;
    const y = (value: number) => bottom - ((value - min) / (max - min)) * plotHeight;

    const line = shown
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(point.day).toFixed(1)} ${y(point.median).toFixed(1)}`,
      )
      .join(" ");

    const surface =
      shown.length > 1
        ? `${line} L${x(shown[shown.length - 1].day).toFixed(1)} ${bottom} L${x(shown[0].day).toFixed(1)} ${bottom} Z`
        : "";

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      volumeTop,
      volumeBottom,
      start,
      visible: shown,
      median: reference,
      min,
      max,
      maxVolume: Math.max(1, ...shown.map((point) => point.volume)),
      path: line,
      area: surface,
      x,
      y,
    };
  }, [compact, points, range, today]);

  const { visible, median, maxVolume, path, area, x, y } = chart;

  return (
    <section className="panel mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="display text-sm tracking-[0.16em] text-white/70">Prix médian par jour</h3>
          <p className="mt-0.5 text-[11px] text-white/35">
            Copies normales vendues · médiane sur la période
          </p>
        </div>

        <div className="tabs text-[11px]">
          {([7, 30] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              aria-pressed={range === value}
              className={`tab px-3 py-1.5 ${range === value ? "bg-cyan text-ink" : ""}`}
            >
              {value} j
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 border border-dashed border-white/[0.12] px-4 py-12 text-center text-sm text-white/40">
          Aucune vente sur les {range} derniers jours.
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label={`Prix médian par jour sur ${range} jours, ${visible.length} jour${visible.length > 1 ? "s" : ""} de ventes`}
            className="mt-3 h-auto w-full"
          >
            <defs>
              <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#36e2ff" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#36e2ff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map((ratio) => {
              const value = Math.round(chart.max - ratio * (chart.max - chart.min));
              const lineY = chart.top + ratio * (chart.bottom - chart.top);
              return (
                <g key={ratio}>
                  <line
                    x1={chart.left}
                    x2={chart.width - chart.right}
                    y1={lineY}
                    y2={lineY}
                    stroke="rgba(255,255,255,0.09)"
                    strokeDasharray="2 6"
                  />
                  <text
                    x={chart.left - 6}
                    y={lineY + 3}
                    textAnchor="end"
                    fontSize="9"
                    fontFamily="var(--font-mono), monospace"
                    fill="rgba(255,255,255,0.35)"
                  >
                    ◆{value}
                  </text>
                </g>
              );
            })}

            {area && <path d={area} fill="url(#price-area)" />}

            <line
              x1={chart.left}
              x2={chart.width - chart.right}
              y1={y(median)}
              y2={y(median)}
              stroke="rgba(255,255,255,0.45)"
              strokeDasharray="6 6"
            />

            <path d={path} fill="none" stroke="#36e2ff" strokeWidth="2" strokeLinejoin="round" />

            {visible.map((point) => (
              <circle
                key={point.day}
                cx={x(point.day)}
                cy={y(point.median)}
                r={compact ? 2.2 : 2.6}
                fill="#08090a"
                stroke="#36e2ff"
                strokeWidth="1.6"
              />
            ))}

            {visible.map((point) => {
              const height = (point.volume / maxVolume) * (chart.volumeBottom - chart.volumeTop);
              return (
                <rect
                  key={`volume-${point.day}`}
                  x={x(point.day) - (compact ? 2 : 2.5)}
                  y={chart.volumeBottom - height}
                  width={compact ? 4 : 5}
                  height={Math.max(1.5, height)}
                  fill="rgba(182,255,46,0.35)"
                />
              );
            })}

            <line
              x1={chart.left}
              x2={chart.width - chart.right}
              y1={chart.volumeBottom}
              y2={chart.volumeBottom}
              stroke="rgba(255,255,255,0.12)"
            />

            <text
              x={chart.left}
              y={chart.height - 8}
              fontSize="9"
              fontFamily="var(--font-mono), monospace"
              fill="rgba(255,255,255,0.35)"
            >
              {shortDay(chart.start)}
            </text>
            <text
              x={chart.width - chart.right}
              y={chart.height - 8}
              textAnchor="end"
              fontSize="9"
              fontFamily="var(--font-mono), monospace"
              fill="rgba(255,255,255,0.35)"
            >
              {shortDay(today)}
            </text>
            <text
              x={chart.width - chart.right}
              y={chart.volumeTop - 4}
              textAnchor="end"
              fontSize="8"
              fontFamily="var(--font-mono), monospace"
              fill="rgba(255,255,255,0.25)"
            >
              volumes
            </text>
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-white/40">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-px w-5 bg-cyan" />
              Prix médian du jour
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-px w-5 border-t border-dashed border-white/45" />
              Médiane de la période :{" "}
              <span className="font-mono text-white/60">◆ {median}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 bg-cyan/35" />
              Volume de ventes
            </span>
          </div>
        </>
      )}
    </section>
  );
}
