import type { PackArtKey } from "@/lib/packs";

/**
 * Emblèmes et textures des boosters, dessinés en SVG.
 *
 * Rien n'est repris d'un jeu ou d'une marque : ce sont des formes
 * géométriques originales. Les emblèmes vivent dans un `viewBox 0 0 48 48`,
 * les textures dans un `viewBox 0 0 190 304` (le ratio du poster 5/8).
 *
 * Règle de marge des textures : un élément isolé (nuage, confetti, croix)
 * reste à 24 unités des bords et à 40 unités du bas. Seuls les motifs qui
 * couvrent le fond par nature (grille, rayures, anneaux, réseau) vont jusqu'au
 * bord.
 */

const round = (value: number) => Math.round(value * 100) / 100;

/** Sommets d'un polygone régulier centré, première pointe vers le haut. */
function polygon(radius: number, sides: number, cx = 24, cy = 24): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides;
    return `${round(cx + radius * Math.cos(angle))},${round(cy + radius * Math.sin(angle))}`;
  }).join(" ");
}

/** Étoile à 10 branches : rayons alternés 21 / 11, centrée en (24, 24). */
const STAR_POINTS = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? 21 : 11;
  const angle = -Math.PI / 2 + (index * Math.PI) / 5;
  return `${round(24 + radius * Math.cos(angle))},${round(24 + radius * Math.sin(angle))}`;
}).join(" ");

const HEX_POINTS = polygon(19, 6);

/**
 * Silhouette d'une chauve-souris : le corps au centre, deux ailes festonnées.
 * Dessinée par calcul pour pouvoir être posée à plusieurs tailles, comme les
 * emblèmes, sans dupliquer de coordonnées.
 */
function batPath(cx: number, cy: number, scale: number): string {
  return [
    `M${round(cx - 15 * scale)} ${round(cy)}`,
    `C${round(cx - 12 * scale)} ${round(cy - 7 * scale)} ${round(cx - 6 * scale)} ${round(cy - 6 * scale)} ${round(cx - 3 * scale)} ${round(cy - 2 * scale)}`,
    `L${round(cx)} ${round(cy - 5 * scale)}`,
    `L${round(cx + 3 * scale)} ${round(cy - 2 * scale)}`,
    `C${round(cx + 6 * scale)} ${round(cy - 6 * scale)} ${round(cx + 12 * scale)} ${round(cy - 7 * scale)} ${round(cx + 15 * scale)} ${round(cy)}`,
    `C${round(cx + 10 * scale)} ${round(cy + 6 * scale)} ${round(cx + 4 * scale)} ${round(cy + 4 * scale)} ${round(cx)} ${round(cy + 6 * scale)}`,
    `C${round(cx - 4 * scale)} ${round(cy + 4 * scale)} ${round(cx - 10 * scale)} ${round(cy + 6 * scale)} ${round(cx - 15 * scale)} ${round(cy)}Z`,
  ].join("");
}

/* ————— Textures : formes répétées, calculées une fois ————— */

// Croix du Mix : toutes à distance des bords et du bas.
const MIX_SPARKS: [number, number][] = [
  [46, 60],
  [126, 84],
  [70, 128],
  [148, 152],
  [38, 190],
  [112, 206],
  [84, 246],
  [146, 242],
];

// Topographiques : deux groupes, ellipse extérieure à 24 unités des bords.
const TOPO_GROUPS = [
  { cx: 84, cy: 220, radii: [18, 32, 46, 58] },
  { cx: 126, cy: 84, radii: [12, 24, 36] },
];

// Plateforme : trois nuages en blocs de 8 px (24 / 40 / 24 de large).
const CLOUDS: [number, number][] = [
  [28, 50],
  [116, 92],
  [30, 180],
];

// MMO : constellation de dix points, reliés par des traits fins.
const MMO_POINTS: [number, number][] = [
  [42, 72],
  [78, 54],
  [118, 68],
  [150, 98],
  [58, 118],
  [96, 108],
  [134, 130],
  [46, 178],
  [92, 196],
  [146, 188],
];

const MMO_LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 4],
  [4, 5],
  [5, 1],
  [5, 6],
  [2, 6],
  [4, 7],
  [7, 8],
  [8, 5],
  [8, 9],
  [9, 6],
  [3, 9],
];

// Indé : huit confettis, tous à distance des bords.
const CONFETTI_CIRCLES: [number, number, number][] = [
  [46, 64, 3.5],
  [140, 58, 2.8],
  [72, 150, 4],
  [152, 168, 3],
];

