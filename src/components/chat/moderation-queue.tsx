"use client";

import { useState, useTransition } from "react";
import {
  clearChatAnnouncements,
  moderateDeleteMessage,
  muteChatUser,
  resolveChatReport,
  setChatRoomReadOnly,
  unmuteChatUser,
} from "@/app/actions/chat";
import {
  chatRoomLabel,
  formatChatDateTime,
  MUTE_CHOICES,
  REPORT_REASONS,
} from "@/lib/chat/config";
import type { ChatAdminQueue, ChatRoom } from "@/lib/chat/types";

/**
 * File de modération.
 *
 * Chaque décision est appliquée en base (et journalisée dans `chat_audit`) :
 * cette interface ne fait qu'afficher le contexte — le message signalé et les
 * cinq messages qui l'entourent — et proposer les actions.
 */
export function ModerationQueue({
  queue,
  rooms,
}: {
  queue: ChatAdminQueue;
  rooms: ChatRoom[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? "L'action n'a pas abouti.");
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-sm border border-rose-400/30 bg-rose-400/10 p-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <section>
        <h2 className="display text-lg">Signalements ouverts</h2>
        <p className="mt-1 text-xs text-white/40">
          {queue.reports.length} en attente. Le contexte affiche les cinq messages avant et après.
        </p>

        <div className="mt-3 space-y-3">
          {queue.reports.length === 0 && (
            <p className="panel p-4 text-xs text-white/40">Aucun signalement en attente.</p>
          )}

          {queue.reports.map((report) => (
            <article key={report.id} className="panel p-3">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs text-white/70">
                  Signalé par <span className="text-white/90">{report.reportedBy ?? "—"}</span> ·{" "}
                  {REPORT_REASONS.find((item) => item.key === report.reason)?.label ??
                    report.reason}
                </p>
                <time className="font-mono text-[10px] text-white/30">
                  {formatChatDateTime(report.createdAt)}
                </time>
              </header>

              {report.note && <p className="mt-1 text-[11px] text-white/50">« {report.note} »</p>}

              <div className="mt-2 space-y-0.5 rounded-sm border border-white/10 bg-black/30 p-2 text-[11px]">
                {report.before.map((message) => (
                  <p key={message.id} className="text-white/35">
                    <span className="text-white/50">{message.username ?? "—"}</span> : {message.body}
                  </p>
                ))}
                <p className="rounded-sm bg-rose-400/10 px-1 py-0.5 text-white/85">
                  <span className="font-semibold">{report.message?.username ?? "—"}</span> :{" "}
                  {report.message?.body ?? "(message supprimé)"}
                  {report.message?.deletedAt && (
                    <span className="ml-1 font-mono text-[9px] text-rose-300">supprimé</span>
                  )}
                </p>
                {report.after.map((message) => (
                  <p key={message.id} className="text-white/35">
                    <span className="text-white/50">{message.username ?? "—"}</span> : {message.body}
                  </p>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {report.message && !report.message.deletedAt && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline text-rose-300"
                    disabled={pending}
                    onClick={() => {
                      const reason = window.prompt("Raison de la suppression", report.reason) ?? "";
                      run(() => moderateDeleteMessage(report.message!.id, reason));
                    }}
                  >
                    Supprimer le message
                  </button>
                )}

                {report.message?.userId && (
                  <>
                    {MUTE_CHOICES.map((choice) => (
                      <button
                        key={choice.label}
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt("Raison de la sanction") ?? "";
                          run(() =>
                            muteChatUser(report.message!.userId as string, choice.minutes, reason),
                          );
                        }}
                      >
                        Mute {choice.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={pending}
                      onClick={() =>
                        run(() => clearChatAnnouncements(report.message!.userId as string))
                      }
                    >
                      Retirer ses annonces
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="btn btn-sm btn-cyan"
                  disabled={pending}
                  onClick={() => run(() => resolveChatReport(report.id, "handled"))}
                >
                  Marquer traité
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={pending}
                  onClick={() => run(() => resolveChatReport(report.id, "dismissed"))}
                >
                  Ignorer
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-lg">Sanctions actives</h2>
        <div className="mt-2 space-y-1.5">
          {queue.sanctions.length === 0 && (
            <p className="text-xs text-white/40">Personne n&apos;est réduit au silence.</p>
          )}
          {queue.sanctions.map((sanction) => (
            <div
              key={sanction.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px]"
            >
              <span className="text-white/75">{sanction.username ?? sanction.userId}</span>
              <span className="text-white/40">
                {sanction.until
                  ? `jusqu'au ${formatChatDateTime(sanction.until)}`
                  : "définitif"}
                {sanction.reason ? ` · ${sanction.reason}` : ""}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={pending}
                onClick={() => run(() => unmuteChatUser(sanction.userId))}
              >
                Lever
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-lg">Salons en lecture seule</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`chip ${room.readOnly ? "text-amber-200" : "text-white/45"}`}
              disabled={pending}
              onClick={() => run(() => setChatRoomReadOnly(room.id, !room.readOnly))}
            >
              {chatRoomLabel(room.language, room.number)}
              <span className="ml-1 font-mono text-[9px]">
                {room.readOnly ? "lecture seule" : "ouvert"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-lg">Journal d&apos;audit</h2>
        <div className="mt-2 space-y-1 font-mono text-[10px] text-white/45">
          {queue.audit.length === 0 && <p className="font-sans text-xs">Aucune action.</p>}
          {queue.audit.map((entry) => (
            <p key={entry.id}>
              {formatChatDateTime(entry.createdAt)} · {entry.actor ?? "—"} ·{" "}
              {entry.action}
              {entry.target ? ` → ${entry.target}` : ""}
              {entry.reason ? ` (${entry.reason})` : ""}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
