import Link from "next/link";

/**
 * Cloche de l'atelier : combien de signalements attendent une vérification.
 *
 * Composant serveur (aucun état) : le compteur vient de la base à chaque
 * affichage de page. Sans base joignable, `count` vaut 0 et la cloche reste un
 * simple raccourci vers la file.
 */
export function AtelierBell({ count }: { count: number }) {
  const label =
    count > 0
      ? `${count} signalement${count > 1 ? "s" : ""} à vérifier`
      : "Signalements : rien à vérifier";

  return (
    <Link
      href="/atelier/signalements"
      title={label}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:border-cyan hover:text-cyan"
    >
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