const CONFETTI_SQUARES: [number, number, number][] = [
  [108, 96, 18],
  [40, 214, -22],
  [126, 236, 12],
  [88, 258, -14],
];

// Grilles et rayures qui couvrent le fond.
const FPS_GRID = [
  ...Array.from({ length: 11 }, (_, index) => `M${index * 18} 0V304`),
  ...Array.from({ length: 17 }, (_, index) => `M0 ${index * 18}H190`),
];

const COMBAT_RAYS = Array.from({ length: 20 }, (_, index) => {
  const angle = (index * Math.PI * 2) / 20;
  return `M95 152L${round(95 + 260 * Math.cos(angle))} ${round(152 + 260 * Math.sin(angle))}`;
});

const HORROR_WAVES = Array.from({ length: 14 }, (_, row) => {
  const y = 8 + row * 22;
  return `M-8 ${y}q12 -7 24 0${"t24 0".repeat(8)}`;
});

// Halloween : trois chauves-souris (à distance des bords), une toile dans
// l'angle supérieur droit — un motif qui couvre le fond, il peut donc aller
// jusqu'au bord — et des éclats épars.
const HALLOWEEN_BATS = [batPath(58, 78, 1), batPath(126, 122, 0.72), batPath(72, 200, 0.86)];

const HALLOWEEN_WEB = [
  "M190 0q-34 12-46 42",
  "M190 0q-24 22-32 58",
  "M190 0q-10 34-16 74",
  "M190 0l-58 6",
  "M190 0l-42 42",
  "M190 0l-18 62",
];

const HALLOWEEN_SPARKS: [number, number][] = [
  [42, 132],
  [150, 64],
  [112, 244],
  [48, 262],
  [154, 210],
];

const STRATEGY_HEXES = (() => {
  const radius = 19;
  const stepX = Math.sqrt(3) * radius;
  const stepY = radius * 1.5;
  const paths: string[] = [];

  for (let row = 0; row < 12; row += 1) {
    const cy = -8 + row * stepY;
    const offset = row % 2 === 0 ? 0 : stepX / 2;
    for (let col = 0; col < 7; col += 1) {
      const cx = -stepX + col * stepX + offset;
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 3;
        return `${round(cx + radius * Math.cos(angle))},${round(cy + radius * Math.sin(angle))}`;
      });
      paths.push(`M${points.join("L")}Z`);
    }
  }

  return paths;
})();

/* ————— Emblèmes ————— */

export function PackEmblem({ name }: { name: PackArtKey }) {
  switch (name) {
    case "mix":
      return (
        <>
          <circle cx="19" cy="20" r="11" />
          <circle cx="31" cy="20" r="11" opacity="0.75" />
          <circle cx="25" cy="31" r="11" opacity="0.55" />
        </>
      );

    case "action-aventure":
      return (
        <>
          <path d="M4 40L18 14l8 12 6-8 12 22z" />
          <circle cx="37" cy="11" r="5" />
        </>
      );

    case "plateforme":
      return (
        <>
          <rect x="3" y="35" width="15" height="5" rx="2.5" />
          <rect x="30" y="27" width="15" height="5" rx="2.5" />
          <path
            d="M11 31C14 8 31 6 38 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeDasharray="3.2 3.2"
            strokeLinecap="round"
          />
          <circle cx="24" cy="12.5" r="5" />
        </>
      );

    case "rpg":
      return (
        <>
          <path d="M24 4l3.5 4.5v18h-7V8.5z" />
          <rect x="14" y="26" width="20" height="3.5" rx="1.75" />
          <rect x="22" y="29" width="4" height="9" />
          <circle cx="24" cy="41.5" r="2.5" />
        </>
      );

    case "mmo":
      return (
        <>
          <path
            d="M24 24L10 11M24 24L38 11M24 24L10 38M24 24L38 38"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <circle cx="24" cy="24" r="6.5" />
          {[
            [10, 11],
            [38, 11],
            [10, 38],
            [38, 38],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.5" />
          ))}
        </>
      );

    case "fps":
      return (
        <>
          <circle cx="24" cy="24" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
          <path
            d="M24 4v10M24 34v10M4 24h10M34 24h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="24" cy="24" r="2.5" />
        </>
      );

    case "inde":
      return <path d="M24 3l5 15 15 6-15 6-5 15-5-15-15-6 15-6z" />;

    case "combat":
      return <polygon points={STAR_POINTS} />;

    case "horreur":
      return <path d="M30 6a18 18 0 1 0 12 28A15 15 0 0 1 30 6z" />;

    case "strategie":
      return (
        <>
          <path
            d={`M${HEX_POINTS.split(" ").join("L")}Z`}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="24" r="5" />
        </>
      );

    // Citrouille d'Halloween : corps, queue, yeux et bouche évidés. Le creux
    // prend l'encre du médaillon, comme le fait le dos de carte.
    case "halloween":
      return (
        <>
          <path d="M24 41c-9.6 0-17.4-6.1-17.4-13.6S14.4 13.8 24 13.8s17.4 6.1 17.4 13.6S33.6 41 24 41z" />
          <path d="M22.8 14.4c-.6-3.4.5-6 3.2-7.9-.5 2.8 0 5.2 1.4 7.3z" />
          <path d="M13.9 23.5h6.9l-3.4 5.7z" fill="#0b0b14" />
          <path d="M27.2 23.5H34l-3.4 5.7z" fill="#0b0b14" />
          <path d="M16.2 32.3h15.6c-1.2 4.3-4.1 6.5-7.8 6.5s-6.6-2.2-7.8-6.5z" fill="#0b0b14" />
        </>
      );

    default:
      return null;
  }
}

