import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { AvatarFrame } from "@/components/avatar-frame";
import { BoosterBadge } from "@/components/booster-badge";
import { NavLink } from "@/components/nav-link";
import { getCardArt } from "@/lib/card-art";

export function SiteHeader({
  username,
  avatarCardId,
  frame,
  pixels,
  boosterStock,
  bonusBoosters = 0,
  boosterAnchor,
  serverNow,
  unread = 0,
  admin = false,
}: {
  username?: string;
  avatarCardId?: string | null;
  frame?: string;
  pixels?: number;
  /** Boosters disponibles (stock projeté), affiché à côté des Pixels. */
  boosterStock?: number;
  /** Boosters bonus (parrainage) affichés à part du stock. */
  bonusBoosters?: number;
  /** Ancre d'accumulation, pour que le compteur avance tout seul. */
  boosterAnchor?: string | null;
  /** Heure serveur du rendu, point de départ du compteur. */
  serverNow?: number;
  /** Notifications non lues, pour la pastille de la cloche. */
  unread?: number;
  /** Affiche le lien d'administration du marché. */
  admin?: boolean;
}) {
  const initial = username?.trim().charAt(0).toUpperCase() ?? "?";
  const avatar = avatarCardId ? getCardArt(avatarCardId) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 px-3 py-2.5 sm:flex-nowrap sm:gap-2 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 pr-1 sm:gap-2.5 sm:pr-2">
          {/* Logo fourni par le projet, découpé en pastille (public/logo.png). */}
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            priority
            className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
          />
          <span className="display hidden text-[17px] tracking-[0.14em] text-white sm:inline">
            TCVG
          </span>
        </Link>

        {username && (
          <nav className="order-last mt-1.5 flex w-full min-w-0 items-center gap-1 overflow-x-auto border-t border-white/10 pt-2 sm:order-none sm:mt-0 sm:w-auto sm:flex-1 sm:border-0 sm:pt-0">
            <NavLink href="/boosters">Boosters</NavLink>
            <NavLink href="/collection">Collection</NavLink>
            <NavLink href="/parrainage">Parrainage</NavLink>
            <NavLink href="/envies">Envies</NavLink>
            <NavLink href="/marche">Marché</NavLink>
            <NavLink href="/agora">Agora</NavLink>
            {admin && <NavLink href="/admin/marche">Admin</NavLink>}
            {admin && <NavLink href="/admin/parrainage">Parrainages</NavLink>}
            {admin && <NavLink href="/admin/cadres">Cadres</NavLink>}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {username ? (
            <>
              {typeof boosterStock === "number" && typeof serverNow === "number" && (
                <BoosterBadge
                  stock={boosterStock}
                  bonus={bonusBoosters}
                  anchor={boosterAnchor ?? null}
                  serverNow={serverNow}
                />
              )}
              {typeof pixels === "number" && (
                <span
                  title="Pixels disponibles"
                  className="chip gap-1 py-1 text-acid sm:px-2.5"
                >
                  <span aria-hidden className="text-[9px]">
                    ◆
                  </span>
                  <span className="sr-only">Solde : </span>
                  {pixels}
                  <span className="sr-only"> Pixels</span>
                </span>
              )}
              <Link
                href="/notifications"
                title={
                  unread > 0
                    ? `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}`
                    : "Notifications"
                }
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/5 hover:text-acid"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-acid px-1 font-mono text-[9px] font-bold text-ink">
                    {unread > 9 ? "9+" : unread}
                    <span className="sr-only"> notifications non lues</span>
                  </span>
                )}
              </Link>
              <Link
                href="/profil"
                title="Mon profil"
                className="flex shrink-0 items-center gap-2 py-1 pl-1 pr-1 transition hover:opacity-80 sm:pr-2"
              >
                <AvatarFrame avatar={avatar} initial={initial} size={28} frameId={frame} />
                <span className="hidden max-w-32 truncate text-xs text-white/70 sm:inline">
                  {username}
                </span>
              </Link>
              <form action={signOut} className="shrink-0">
                <button
                  type="submit"
                  aria-label="Déconnexion"
                  title="Déconnexion"
                  className="btn btn-outline btn-sm h-8 w-8 px-0 sm:h-auto sm:w-auto sm:px-3"
                >
                  <span className="hidden sm:inline">Déconnexion</span>
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 sm:hidden"
                  >
                    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="tab text-[11px] sm:text-[13px]">
                Connexion
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
