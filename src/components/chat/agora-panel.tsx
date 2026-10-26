"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  joinChat,
  pingChat,
  setChatHideAnnouncements,
  setChatRoom,
} from "@/app/actions/chat";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageRow } from "@/components/chat/chat-message";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  APP_CHAT_NAME,
  CHAT_LANGUAGES,
  chatLanguageInfo,
  chatRoomLabel,
  type ChatLanguage,
} from "@/lib/chat/config";
import type { ChatCardOptions } from "@/lib/chat/data";
import { parseChatPage } from "@/lib/chat/types";
import type { ChatMessage, ChatState } from "@/lib/chat/types";

/** Nombre de messages conservés en mémoire : au-delà, la liste est fenêtrée. */
const MAX_LIVE_MESSAGES = 200;

/**
 * Panneau « L'Agora ».
 *
 * Le rendu initial vient du serveur ; ensuite, chaque message inséré en base
 * est poussé par Realtime. Le client ne fait jamais confiance au flux : il
 * redemande ce qui est postérieur à son dernier identifiant, ce qui rend la
 * reconnexion sans perte — et couvre aussi l'absence de Realtime, puisque le
 * battement de présence toutes les 30 s rafraîchit le fil.
 */
export function AgoraPanel({
  initialState,
  initialMessages,
  initialHasMore,
  cardOptions,
  currentUserId,
  variant = "sidebar",
}: {
  initialState: ChatState;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
  cardOptions: ChatCardOptions;
  currentUserId: string;
  variant?: "sidebar" | "page";
}) {
  const [state, setState] = useState(initialState);
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [view, setView] = useState<number | null>(initialState.roomId);
  const [browseAll, setBrowseAll] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(variant === "page");
  const [fullscreen, setFullscreen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announceNew, setAnnounceNew] = useState(true);

  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef(initialMessages);
  const lastIdRef = useRef(initialMessages.at(-1)?.id ?? 0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const language = state.language;
  const currentRoom = state.rooms.find((room) => room.id === state.roomId) ?? null;

  // Préférence d'annonce vocale, conservée d'une visite à l'autre. Lue après
  // le premier rendu : le serveur ne connaît pas le stockage local, et un
  // `aria-live` identique des deux côtés évite tout décalage d'hydratation.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnnounceNew(window.localStorage.getItem("agora-announce") !== "off");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  /** Remplace ou complète le fil, en gardant `messagesRef` à jour. */
  const applyMessages = useCallback((incoming: ChatMessage[], mode: "replace" | "append") => {
    if (mode === "replace") {
      messagesRef.current = incoming;
      setMessages(incoming);
      return incoming.length;
    }

    const known = new Set(messagesRef.current.map((message) => message.id));
    const fresh = incoming.filter((message) => !known.has(message.id));
    if (fresh.length === 0) return 0;

    const merged = [...messagesRef.current, ...fresh].sort((a, b) => a.id - b.id);
    const windowed =
      merged.length > MAX_LIVE_MESSAGES ? merged.slice(merged.length - MAX_LIVE_MESSAGES) : merged;

    messagesRef.current = windowed;
    setMessages(windowed);
    return fresh.length;
  }, []);

  /**
   * Recharge le fil.
   *
   * `after` non nul = rattrapage incrémental ; sinon, dernière page du salon.
   * `roomId` / `all` permettent de viser une cible précise lors d'un
   * changement de salon, sans attendre le prochain rendu.
   */
  const refresh = useCallback(
    async (options: { after?: number; roomId?: number | null; all?: boolean } = {}) => {
      const all = options.all ?? browseAll;
      const room = all ? null : options.roomId !== undefined ? options.roomId : view;
      const after = options.after && options.after > 0 ? options.after : null;
      const supabase = getBrowserSupabase();

      if (!supabase) {
        // Sans client navigateur (variables d'environnement absentes), le fil
        // rendu par le serveur reste affiché : inutile de recharger la page.
        setError("Le rafraîchissement en direct est indisponible.");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("chat_history", {
        p_room_id: room,
        p_before: null,
        p_after: after,
        p_limit: state.settings.historyPage,
      });

      if (rpcError) {
        setError("Le fil n'a pas pu être rafraîchi.");
        return;
      }

      setError(null);
      const page = parseChatPage(data);

      if (after !== null) {
        const added = applyMessages(page.messages, "append");
        if (added > 0 && !atBottomRef.current) setNewCount((count) => count + added);
      } else {
        applyMessages(page.messages, "replace");
        setHasMore(page.hasMore);
        setNewCount(0);
      }

      const last = messagesRef.current.at(-1);
      if (last) lastIdRef.current = Math.max(lastIdRef.current, last.id);
    },
    [applyMessages, browseAll, state.settings.historyPage, view],
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void refresh({ after: lastIdRef.current });
    }, 250);
  }, [refresh]);

  // ————— Temps réel —————
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const filter = browseAll ? undefined : `room_id=eq.${view}`;
    const channel = supabase
      .channel(`agora-${browseAll ? "all" : view}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          ...(filter ? { filter } : {}),
        },
        () => scheduleRefresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [browseAll, view, scheduleRefresh]);

  // ————— Présence et filet de sécurité (30 s) —————
  useEffect(() => {
    if (browseAll || view === null) return;

    let alive = true;
    const tick = async () => {
      const result = await pingChat(view);
      if (!alive) return;

      if (result.ok) {
        setState((previous) => ({
          ...previous,
          unread: 0,
          rooms: previous.rooms.map((room) => ({
            ...room,
            online: result.online[room.id] ?? 0,
          })),
        }));
      }

      // Le battement sert aussi de rattrapage si Realtime est indisponible.
      void refresh({ after: lastIdRef.current });
    };

    void tick();
    const timer = setInterval(tick, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [browseAll, view, refresh]);

  // ————— Défilement —————
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !atBottomRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  const loadOlder = useCallback(async () => {
    const list = listRef.current;
    const oldest = messagesRef.current[0];
    if (!list || !oldest) return;

    setLoadingOlder(true);
    const previousHeight = list.scrollHeight;
    const supabase = getBrowserSupabase();

    if (supabase) {
      const { data, error: rpcError } = await supabase.rpc("chat_history", {
        p_room_id: browseAll ? null : view,
        p_before: oldest.id,
        p_after: null,
        p_limit: state.settings.historyPage,
      });

      if (!rpcError) {
        const page = parseChatPage(data);
        const known = new Set(messagesRef.current.map((message) => message.id));
        const older = page.messages.filter((message) => !known.has(message.id));
        if (older.length > 0) {
          const merged = [...older, ...messagesRef.current];
          messagesRef.current = merged;
          setMessages(merged);
        }
        setHasMore(page.hasMore);
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight - previousHeight;
          }
        });
      }
    }

    setLoadingOlder(false);
  }, [browseAll, state.settings.historyPage, view]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;

    atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (atBottomRef.current) setNewCount(0);

    if (list.scrollTop < 40 && hasMore && !loadingOlder) void loadOlder();
  };

  // ————— Navigation —————
  const resetFeed = () => {
    messagesRef.current = [];
    lastIdRef.current = 0;
    setMessages([]);
    setNewCount(0);
    setHasMore(false);
  };

  const selectLanguage = (next: ChatLanguage) => {
    if (next === language && !browseAll) return;
    setLoading(true);
    setError(null);

    void joinChat(next).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setState(result.state);
      setBrowseAll(false);
      setView(result.state.roomId);
      resetFeed();
      void refresh({ roomId: result.state.roomId, all: false });
    });
  };

  const selectRoom = (roomId: number) => {
    if (roomId === view && !browseAll) return;
    setLoading(true);
    setError(null);

    void setChatRoom(roomId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setState(result.state);
      setBrowseAll(false);
      setView(roomId);
      setRoomsOpen(false);
      resetFeed();
      void refresh({ roomId, all: false });
    });
  };

  const openAll = () => {
    setBrowseAll(true);
    setView(null);
    setRoomsOpen(false);
    resetFeed();
    void refresh({ all: true });
  };

  const returnToRoom = () => {
    setBrowseAll(false);
    setView(state.roomId);
    resetFeed();
    void refresh({ roomId: state.roomId, all: false });
  };

  const onSent = () => {
    void refresh({ after: lastIdRef.current });
  };

  const visible = messages.filter((message) => {
    if (message.userId && state.blocked.includes(message.userId)) return false;
    if (state.hideAnnouncements && (message.kind === "have" || message.kind === "want")) {
      return false;
    }
    return true;
  });

  const roomsOfLanguage = state.rooms.filter((room) => room.language === language);
  const languageInfo = chatLanguageInfo(language);

  return (
    <section
      aria-label={APP_CHAT_NAME}
      className={`panel flex flex-col overflow-hidden ${
        fullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : variant === "page"
            ? "h-[calc(100dvh-12rem)] min-h-[460px]"
            : "h-[600px]"
      }`}
    >
      {/* ————— En-tête ————— */}
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="display truncate text-sm tracking-[0.08em]">{APP_CHAT_NAME}</h2>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-acid/10 px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-acid" aria-hidden />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-acid">
                En direct
              </span>
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-white/40">
            {browseAll
              ? "Tous les salons · lecture seule"
              : currentRoom
                ? `${chatRoomLabel(currentRoom.language, currentRoom.number)} · ${currentRoom.online}/${currentRoom.capacity}`
                : languageInfo.label}
          </p>
        </div>

        <Link
          href="/agora/offres"
          className="chip shrink-0 text-white/55 hover:text-acid"
          title="Propositions d'échange reçues et envoyées"
        >
          Échanges
        </Link>

        {state.admin && (
          <Link
            href="/agora/moderation"
            className="chip shrink-0 text-amber-200/70 hover:text-amber-100"
            title="File de signalements"
          >
            Modération
          </Link>
        )}

        <button
          type="button"
          onClick={() => setRoomsOpen((open) => !open)}
          aria-expanded={roomsOpen}
          aria-label="Choisir un salon"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-white/45 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid"
        >
          ☰
        </button>

        {!fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label="Ouvrir le chat en grand"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-white/45 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid"
          >
            ⤢
          </button>
        )}
        {fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Réduire le chat"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-white/45 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid"
          >
            ✕
          </button>
        )}
      </header>

      {/* ————— Langues et salons ————— */}
      <div className="border-b border-white/10 px-2 py-1.5">
        <div className="flex gap-1" role="tablist" aria-label="Langues">
          {CHAT_LANGUAGES.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === language && !browseAll}
              onClick={() => selectLanguage(item.key)}
              className={`tab flex-1 justify-center px-1 text-[10px] ${
                item.key === language && !browseAll ? "bg-acid/10 text-acid" : ""
              }`}
            >
              {item.short}
            </button>
          ))}
        </div>

        {roomsOpen && (
          <div className="mt-1.5 space-y-1">
            {roomsOfLanguage.map((room) => {
              const active = !browseAll && room.id === view;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => selectRoom(room.id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-[11px] transition ${
                    active
                      ? "bg-acid/10 text-acid"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="truncate">
                    Salon {room.number}
                    {room.readOnly && (
                      <span className="ml-1 font-mono text-[9px] text-amber-200/60">
                        lecture seule
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-white/35">
                    {room.online}/{room.capacity}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={openAll}
              aria-current={browseAll ? "true" : undefined}
              className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-[11px] transition ${
                browseAll ? "bg-acid/10 text-acid" : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>Tous les salons</span>
              <span className="font-mono text-[9px] text-white/30">lecture seule</span>
            </button>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-1.5 text-[10px] text-white/40">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={state.hideAnnouncements}
                  onChange={(event) => {
                    const hide = event.target.checked;
                    setState((previous) => ({ ...previous, hideAnnouncements: hide }));
                    void setChatHideAnnouncements(hide);
                  }}
                  className="h-3 w-3 accent-[var(--acid)]"
                />
                Masquer les annonces
              </label>

              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={announceNew}
                  onChange={(event) => {
                    setAnnounceNew(event.target.checked);
                    window.localStorage.setItem(
                      "agora-announce",
                      event.target.checked ? "on" : "off",
                    );
                  }}
                  className="h-3 w-3 accent-[var(--acid)]"
                />
                Annonce des nouveaux messages
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ————— Fil ————— */}
      <div
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-live={announceNew ? "polite" : "off"}
        aria-relevant="additions"
        className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2"
      >
        {loading && (
          <p className="py-6 text-center text-[11px] text-white/35">Chargement du salon…</p>
        )}

        {!loading && hasMore && (
          <div className="pb-1 text-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="chip text-white/40 hover:text-white"
            >
              {loadingOlder ? "Chargement…" : "Messages plus anciens"}
            </button>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[12px] text-white/45">
              Personne n&apos;a encore parlé dans ce salon.
            </p>
            <p className="mt-1 text-[11px] text-white/25">
              Annonce une carte à l&apos;échange pour lancer la conversation.
            </p>
          </div>
        )}

        {visible.map((message) => (
          <ChatMessageRow
            key={message.id}
            message={message}
            admin={state.admin}
            currentUserId={currentUserId}
            onChanged={() => void refresh({ after: lastIdRef.current })}
          />
        ))}
      </div>

      {newCount > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const list = listRef.current;
              if (list) list.scrollTop = list.scrollHeight;
              setNewCount(0);
            }}
            className="absolute inset-x-0 -top-9 mx-auto w-fit rounded-full bg-acid px-3 py-1 font-mono text-[10px] font-bold text-ink shadow-lg"
          >
            {newCount} nouveau{newCount > 1 ? "x" : ""} message{newCount > 1 ? "s" : ""} ↓
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="border-t border-white/10 px-3 py-1.5 text-[11px] text-rose-300">
          {error}
        </p>
      )}

      {/* ————— Pied ————— */}
      {browseAll ? (
        <p className="border-t border-white/10 px-3 py-3 text-center text-[11px] text-white/40">
          « Tous les salons » est en lecture seule :{" "}
          <button
            type="button"
            onClick={returnToRoom}
            className="text-acid underline-offset-2 hover:underline"
          >
            rejoins un salon
          </button>{" "}
          pour écrire.
        </p>
      ) : view !== null ? (
        <ChatComposer
          roomId={view}
          canWrite={state.canWrite}
          cardOptions={cardOptions}
          onSent={onSent}
        />
      ) : (
        <p className="border-t border-white/10 px-3 py-3 text-center text-[11px] text-white/40">
          Aucun salon disponible.
        </p>
      )}
    </section>
  );
}
