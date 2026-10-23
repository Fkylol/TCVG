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
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5 pr-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-acid text-base shadow-[0_0_26px_-6px_#b4ff39]">
            🎴
          </span>
          <span className="display text-[17px] tracking-[0.14em] text-white">TCVG</span>
        </Link>

        {username && (
          <nav className="ml-1 flex items-center gap-1">
            <NavLink href="/boosters">Boosters</NavLink>
            <NavLink href="/collection">Collection</NavLink>
            <NavLink href="/marche">Marché</NavLink>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {username ? (
            <>
              {typeof pixels === "number" && (
                <span
                  title="Pixels disponibles"
                  className="flex items-center gap-1 rounded-full border border-acid/30 bg-acid/10 px-2.5 py-1 text-[11px] font-semibold text-acid tabular-nums"
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
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 transition hover:border-white/25"
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
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/55 transition hover:border-white/30 hover:text-white"
                >
                  Déconnexion
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
      className="rounded-full px-3 py-1.5 text-[13px] text-white/55 transition hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}
