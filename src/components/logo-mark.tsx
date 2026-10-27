/**
 * Logo TCVG : un carré arrondi et un cercle tracés dans le dégradé de la marque
 * (cyan vers rose), comme sur la vitrine des boosters.
 *
 * Dessiné ici plutôt qu'en image : il reste net à toutes les tailles, prend les
 * couleurs du site, et chaque exemplaire porte son propre dégradé (`id`) — les
 * identifiants SVG sont uniques dans la page.
 */
export function LogoMark({ id, className }: { id: string; className?: string }) {
  const gradient = `logo-mark-${id}`;

  return (
    <svg viewBox="0 0 34 34" className={className} fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--cyan)" />
          <stop offset="1" stopColor="var(--pink)" />
        </linearGradient>
      </defs>
      <rect
        x="1.6"
        y="1.6"
        width="30.8"
        height="30.8"
        rx="9"
        stroke={`url(#${gradient})`}
        strokeWidth="2.4"
      />
      <circle cx="17" cy="17" r="6.5" stroke={`url(#${gradient})`} strokeWidth="2.4" />
    </svg>
  );
}
