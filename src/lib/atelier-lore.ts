/**
 * Contenu éditorial des cartes ajoutées par l'atelier.
 *
 * Séparé de `atelier-data.ts` à dessein : cette liste ne doit jamais être
 * importée par un composant client (comme `card-lore.ts`, elle est réservée au
 * serveur, qui ne l'envoie qu'au propriétaire de la carte).
 */

import raw from "@/data/atelier-lore.json";

import type { CardLore } from "./card-lore";

type Payload = { lore?: Record<string, CardLore> };

export const ATELIER_LORE: Record<string, CardLore> = (raw as Payload).lore ?? {};
