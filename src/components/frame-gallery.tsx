"use client";

import { useMemo, useState } from "react";
import { AvatarFrame, type AvatarArt } from "@/components/avatar-frame";
import { FRAME_LANES, frameIndex, type FrameLane } from "@/lib/frames.config";
import type { FrameView } from "@/lib/frames";
import { MIN_POOL_SIZE } from "@/lib/packs";
import { useLocale } from "@/components/locale-provider";

function dateLabel(value: string | null, locale: "fr" | "en"): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function prestigeLabel(value: number): string {
  return "◆".repeat(Math.max(1, Math.min(5, value)));
}

function statusLabel(frame: FrameView, t: (text: string) => string): string {
  if (frame.unlocked) return frame.active ? t("Débloqué") : t("Débloqué · indisponible");
  if (frame.expired) return t("Saison terminée");
  if (!frame.active && frame.soon) return t("Bientôt");
  if (!frame.active) return t("Indisponible");
  return t("Verrouillé");
}

/**
 * Grille des cadres, groupée par voie. Le parent garde la sélection dans un
 * champ caché du formulaire ; cliquer une carte ne fait que prévisualiser.
 */
export function FrameGallery({
  frames,
  selectedFrameId,
  onSelect,
  avatar,
  initial,
}: {
  frames: FrameView[];
  selectedFrameId: string;
  onSelect: (frameId: string) => void;
  avatar: AvatarArt | null;
  initial: string;
}) {
  const { locale, t } = useLocale();
  const [lane, setLane] = useState<FrameLane>("album");
  const laneFrames = useMemo(
    () =>
      frames
        .filter((frame) => frame.lane === lane)
        .sort((a, b) => frameIndex(a.id) - frameIndex(b.id)),
    [frames, lane],
  );

  return (
    <div className="mt-4">
      <div className="tabs flex-wrap text-xs" role="tablist" aria-label={t("Voies des cadres")}>
        {FRAME_LANES.map((item) => {
          const count = frames.filter((frame) => frame.lane === item.id && frame.unlocked).length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={lane === item.id}
              onClick={() => setLane(item.id)}
              className={`tab px-3 py-1.5 ${lane === item.id ? "bg-cyan text-ink" : ""}`}
            >
              {t(item.label)}
              <span className={`ml-1.5 font-mono text-[10px] ${lane === item.id ? "text-ink/60" : "text-white/30"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-white/35">
        {t(FRAME_LANES.find((item) => item.id === lane)?.hint ?? "")}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {laneFrames.map((frame) => {
          const progress = frame.progress;
          const selected = frame.id === selectedFrameId;
          const clickable = frame.unlocked && frame.active;
          const showProgress =
            !frame.unlocked && progress && progress.available && !progress.hidden;

          return (
            <button
              key={frame.id}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect(frame.id)}
              aria-pressed={selected}
              className={`cut relative flex min-h-[148px] gap-3 border p-3.5 text-left transition ${
                selected
                  ? "border-cyan bg-cyan/[0.08]"
                  : clickable
                    ? "border-white/10 bg-white/[0.02] hover:border-white/25"
                    : "border-white/[0.07] bg-white/[0.015]"
              }`}
            >
              <div className="relative shrink-0 self-start">
                <AvatarFrame
                  avatar={avatar}
                  initial={initial}
                  size={52}
                  frameId={frame.id}
                  locked={!frame.unlocked}
                />
                {selected && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-cyan px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-wide text-ink">
                    {t("Équipé")}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-white/90">{t(frame.name)}</span>
                  <span
                    className="font-mono text-[8px] tracking-[0.12em] text-cyan/70"
                    title={`${t("Prestige")} ${frame.prestige} ${t("sur 5")}`}
                  >
                    {prestigeLabel(frame.prestige)}
                  </span>
                  {frame.secret && (
                    <span className="rounded border border-fuchsia-300/30 px-1 py-px font-mono text-[8px] uppercase tracking-wide text-fuchsia-200/70">
                      secret
                    </span>
                  )}
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-white/45">{t(frame.description)}</p>

                <div className="mt-2 font-mono text-[10px] text-white/40">
                  {frame.unlocked ? (
                    <span className={frame.active ? "text-emerald-300/80" : "text-amber-200/80"}>
                      {frame.active
                        ? `${t("Débloqué")}${frame.unlockedAt ? ` ${t("Débloqué le")} ${dateLabel(frame.unlockedAt, locale)}` : ""}`
                        : t("Débloqué · indisponible")}
                    </span>
                  ) : (
                    <span className="text-white/50">
                      {statusLabel(frame, t)}
                      {progress?.condition && !progress.hidden ? ` · ${t(progress.condition)}` : ""}
                    </span>
                  )}
                </div>

                {showProgress && (
                  <>
                    <div className="mt-2 h-1 overflow-hidden rounded-[1px] bg-white/10">
                      <span
                        className="block h-full bg-cyan/70"
                        style={{ width: `${Math.min(100, progress.percent)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 font-mono text-[10px]">
                      <span className="text-white/55">{t(progress.detail)}</span>
                      <span className="text-white/35">{t(progress.remaining)}</span>
                    </div>
                    <p className="mt-0.5 text-right font-mono text-[9px] text-white/25">
                      {Math.max(0, 100 - progress.percent)} % {t("restants")}
                    </p>
                  </>
                )}

                {!frame.unlocked && progress?.soon && (
                  <p className="mt-1.5 text-[10px] text-amber-200/80">
                    {t("Bientôt : le genre doit compter au moins")} {MIN_POOL_SIZE} {t("personnages actifs.")}
                    {progress.detail ? ` (${t(progress.detail)})` : ""}
                  </p>
                )}

                {!frame.unlocked && progress?.expired && (
                  <p className="mt-1.5 text-[10px] text-white/35">
                    {t("La fenêtre de ce cadre est terminée.")}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
