/**
 * Rangs du podium du classement.
 *
 * Seule source des libellés et des couleurs des trois premières places : pour
 * renommer un rang (ou changer son or, son argent, son bronze), c'est ici, et
 * nulle part ailleurs. L'ordre du tableau est celui du classement (1, 2, 3).
 */
export type PodiumRank = {
  /** Nom affiché sous le pseudo du joueur. */
  label: string;
  /** Couleur du texte et du chiffre du rang. */
  text: string;
  /** Filet de la carte du rang. */
  border: string;
  /** Voile de fond, très discret. */
  wash: string;
  /** Couleur de la jauge de score. */
  bar: string;
  /** Halo de la première place, absent des deux autres. */
  glow: string;
};

export const PODIUM_RANKS: readonly PodiumRank[] = [
  {
    label: "Souverain",
    text: "text-[#f6cd61]",
    border: "border-[#f6cd61]/35",
    wash: "bg-[#f6cd61]/[0.07]",
    bar: "bg-[#f6cd61]",
    glow: "shadow-[0_-10px_60px_-25px_rgba(246,205,97,0.65)]",
  },
  {
    label: "Régent",
    text: "text-[#d7dde4]",
    border: "border-[#d7dde4]/25",
    wash: "bg-white/[0.04]",
    bar: "bg-[#d7dde4]",
    glow: "",
  },
  {
    label: "Vizir",
    text: "text-[#e0915a]",
    border: "border-[#e0915a]/25",
    wash: "bg-[#e0915a]/[0.05]",
    bar: "bg-[#e0915a]",
    glow: "",
  },
];

/** Rang d'un joueur (1, 2, 3) ; au-delà du podium, le dernier rang sert de repli. */
export function podiumRank(rank: number): PodiumRank {
  return PODIUM_RANKS[rank - 1] ?? PODIUM_RANKS[PODIUM_RANKS.length - 1];
}
