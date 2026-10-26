"use client";

import { useState } from "react";
import { AvatarFrame } from "@/components/avatar-frame";
import { getCardArt } from "@/lib/card-art";
import { FRAMES, FRAME_LANES } from "@/lib/frames.config";

const DEMO_AVATARS = [
  { id: "kratos", initial: "K" },
  { id: "mario", initial: "M" },
  { id: "link", initial: "L" },
];

const SIZES = [24, 40, 72];

export function FrameLab() {
  const [unlocked, setUnlocked] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/10 bg-ink/95 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setUnlocked((value) => !value)}
          className={`btn btn-sm ${unlocked ? "btn-primary" : "btn-outline"}`}
        >
          {unlocked ? "Débloqué" : "Verrouillé"}
        </button>
        <button
          type="button"
          onClick={() => setReducedMotion((value) => !value)}
          className={`btn btn-sm ${reducedMotion ? "btn-primary" : "btn-outline"}`}
        >
          Animations réduites
        </button>
        <p className="text-[11px] text-white/40">
          {FRAMES.length} cadres · 3 avatars · tailles 24 / 40 / 72 px
        </p>
      </div>

      {FRAME_LANES.map((lane) => (
        <section key={lane.id} className="mt-8">
          <h2 className="display text-2xl">{lane.label}</h2>
          <p className="text-xs text-white/40">{lane.hint}</p>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {FRAMES.filter((frame) => frame.lane === lane.id).map((frame) => (
              <article key={frame.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/85">{frame.name}</h3>
                    <p className="font-mono text-[9px] text-white/30">
                      {frame.id} · prestige {frame.prestige}/5
                      {frame.animated ? " · animé" : ""}
                      {frame.secret ? " · secret" : ""}
                    </p>
                  </div>
                  <span className="font-mono text-[9px] text-acid/60">
                    {"◆".repeat(frame.prestige)}
                  </span>
                </div>

                <p className="mt-2 min-h-8 text-[11px] leading-relaxed text-white/40">
                  {frame.description}
                </p>

                <div className="mt-4 flex flex-wrap items-end gap-5">
                  {DEMO_AVATARS.map((avatar) => {
                    const art = getCardArt(avatar.id);
                    return (
                      <div key={avatar.id} className="flex items-end gap-2">
                        {SIZES.map((size) => (
                          <div key={size} className="text-center">
                            <AvatarFrame
                              avatar={art}
                              initial={avatar.initial}
                              size={size}
                              frameId={frame.id}
                              locked={!unlocked}
                              reducedMotion={reducedMotion}
                            />
                            <span className="mt-1 block font-mono text-[8px] text-white/20">
                              {size}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
