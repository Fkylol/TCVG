/**
 * Variantes cosmétiques (misprints).
 *
 * Un misprint est un défaut d'impression : ghosting (dédoublement), décalage
 * du cadre (`off_center`), foil qui déborde (`holo_bleed`), foil posé sur le
 * cadre au lieu du visuel (`reverse`) ou foil tiré en bleu (`holo_blue`).
 * C'est purement visuel : aucune variante ne change la rareté, les stats ou
 * la valeur.
 *
 * La base ne stocke que ces cinq clés (`collection_variant_check`, migrations
 * 013 puis 055) ; `normal` et `misprint` n'existent que côté rendu, pour le
 * banc d'essai. Toute valeur inconnue retombe sur `normal` : une donnée abîmée
 * ne doit jamais casser une carte.
 */
export const MISPRINTS = ["holo_bleed", "off_center", "ghosting", "reverse", "holo_blue"] as const;

export type Misprint = (typeof MISPRINTS)[number];

/** Variante telle que le rendu la comprend (base : `null` = normale). */
export type CardVariant = "normal" | "misprint" | Misprint;

/** Libellé court affiché sur la carte. */
export const VARIANT_LABELS: Record<CardVariant, string> = {
  normal: "Normale",
  misprint: "Misprint",
  holo_bleed: "Holo bleed",
  off_center: "Décalage",
  ghosting: "Ghosting",
  reverse: "Reverse",
  holo_blue: "Holo bleue",
};

/** Explication affichée au survol, en une phrase. */
export const VARIANT_HINTS: Record<CardVariant, string> = {
  normal: "Impression standard.",
  misprint: "Défaut d'impression.",
  holo_bleed: "Le foil déborde du cadre.",
  off_center: "Le cadre est décalé à l'impression.",
  ghosting: "L'image est dédoublée à l'impression.",
  reverse: "Le foil est posé sur le cadre, l'illustration reste nette.",
  holo_blue: "Le foil est tiré en bleu au lieu de suivre la rareté.",
};

/** Normalise une valeur venue de la base ou d'une réponse RPC. */
export function toCardVariant(value: string | null | undefined): CardVariant {
  if (!value) return "normal";
  if (value === "misprint") return "misprint";
  return (MISPRINTS as readonly string[]).includes(value) ? (value as Misprint) : "normal";
}

/** Vrai pour toute variante autre que l'impression standard. */
export function isMisprint(variant: CardVariant): boolean {
  return variant !== "normal";
}
