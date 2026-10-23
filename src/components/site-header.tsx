import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { getPortrait } from "@/lib/portraits";
import { FRAMES, frameOf } from "@/lib/profile";

export function SiteHeader({
  username,
  avatarCardId,
  frame,
  pixels,
}: {
  username?: string;
  avatarCardId?: string | null;
  frame?: string;
  pixels?: number;
}) {
  const initial = username?.trim().charAt(0).toUpperCase() ?? "?";
  const portrait = avatarCardId ? getPortrait(avatarCardId) : undefined;
  const frameInfo = FRAMES[frameOf(frame)];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 pr-1 sm:gap-2.5 sm:pr-2">
          {/* Logo fourni par le projet, découpé en pastille (public/logo.png). */}
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            priority
            className="h-8 w-8 shrink-0 drop-shadow-[0_0_18px_rgba(180,255,57,0.35)] sm:h-9 sm:w-9"
          />
          <span className="display hidden text-[17px] tracking-[0.14em] text-white sm:inline">
            TCVG
          </span>
        </Link>

        {username && (
          <nav className="ml-0 flex min-w-0 flex-1 items-center sm:ml-1 sm:gap-1">
            <NavLink href="/boosters">Boosters</NavLink>
            <NavLink href="/collection">Collection</NavLink>
            <NavLink href="/marche">Marché</NavLink>
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {username ? (
            <>
              {typeof pixels === "number" && (
                <span
                  title="Pixels disponibles"
                  className="flex items-center gap-1 rounded-full border border-acid/30 bg-acid/10 px-1.5 py-1 text-[10px] font-semibold text-acid tabular-nums sm:px-2.5 sm:text-[11px]"
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
                href="/profil"
                title="Mon profil"
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-1 transition hover:border-white/25 sm:pr-3"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-acid to-cyan text-[11px] font-bold text-ink ring-2 ${frameInfo.ring} ${frameInfo.glow}`}
                >
                  {portrait ? (
                    <Image
                      src={portrait.url}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    initial
                  )}
                </span>
                <span className="hidden max-w-32 truncate text-xs text-white/70 sm:inline">
                  {username}
                </span>
              </Link>
              <form action={signOut} className="shrink-0">
                <button
                  type="submit"
                  aria-label="Déconnexion"
                  title="Déconnexion"
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/55 transition hover:border-white/30 hover:text-white sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 sm:text-[11px]"
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
              <Link
                href="/login"
                className="rounded-full px-3 py-1.5 text-[13px] text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-acid px-4 py-1.5 text-[12px] font-semibold text-ink transition hover:brightness-110"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-full px-1 py-1.5 text-[11px] text-white/55 transition hover:bg-white/5 hover:text-white sm:px-3 sm:text-[13px]"
    >
      {children}
    </Link>
  );
}
