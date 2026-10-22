import Link from "next/link";
import { signOut } from "@/app/actions";

export function SiteHeader({ username }: { username?: string }) {
  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-black tracking-[0.18em]">
          <span className="text-xl">🎴</span>
          <span className="rarity-shine">TCVG</span>
        </Link>

        {username && (
          <nav className="ml-4 flex items-center gap-1 text-sm">
            <NavLink href="/boosters">Boosters</NavLink>
            <NavLink href="/collection">Collection</NavLink>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3 text-sm">
          {username ? (
            <>
              <span className="hidden text-white/50 sm:inline">{username}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/35 hover:text-white"
                >
                  Déconnexion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-white/70 transition hover:text-white">
                Connexion
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-violet-950 transition hover:bg-violet-100"
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
      className="rounded-lg px-3 py-1.5 text-white/60 transition hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}