/* ————— Textures ————— */

export function PackTexture({ name }: { name: PackArtKey }) {
  return (
    <g
      fill="none"
      stroke="var(--pack-tx)"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "mix" &&
        MIX_SPARKS.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x - 4} ${y}h8M${x} ${y - 4}v8`} />
        ))}

      {name === "action-aventure" &&
        TOPO_GROUPS.map((group) =>
          group.radii.map((rx) => (
            <ellipse
              key={`${group.cx}-${rx}`}
              cx={group.cx}
              cy={group.cy}
              rx={rx}
              ry={round(rx * 0.6)}
            />
          )),
        )}

      {name === "plateforme" && (
        <>
          {CLOUDS.map(([x, y]) => (
            <g key={`${x}-${y}`} fill="var(--pack-tx)" stroke="none">
              <rect x={x + 8} y={y} width="24" height="8" />
              <rect x={x} y={y + 8} width="40" height="8" />
              <rect x={x + 8} y={y + 16} width="24" height="8" />
            </g>
          ))}
          {[
            [32, 236, 50],
            [112, 214, 46],
          ].map(([x, y, width]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width={width} height="11" rx="4" fill="var(--pack-tx2)" stroke="none" />
              <rect x={x + 4} y={y} width={width - 8} height="3" rx="1.5" fill="rgba(255,255,255,0.4)" stroke="none" />
            </g>
          ))}
        </>
      )}

      {name === "rpg" &&
        [40, 70, 100, 130, 160].map((radius) => (
          <circle key={radius} cx="95" cy="160" r={radius} />
        ))}

      {name === "mmo" && (
        <>
          {MMO_LINKS.map(([from, to], index) => (
            <path
              key={`${from}-${to}-${index}`}
              d={`M${MMO_POINTS[from][0]} ${MMO_POINTS[from][1]}L${MMO_POINTS[to][0]} ${MMO_POINTS[to][1]}`}
            />
          ))}
          {MMO_POINTS.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" fill="var(--pack-tx)" stroke="none" />
          ))}
        </>
      )}

      {name === "fps" &&
        FPS_GRID.map((d, index) => <path key={index} d={d} />)}

      {name === "inde" && (
        <>
          {CONFETTI_CIRCLES.map(([cx, cy, radius]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={radius} fill="var(--pack-tx)" stroke="none" />
          ))}
          {CONFETTI_SQUARES.map(([x, y, angle]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="5"
              height="5"
              transform={`rotate(${angle} ${x + 2.5} ${y + 2.5})`}
              fill="var(--pack-tx)"
              stroke="none"
            />
          ))}
        </>
      )}

      {name === "combat" &&
        COMBAT_RAYS.map((d, index) => <path key={index} d={d} />)}

      {name === "horreur" &&
        HORROR_WAVES.map((d, index) => <path key={index} d={d} />)}

      {name === "strategie" &&
        STRATEGY_HEXES.map((d, index) => <path key={index} d={d} />)}

      {name === "halloween" && (
        <>
          {HALLOWEEN_WEB.map((d, index) => (
            <path key={`web-${index}`} d={d} />
          ))}
          {HALLOWEEN_BATS.map((d, index) => (
            <path key={`bat-${index}`} d={d} fill="var(--pack-tx)" fillOpacity="0.32" />
          ))}
          {HALLOWEEN_SPARKS.map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M${x - 4} ${y}h8M${x} ${y - 4}v8`} />
          ))}
        </>
      )}

    </g>
  );
}
