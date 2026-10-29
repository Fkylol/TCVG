/**
 * Catalogue des personnages.
 *
 * ⚠️ Projet de fan, non officiel et non affilié aux ayants droit.
 * Les personnages cités appartiennent à leurs studios respectifs.
 * Ce fichier est la seule source de vérité pour le contenu des cartes :
 * renommer/retirer un personnage ici suffit à le retirer du jeu.
 */

import { applyCardEdit, applyCardEdits, applyPublishedCardEdit, cardEditsVersion, isHiddenCard, publishedCardEdits, publishedCards } from "@/lib/card-edits";
import type { PackSeason } from "@/lib/packs";

/**
 * Paliers de rareté, du plus courant au plus rare.
 * Les clés sont celles de la base ; l'affichage utilise les lettres C/U/R/E/L/M.
 */
import { ATELIER_CARDS } from "./atelier-data";

export type Rarity = "C" | "UC" | "R" | "SR" | "UR" | "L";

export type UniverseKey = keyof typeof UNIVERSES;

export const UNIVERSES = {
  godofwar: { label: "God of War", from: "#7f1d1d", to: "#171717" },
  mario: { label: "Super Mario", from: "#dc2626", to: "#2563eb" },
  banjo: { label: "Banjo-Kazooie", from: "#b45309", to: "#15803d" },
  spyro: { label: "Spyro", from: "#7c3aed", to: "#f59e0b" },
  zelda: { label: "The Legend of Zelda", from: "#065f46", to: "#65a30d" },
  sonic: { label: "Sonic", from: "#1d4ed8", to: "#06b6d4" },
  ff7: { label: "Final Fantasy VII", from: "#1e1b4b", to: "#6d28d9" },
  darksouls: { label: "Dark Souls", from: "#292524", to: "#b45309" },
  hollowknight: { label: "Hollow Knight", from: "#0f172a", to: "#38bdf8" },
  portal: { label: "Portal", from: "#0e7490", to: "#f97316" },
  halo: { label: "Halo", from: "#14532d", to: "#84cc16" },
  minecraft: { label: "Minecraft", from: "#4d7c0f", to: "#78350f" },
  doom: { label: "DOOM", from: "#450a0a", to: "#ea580c" },
  witcher: { label: "The Witcher", from: "#1e293b", to: "#d97706" },
  crash: { label: "Crash Bandicoot", from: "#c2410c", to: "#facc15" },
  metroid: { label: "Metroid", from: "#7e22ce", to: "#f97316" },
  castlevania: { label: "Castlevania", from: "#1e1b4b", to: "#9f1239" },
  undertale: { label: "Undertale", from: "#111827", to: "#e5e7eb" },
  eldenring: { label: "Elden Ring", from: "#78350f", to: "#fcd34d" },
  overwatch: { label: "Overwatch", from: "#1e40af", to: "#f472b6" },
  kingdomhearts: { label: "Kingdom Hearts", from: "#1e3a8a", to: "#fbbf24" },
  dmc: { label: "Devil May Cry", from: "#7f1d1d", to: "#0ea5e9" },
  residentevil: { label: "Resident Evil", from: "#14532d", to: "#dc2626" },
  streetfighter: { label: "Street Fighter", from: "#b91c1c", to: "#facc15" },
  kirby: { label: "Kirby", from: "#f472b6", to: "#60a5fa" },
  pokemon: { label: "Pokémon", from: "#eab308", to: "#3b82f6" },
  halflife: { label: "Half-Life", from: "#f97316", to: "#1f2937" },
  cuphead: { label: "Cuphead", from: "#b91c1c", to: "#fef3c7" },
  celeste: { label: "Celeste", from: "#7e22ce", to: "#f9a8d4" },
  splatoon: { label: "Splatoon", from: "#db2777", to: "#22d3ee" },
  persona: { label: "Persona", from: "#b91c1c", to: "#111827" },
  nier: { label: "NieR", from: "#3f3f46", to: "#d6d3d1" },

  // ——— Nouveaux univers (import Retrogems, octobre 2026) ———
  "gta": { label: "Grand Theft Auto", from: "#111827", to: "#f472b6" },
  "ff6": { label: "Final Fantasy VI", from: "#7f1d1d", to: "#fbbf24" },
  "ff9": { label: "Final Fantasy IX", from: "#0f172a", to: "#f59e0b" },
  "ff10": { label: "Final Fantasy X", from: "#0c4a6e", to: "#f8fafc" },
  "lifeisstrange": { label: "Life is Strange", from: "#0ea5e9", to: "#a78bfa" },
  "soulcalibur": { label: "SoulCalibur", from: "#7f1d1d", to: "#facc15" },
  "poppyplaytime": { label: "Poppy Playtime", from: "#1e3a8a", to: "#f472b6" },
  "codevein": { label: "Code Vein", from: "#0f172a", to: "#dc2626" },
  "clair-obscur": { label: "Clair Obscur", from: "#0f766e", to: "#fbbf24" },
  "crimson-desert": { label: "Crimson Desert", from: "#451a03", to: "#dc2626" },
  "reddead": { label: "Red Dead Redemption", from: "#7f1d1d", to: "#d97706" },
  "shenmue": { label: "Shenmue", from: "#134e4a", to: "#f59e0b" },
  "bully": { label: "Bully", from: "#1e293b", to: "#f59e0b" },
  "metalgear": { label: "Metal Gear", from: "#111827", to: "#64748b" },
  "starfox": { label: "Star Fox", from: "#1e3a8a", to: "#f97316" },
  "mafia": { label: "Mafia", from: "#1c1917", to: "#b45309" },
  "bubsy": { label: "Bubsy", from: "#b45309", to: "#facc15" },
  "dukenukem": { label: "Duke Nukem", from: "#b91c1c", to: "#facc15" },
  "okami": { label: "Ōkami", from: "#166534", to: "#fef3c7" },

  // ——— MMO (octobre 2026) ———
  wow: { label: "World of Warcraft", from: "#7f1d1d", to: "#fbbf24" },
  ff14: { label: "Final Fantasy XIV", from: "#1e1b4b", to: "#a78bfa" },
  dofus: { label: "Dofus", from: "#0f766e", to: "#fde047" },
  guildwars2: { label: "Guild Wars 2", from: "#7c2d12", to: "#f97316" },
  runescape: { label: "RuneScape", from: "#0f3d2e", to: "#facc15" },
  eso: { label: "The Elder Scrolls Online", from: "#1c1917", to: "#a855f7" },
  lostark: { label: "Lost Ark", from: "#0c1f3f", to: "#38bdf8" },
  swtor: { label: "Star Wars: The Old Republic", from: "#0b132b", to: "#dc2626" },

  // ——— Vague MMO de fin octobre 2026 ———
  everquest: { label: "EverQuest", from: "#0f2e1d", to: "#e0b44a" },
  lineage2: { label: "Lineage II", from: "#1f1a2e", to: "#b91c1c" },
  ragnarok: { label: "Ragnarok Online", from: "#7c2d12", to: "#38bdf8" },
  maplestory: { label: "MapleStory", from: "#f59e0b", to: "#22c55e" },
  aion: { label: "Aion", from: "#1e3a8a", to: "#f5d0fe" },
  tera: { label: "TERA", from: "#164e63", to: "#f59e0b" },
  bladeandsoul: { label: "Blade & Soul", from: "#1f2937", to: "#e11d48" },
  blackdesert: { label: "Black Desert Online", from: "#111827", to: "#c2410c" },
  thesecretworld: { label: "The Secret World", from: "#0f172a", to: "#059669" },
  pso2: { label: "Phantasy Star Online 2", from: "#312e81", to: "#22d3ee" },
  ageofconan: { label: "Age of Conan", from: "#451a03", to: "#ca8a04" },
  cityofheroes: { label: "City of Heroes", from: "#1e40af", to: "#fbbf24" },
  tibia: { label: "Tibia", from: "#1c1917", to: "#dc2626" },
  wildstar: { label: "WildStar", from: "#7c3aed", to: "#facc15" },

  // ——— Vague MMO de fin octobre 2026 (suite) ———
  flyff: { label: "Flyff", from: "#0ea5e9", to: "#facc15" },
  warhammeronline: { label: "Warhammer Online", from: "#1c1917", to: "#b91c1c" },
  albion: { label: "Albion Online", from: "#14532d", to: "#a3e635" },
  muonline: { label: "MU Online", from: "#1e1b4b", to: "#dc2626" },
  wakfu: { label: "Wakfu", from: "#0f766e", to: "#f59e0b" },
  startrek: { label: "Star Trek Online", from: "#0c1a3a", to: "#f59e0b" },
  dcuo: { label: "DC Universe Online", from: "#1e3a8a", to: "#f43f5e" },
  dragonnest: { label: "Dragon Nest", from: "#312e81", to: "#f59e0b" },
  rift: { label: "Rift", from: "#0c4a6e", to: "#a855f7" },
  rappelz: { label: "Rappelz", from: "#1e293b", to: "#e2e8f0" },

  // ——— Vague MMO de fin octobre 2026 (dernière) ———
  lotro: { label: "The Lord of the Rings Online", from: "#1c2a1e", to: "#d4a017" },
  swgalaxies: { label: "Star Wars Galaxies", from: "#0b132b", to: "#f472b6" },
  // PSO classique : franchise distincte de Phantasy Star Online 2.
  pso: { label: "Phantasy Star Online", from: "#111827", to: "#22d3ee" },
  cabal: { label: "Cabal Online", from: "#1e1b4b", to: "#f59e0b" },
  knightonline: { label: "Knight Online", from: "#451a03", to: "#dc2626" },
  atlantica: { label: "Atlantica Online", from: "#0c4a6e", to: "#fbbf24" },
  fiesta: { label: "Fiesta Online", from: "#be185d", to: "#fde047" },
  perfectworld: { label: "Perfect World", from: "#14532d", to: "#fcd34d" },

  // ——— Horreur (octobre 2026) ———
  silenthill: { label: "Silent Hill", from: "#1f2937", to: "#9f1239" },
  alienisolation: { label: "Alien: Isolation", from: "#0b132b", to: "#22d3ee" },
  evilwithin: { label: "The Evil Within", from: "#450a0a", to: "#a16207" },

  // ——— Horreur (octobre 2026, suite) ———
  outlast: { label: "Outlast", from: "#111827", to: "#b91c1c" },
  deadspace: { label: "Dead Space", from: "#0c1a2b", to: "#22d3ee" },
  fnaf: { label: "Five Nights at Freddy's", from: "#1c1917", to: "#a3e635" },
  untildawn: { label: "Until Dawn", from: "#0c4a6e", to: "#e5e7eb" },
  layersoffear: { label: "Layers of Fear", from: "#3f1d38", to: "#d4a017" },
  projectzero: { label: "Project Zero", from: "#1e1b4b", to: "#e2e8f0" },
  phasmophobia: { label: "Phasmophobia", from: "#0f172a", to: "#22d3ee" },
  deadbydaylight: { label: "Dead by Daylight", from: "#1c1917", to: "#dc2626" },
  soma: { label: "SOMA", from: "#0c4a6e", to: "#67e8f9" },
  darkwood: { label: "Darkwood", from: "#292524", to: "#a16207" },

  // ——— Horreur (octobre 2026, troisième vague) ———
  amnesia: { label: "Amnesia", from: "#1c1917", to: "#a16207" },
  mortuaryassistant: { label: "The Mortuary Assistant", from: "#1f2937", to: "#dc2626" },
  ironlung: { label: "Iron Lung", from: "#450a0a", to: "#b91c1c" },
  manhunt: { label: "Manhunt", from: "#111827", to: "#f97316" },
  dokidoki: { label: "Doki Doki Literature Club!", from: "#be185d", to: "#f9a8d4" },
  subnautica: { label: "Subnautica", from: "#0c4a6e", to: "#22d3ee" },
  signalis: { label: "Signalis", from: "#3f3f46", to: "#e11d48" },

  // ——— Ori (octobre 2026) ———
  ori: { label: "Ori", from: "#134e4a", to: "#a3e635" },

  // ——— Bloodborne, Cyberpunk 2077 (octobre 2026) ———
  bloodborne: { label: "Bloodborne", from: "#1c1917", to: "#991b1b" },
  cyberpunk: { label: "Cyberpunk 2077", from: "#0f172a", to: "#facc15" },

  // ——— Skyrim, Fallout, Mass Effect, Borderlands (octobre 2026) ———
  skyrim: { label: "The Elder Scrolls V: Skyrim", from: "#1f2937", to: "#94a3b8" },
  fallout: { label: "Fallout", from: "#3f2d1d", to: "#facc15" },
  masseffect: { label: "Mass Effect", from: "#0b132b", to: "#ef4444" },
  borderlands: { label: "Borderlands", from: "#1c1917", to: "#f97316" },

  // ——— Seconds rôles et indés (octobre 2026) ———
  l4d: { label: "Left 4 Dead", from: "#450a0a", to: "#65a30d" },
  tf2: { label: "Team Fortress 2", from: "#b91c1c", to: "#1d4ed8" },
  stardew: { label: "Stardew Valley", from: "#365314", to: "#fbbf24" },
  hades: { label: "Hades", from: "#450a0a", to: "#0ea5e9" },
  deadcells: { label: "Dead Cells", from: "#1c1917", to: "#22c55e" },
  pvz: { label: "Plants vs. Zombies", from: "#4d7c0f", to: "#7c3aed" },
  katanazero: { label: "Katana Zero", from: "#111827", to: "#e11d48" },
  goose: { label: "Untitled Goose Game", from: "#1e293b", to: "#f97316" },

  // ——— Indés délirants (octobre 2026) ———
  hotlinemiami: { label: "Hotline Miami", from: "#7f1d1d", to: "#ec4899" },
  dontstarve: { label: "Don't Starve", from: "#1c1917", to: "#a16207" },
  amongus: { label: "Among Us", from: "#0f172a", to: "#dc2626" },
  fallguys: { label: "Fall Guys", from: "#7c3aed", to: "#f472b6" },
  goatsim: { label: "Goat Simulator", from: "#3f6212", to: "#a8a29e" },
  shovelknight: { label: "Shovel Knight", from: "#1e3a8a", to: "#38bdf8" },
  supermeatboy: { label: "Super Meat Boy", from: "#450a0a", to: "#f87171" },
  limbo: { label: "Limbo", from: "#0a0a0a", to: "#a3a3a3" },
  papersplease: { label: "Papers, Please", from: "#44403c", to: "#b91c1c" },

  // ——— Récits et curiosités (octobre 2026) ———
  discoelysium: { label: "Disco Elysium", from: "#0f172a", to: "#f43f5e" },
  pentiment: { label: "Pentiment", from: "#44403c", to: "#fcd34d" },
  outerwilds: { label: "Outer Wilds", from: "#0b132b", to: "#f97316" },
  katamari: { label: "Katamari Damacy", from: "#db2777", to: "#22d3ee" },
  darkesstdungeon: { label: "Darkest Dungeon", from: "#111827", to: "#b91c1c" },
  slimerancher: { label: "Slime Rancher", from: "#0e7490", to: "#f472b6" },

  // ——— Course et stratégie (octobre 2026) ———
  driver: { label: "Driver", from: "#1c1917", to: "#0ea5e9" },
  empireatwar: { label: "Star Wars: Empire at War", from: "#0b132b", to: "#22d3ee" },
  totalwar: { label: "Total War", from: "#292524", to: "#dc2626" },
  stronghold: { label: "Stronghold", from: "#365314", to: "#d4a017" },
} as const;

export type Card = {
  id: string;
  name: string;
  universe: UniverseKey;
  emoji: string;
  rarity: Rarity;
  /**
   * Carte retirée du catalogue : elle reste dans ce fichier pour que les
   * collections existantes gardent leur personnage, mais elle sort des pools
   * de boosters (via `cards.active`) et n'affiche plus son visuel.
   */
  retired?: boolean;
  /**
   * Carte saisonnière : elle n'apparaît que dans le pack de sa saison, jamais
   * dans les boosters de genre ni dans le Mix, et son visuel de catalogue est
   * teinté par le CSS (`[data-season]`). Voir le pack Halloween.
   */
  season?: PackSeason;
  /** Numéro de catalogue attribué à la publication en ligne. */
  number?: number;
};

const BASE_CARDS: Card[] = [
  // ——— God of War ———
  {
    id: "kratos", name: "Kratos", universe: "godofwar", emoji: "🪓", rarity: "UR",
  },
  {
    id: "atreus", name: "Atreus", universe: "godofwar", emoji: "🏹", rarity: "UC",
  },
  {
    id: "baldur", name: "Baldur", universe: "godofwar", emoji: "⚡", rarity: "SR",
  },
  {
    id: "freya", name: "Freya", universe: "godofwar", emoji: "🌿", rarity: "R",
  },

  // ——— Super Mario ———
  {
    id: "mario", name: "Mario", universe: "mario", emoji: "🍄", rarity: "UR",
  },
  {
    id: "luigi", name: "Luigi", universe: "mario", emoji: "👻", rarity: "C",
  },
  {
    id: "bowser", name: "Bowser", universe: "mario", emoji: "🐢", rarity: "SR",
  },
  {
    id: "peach", name: "Peach", universe: "mario", emoji: "👑", rarity: "SR",
  },
  {
    id: "yoshi", name: "Yoshi", universe: "mario", emoji: "🥚", rarity: "C",
  },

  // ——— Banjo-Kazooie ———
  {
    id: "banjo-kazooie", name: "Banjo & Kazooie", universe: "banjo", emoji: "🐻", rarity: "SR",
  },
  {
    id: "gruntilda", name: "Gruntilda", universe: "banjo", emoji: "🧹", rarity: "C",
  },
  {
    id: "mumbo", name: "Mumbo Jumbo", universe: "banjo", emoji: "🦴", rarity: "C",
  },

  // ——— Spyro ———
  {
    id: "spyro", name: "Spyro", universe: "spyro", emoji: "🐉", rarity: "UR",
  },
  {
    id: "ripto", name: "Ripto", universe: "spyro", emoji: "🦎", rarity: "C",
  },
  {
    id: "hunter", name: "Hunter", universe: "spyro", emoji: "🐆", rarity: "C",
  },

  // ——— The Legend of Zelda ———
  {
    id: "link", name: "Link", universe: "zelda", emoji: "🗡️", rarity: "UR",
  },
  {
    id: "zelda", name: "Zelda", universe: "zelda", emoji: "🔮", rarity: "SR",
  },
  {
    id: "ganondorf", name: "Ganondorf", universe: "zelda", emoji: "👿", rarity: "L",
  },
  {
    id: "majora", name: "Majora", universe: "zelda", emoji: "🌘", rarity: "SR",
  },

  // ——— Sonic ———
  {
    id: "sonic", name: "Sonic", universe: "sonic", emoji: "💨", rarity: "UR",
  },
  {
    id: "eggman", name: "Dr. Eggman", universe: "sonic", emoji: "🤖", rarity: "UC",
  },
  {
    id: "shadow", name: "Shadow", universe: "sonic", emoji: "🖤", rarity: "R",
  },
  {
    id: "knuckles", name: "Knuckles", universe: "sonic", emoji: "👊", rarity: "UC",
  },

  // ——— Final Fantasy VII ———
  {
    id: "cloud", name: "Cloud Strife", universe: "ff7", emoji: "⚔️", rarity: "UR",
  },
  {
    id: "sephiroth", name: "Sephiroth", universe: "ff7", emoji: "🩸", rarity: "L",
  },
  {
    id: "aerith", name: "Aerith", universe: "ff7", emoji: "🌸", rarity: "SR",
  },
  {
    id: "tifa", name: "Tifa", universe: "ff7", emoji: "🥊", rarity: "R",
  },

  // ——— Dark Souls ———
  {
    id: "solaire", name: "Solaire d'Astora", universe: "darksouls", emoji: "☀️", rarity: "C",
  },
  {
    id: "artorias", name: "Artorias", universe: "darksouls", emoji: "🌑", rarity: "SR",
  },
  {
    id: "gwyn", name: "Gwyn", universe: "darksouls", emoji: "🕯️", rarity: "UR",
  },

  // ——— Hollow Knight ———
  {
    id: "le-chevalier", name: "Le Chevalier", universe: "hollowknight", emoji: "🪲", rarity: "SR",
  },
  {
    id: "hornet", name: "Hornet", universe: "hollowknight", emoji: "🪡", rarity: "R",
  },
  {
    id: "grimm", name: "Grimm", universe: "hollowknight", emoji: "🎪", rarity: "UR",
  },

  // ——— Portal ———
  {
    id: "chell", name: "Chell", universe: "portal", emoji: "👟", rarity: "C",
  },
  {
    id: "wheatley", name: "Wheatley", universe: "portal", emoji: "🔵", rarity: "C",
  },

  // ——— Halo ———
  {
    id: "master-chief", name: "Master Chief", universe: "halo", emoji: "🛡️", rarity: "UR",
  },
  {
    id: "cortana", name: "Cortana", universe: "halo", emoji: "💠", rarity: "SR",
  },
  {
    id: "arbiter", name: "L'Arbiter", universe: "halo", emoji: "🔱", rarity: "UC",
  },

  // ——— Minecraft ———
  {
    id: "steve", name: "Steve", universe: "minecraft", emoji: "⛏️", rarity: "C",
  },
  {
    id: "creeper", name: "Creeper", universe: "minecraft", emoji: "💥", rarity: "C",
  },
  {
    id: "ender-dragon", name: "Dragon de l'End", universe: "minecraft", emoji: "🐲", rarity: "L",
  },

  // ——— DOOM ———
  {
    id: "doom-slayer", name: "Doom Slayer", universe: "doom", emoji: "🔫", rarity: "UR",
  },

  // ——— The Witcher ———
  {
    id: "geralt", name: "Geralt de Riv", universe: "witcher", emoji: "🐺", rarity: "UR",
  },
  {
    id: "ciri", name: "Ciri", universe: "witcher", emoji: "🌪️", rarity: "R",
  },
  {
    id: "yennefer", name: "Yennefer", universe: "witcher", emoji: "💜", rarity: "UC",
  },

  // ——— Crash Bandicoot ———
  {
    id: "crash", name: "Crash Bandicoot", universe: "crash", emoji: "🌀", rarity: "R",
  },
  {
    id: "cortex", name: "Dr. Neo Cortex", universe: "crash", emoji: "🧠", rarity: "C",
  },

  // ——— Metroid ———
  {
    id: "samus", name: "Samus Aran", universe: "metroid", emoji: "🚀", rarity: "UR",
  },
  {
    id: "ridley", name: "Ridley", universe: "metroid", emoji: "🦇", rarity: "R",
  },

  // ——— Castlevania ———
  {
    id: "alucard", name: "Alucard", universe: "castlevania", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "dracula", name: "Dracula", universe: "castlevania", emoji: "🦇", rarity: "L",
  },
  {
    id: "simon", name: "Simon Belmont", universe: "castlevania", emoji: "⛓️", rarity: "R",
  },

  // ——— Undertale ———
  {
    id: "sans", name: "Sans", universe: "undertale", emoji: "💀", rarity: "UR",
  },
  {
    id: "papyrus", name: "Papyrus", universe: "undertale", emoji: "🍝", rarity: "C",
  },
  {
    id: "flowey", name: "Flowey", universe: "undertale", emoji: "🌼", rarity: "C",
  },

  // ——— Elden Ring ———
  {
    id: "malenia", name: "Malenia", universe: "eldenring", emoji: "🦋", rarity: "L",
  },
  {
    id: "radahn", name: "Radahn", universe: "eldenring", emoji: "🌠", rarity: "UR",
  },

  // ——— Overwatch ———
  {
    id: "tracer", name: "Tracer", universe: "overwatch", emoji: "⏱️", rarity: "UC",
  },
  {
    id: "reaper", name: "Reaper", universe: "overwatch", emoji: "💀", rarity: "R",
  },
  {
    id: "mercy", name: "Mercy", universe: "overwatch", emoji: "🕊️", rarity: "UC",
  },

  // ——— Kingdom Hearts ———
  {
    id: "sora", name: "Sora", universe: "kingdomhearts", emoji: "🗝️", rarity: "SR",
  },
  {
    id: "xehanort", name: "Xehanort", universe: "kingdomhearts", emoji: "🌑", rarity: "UR",
  },

  // ——— Devil May Cry ———
  {
    id: "dante", name: "Dante", universe: "dmc", emoji: "😈", rarity: "UR",
  },
  {
    id: "vergil", name: "Vergil", universe: "dmc", emoji: "❄️", rarity: "SR",
  },

  // ——— Resident Evil ———
  {
    id: "leon", name: "Leon S. Kennedy", universe: "residentevil", emoji: "🔫", rarity: "R",
  },
  {
    id: "nemesis", name: "Nemesis", universe: "residentevil", emoji: "🧟", rarity: "SR",
  },

  // ——— Street Fighter ———
  {
    id: "ryu", name: "Ryu", universe: "streetfighter", emoji: "🥋", rarity: "SR",
  },
  {
    id: "chun-li", name: "Chun-Li", universe: "streetfighter", emoji: "🦵", rarity: "UC",
  },
  {
    id: "bison", name: "M. Bison", universe: "streetfighter", emoji: "🧢", rarity: "SR",
  },

  // ——— Kirby ———
  {
    id: "kirby", name: "Kirby", universe: "kirby", emoji: "🎀", rarity: "L",
  },
  {
    id: "meta-knight", name: "Meta Knight", universe: "kirby", emoji: "🦇", rarity: "R",
  },
  {
    id: "king-dedede", name: "Roi Dadidou", universe: "kirby", emoji: "🔨", rarity: "C",
  },

  // ——— Pokémon ———
  {
    id: "pikachu", name: "Pikachu", universe: "pokemon", emoji: "⚡", rarity: "UC",
  },
  {
    id: "mewtwo", name: "Mewtwo", universe: "pokemon", emoji: "🧿", rarity: "L",
  },
  {
    id: "charizard", name: "Dracaufeu", universe: "pokemon", emoji: "🔥", rarity: "UR",
  },

  // ——— Half-Life ———
  {
    id: "gordon", name: "Gordon Freeman", universe: "halflife", emoji: "🔧", rarity: "R",
  },
  {
    id: "g-man", name: "G-Man", universe: "halflife", emoji: "🕴️", rarity: "SR",
  },

  // ——— Cuphead ———
  {
    id: "cuphead", name: "Cuphead", universe: "cuphead", emoji: "☕", rarity: "UC",
  },
  {
    id: "king-dice", name: "Le Roi Dé", universe: "cuphead", emoji: "🎲", rarity: "UC",
  },

  // ——— Celeste ———
  {
    id: "madeline", name: "Madeline", universe: "celeste", emoji: "🏔️", rarity: "UC",
  },

  // ——— Splatoon ———
  {
    id: "inkling", name: "Inkling", universe: "splatoon", emoji: "🎨", rarity: "C",
  },

  // ——— Persona ———
  {
    id: "joker", name: "Joker", universe: "persona", emoji: "🎭", rarity: "UR",
  },

  // ——— NieR ———
  {
    id: "2b", name: "2B", universe: "nier", emoji: "🤖", rarity: "R",
  },

  // ——— Personnages importés de Retrogems (octobre 2026) ———
  {
    id: "carl-johnson", name: "Carl Johnson", universe: "gta", emoji: "🚲", rarity: "L",
  },
  {
    id: "catnap", name: "CatNap", universe: "poppyplaytime", emoji: "😴", rarity: "SR",
  },
  {
    id: "niko-bellic", name: "Niko Bellic", universe: "gta", emoji: "🚗", rarity: "UR",
  },
  {
    id: "tommy-vercetti", name: "Tommy Vercetti", universe: "gta", emoji: "🚗", rarity: "UR",
  },
  {
    id: "franklin-clinton", name: "Franklin Clinton", universe: "gta", emoji: "🚗", rarity: "UR",
  },
  {
    id: "isabella-torrisi", name: "Isabella Torrisi", universe: "mafia", emoji: "🎩", rarity: "R",
  },
  {
    id: "tidus", name: "Tidus", universe: "ff10", emoji: "🌊", rarity: "UR",
  },
  {
    id: "victor-gideon", name: "Victor Gideon", universe: "residentevil", emoji: "🧟", rarity: "R",
  },
  {
    id: "prototype-experience-1006", name: "Prototype Expérience 1006", universe: "poppyplaytime", emoji: "🧸", rarity: "R",
  },
  {
    id: "grace-ashcroft", name: "Grace Ashcroft", universe: "residentevil", emoji: "🧟", rarity: "R",
  },
  {
    id: "enzo-favani", name: "Enzo Favara", universe: "mafia", emoji: "🎩", rarity: "R",
  },
  {
    id: "huggy-wuggy", name: "Huggy Wuggy", universe: "poppyplaytime", emoji: "🧸", rarity: "UR",
  },
  {
    id: "gustave", name: "Gustave", universe: "clair-obscur", emoji: "🖌️", rarity: "R",
  },
  {
    id: "mommy-long-legs", name: "Mommy Long Legs", universe: "poppyplaytime", emoji: "🧸", rarity: "SR",
  },
  {
    id: "luca-trapani", name: "Luca Trapani", universe: "mafia", emoji: "🎩", rarity: "R",
  },
  {
    id: "jimmy-de-santa", name: "Jimmy De Santa", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "melvin-harris", name: "Melvin Harris", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "auron", name: "Auron", universe: "ff10", emoji: "🌊", rarity: "UR",
  },
  {
    id: "barret-wallace", name: "Barret Wallace", universe: "ff7", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "roman-bellic", name: "Roman Bellic", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "lucia-caminos", name: "Lucia Caminos", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "jason-duval", name: "Jason Duval", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "boobie-ike", name: "Boobie Ike", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "renoir", name: "Renoir", universe: "clair-obscur", emoji: "🖌️", rarity: "R",
  },
  {
    id: "kissy-missy", name: "Kissy Missy", universe: "poppyplaytime", emoji: "🧸", rarity: "SR",
  },
  {
    id: "fox-mccloud", name: "Fox McCloud", universe: "starfox", emoji: "🦊", rarity: "L",
  },
  {
    id: "emily", name: "Emily", universe: "residentevil", emoji: "🧟", rarity: "R",
  },
  {
    id: "michael-de-santa", name: "Michael De Santa", universe: "gta", emoji: "🚗", rarity: "UR",
  },
  {
    id: "kliff-macduff", name: "Kliff Macduff", universe: "crimson-desert", emoji: "🏜️", rarity: "R",
  },
  {
    id: "nightmare", name: "Nightmare", universe: "soulcalibur", emoji: "⚔️", rarity: "UR",
  },
  {
    id: "damiane", name: "Damiane", universe: "crimson-desert", emoji: "🏜️", rarity: "R",
  },
  {
    id: "yarnaby", name: "Yarnaby", universe: "poppyplaytime", emoji: "🧸", rarity: "R",
  },
  {
    id: "astaroth", name: "Astaroth", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "voldo", name: "Voldo", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "rufus-shinra", name: "Rufus Shinra", universe: "ff7", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "chris-redfield", name: "Chris Redfield", universe: "residentevil", emoji: "🧟", rarity: "UR",
  },
  {
    id: "raul-bautista", name: "Raul Bautista", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "poppy-ludwig", name: "Poppy Ludwig", universe: "poppyplaytime", emoji: "🧸", rarity: "SR",
  },
  {
    id: "trevor-philips", name: "Trevor Philips", universe: "gta", emoji: "🚗", rarity: "UR",
  },
  {
    id: "miss-delight", name: "Miss Delight", universe: "poppyplaytime", emoji: "🧸", rarity: "R",
  },
  {
    id: "reno", name: "Reno", universe: "ff7", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "heishiro-mitsurugi", name: "Heishiro Mitsurugi", universe: "soulcalibur", emoji: "⚔️", rarity: "R",
  },
  {
    id: "jessie-rasberry", name: "Jessie Rasberry", universe: "ff7", emoji: "⚔️", rarity: "R",
  },
  {
    id: "boxy-boo", name: "Boxy Boo", universe: "poppyplaytime", emoji: "🧸", rarity: "R",
  },
  {
    id: "yuna", name: "Yuna", universe: "ff10", emoji: "🌊", rarity: "UR",
  },
  {
    id: "claire-redfield", name: "Claire Redfield", universe: "residentevil", emoji: "🧟", rarity: "UR",
  },
  {
    id: "yuffie-kisaragi", name: "Yuffie Kisaragi", universe: "ff7", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "siegfried-schtauffen", name: "Siegfried Schtauffen", universe: "soulcalibur", emoji: "⚔️", rarity: "R",
  },
  {
    id: "cait-sith", name: "Cait Sith", universe: "ff7", emoji: "⚔️", rarity: "R",
  },
  {
    id: "max-caulfield", name: "Max Caulfield", universe: "lifeisstrange", emoji: "🦋", rarity: "SR",
  },
  {
    id: "ricardo-diaz", name: "Ricardo Diaz", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "jenova", name: "Jénova", universe: "ff7", emoji: "⚔️", rarity: "R",
  },
  {
    id: "bunzo-bunny", name: "Bunzo Bunny", universe: "poppyplaytime", emoji: "🧸", rarity: "R",
  },
  {
    id: "seymour-guado", name: "Seymour Guado", universe: "ff10", emoji: "🌊", rarity: "SR",
  },
  {
    id: "jill-valentine", name: "Jill Valentine", universe: "residentevil", emoji: "🧟", rarity: "L",
  },
  {
    id: "oongka", name: "Oongka", universe: "crimson-desert", emoji: "🏜️", rarity: "R",
  },
  {
    id: "seong-mi-na", name: "Seong Mi-na", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "sophie", name: "Sophie", universe: "clair-obscur", emoji: "🖌️", rarity: "R",
  },
  {
    id: "maelle", name: "Maëlle", universe: "clair-obscur", emoji: "🖌️", rarity: "R",
  },
  {
    id: "little-jacob", name: "Little Jacob", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "lance-vance", name: "Lance Vance", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "revali", name: "Revali", universe: "zelda", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "dave-norton", name: "Dave Norton", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "ken-rosenberg", name: "Ken Rosenberg", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "zeno", name: "Zeno", universe: "residentevil", emoji: "🧟", rarity: "R",
  },
  {
    id: "chloe-price", name: "Chloe Price", universe: "lifeisstrange", emoji: "🦋", rarity: "SR",
  },
  {
    id: "mother-brain", name: "Mother Brain", universe: "metroid", emoji: "🚀", rarity: "SR",
  },
  {
    id: "doey-the-doughman", name: "Doey the Doughman", universe: "poppyplaytime", emoji: "🧸", rarity: "R",
  },
  {
    id: "zack-fair", name: "Zack Fair", universe: "ff7", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "solid-snake", name: "Solid Snake", universe: "metalgear", emoji: "🐍", rarity: "L",
  },
  {
    id: "beate", name: "Beate", universe: "ff9", emoji: "🎺", rarity: "R",
  },
  {
    id: "elena", name: "Elena", universe: "ff7", emoji: "⚔️", rarity: "R",
  },
  {
    id: "valentin-voda", name: "Valentin Voda", universe: "codevein", emoji: "🩸", rarity: "R",
  },
  {
    id: "lance-wilson", name: "Lance Wilson", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "josee-anjou", name: "Josée Anjou", universe: "codevein", emoji: "🩸", rarity: "R",
  },
  {
    id: "nathan-prescott", name: "Nathan Prescott", universe: "lifeisstrange", emoji: "🦋", rarity: "R",
  },
  {
    id: "cid-highwind", name: "Cid Highwind", universe: "ff7", emoji: "⚔️", rarity: "R",
  },
  {
    id: "wakka", name: "Wakka", universe: "ff10", emoji: "🌊", rarity: "SR",
  },
  {
    id: "sonny-forelli", name: "Sonny Forelli", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "kweena-quen", name: "Kweena Quen", universe: "ff9", emoji: "🎺", rarity: "R",
  },
  {
    id: "terra-branford", name: "Terra Branford", universe: "ff6", emoji: "🎭", rarity: "SR",
  },
  {
    id: "ada-wong", name: "Ada Wong", universe: "residentevil", emoji: "🧟", rarity: "UR",
  },
  {
    id: "lulu", name: "Lulu", universe: "ff10", emoji: "🌊", rarity: "SR",
  },
  {
    id: "falco-lombardi", name: "Falco Lombardi", universe: "starfox", emoji: "🦊", rarity: "R",
  },
  {
    id: "lune", name: "Lune", universe: "clair-obscur", emoji: "🖌️", rarity: "R",
  },
  {
    id: "alyssa-ashcroft", name: "Alyssa Ashcroft", universe: "residentevil", emoji: "🧟", rarity: "UC",
  },
  {
    id: "vincent-valentine", name: "Vincent Valentine", universe: "ff7", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "jeffrey-cross", name: "Jeffrey Cross", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "myles-mackenzie", name: "Myles MacKenzie", universe: "metroid", emoji: "🚀", rarity: "UC",
  },
  {
    id: "kuja", name: "Kuja", universe: "ff9", emoji: "🎺", rarity: "UR",
  },
  {
    id: "kimahri-ronso", name: "Kimahri Ronso", universe: "ff10", emoji: "🌊", rarity: "SR",
  },
  {
    id: "krystal", name: "Krystal", universe: "starfox", emoji: "🦊", rarity: "R",
  },
  {
    id: "dre-quan-priest", name: "Dre'Quan Priest", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "kilik", name: "Kilik", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "sergent-duke", name: "Sergent Duke", universe: "metroid", emoji: "🚀", rarity: "UC",
  },
  {
    id: "micah-bell", name: "Micah Bell", universe: "reddead", emoji: "🤠", rarity: "SR",
  },
  {
    id: "biggs", name: "Biggs", universe: "ff7", emoji: "⚔️", rarity: "UC",
  },
  {
    id: "tseng", name: "Tseng", universe: "ff7", emoji: "⚔️", rarity: "R",
  },
  {
    id: "ryo-hazuki", name: "Ryo Hazuki", universe: "shenmue", emoji: "🥋", rarity: "SR",
  },
  {
    id: "sean-diaz", name: "Sean Diaz", universe: "lifeisstrange", emoji: "🦋", rarity: "R",
  },
  {
    id: "kent-paul", name: "Kent Paul", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "wedge", name: "Wedge", universe: "ff7", emoji: "⚔️", rarity: "UC",
  },
  {
    id: "jecht", name: "Jecht", universe: "ff10", emoji: "🌊", rarity: "SR",
  },
  {
    id: "hunk", name: "HUNK", universe: "residentevil", emoji: "🧟", rarity: "R",
  },
  {
    id: "red-xiii", name: "Red XIII", universe: "ff7", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "piers-nivans", name: "Piers Nivans", universe: "residentevil", emoji: "🧟", rarity: "R",
  },
  {
    id: "rude", name: "Rude", universe: "ff7", emoji: "⚔️", rarity: "R",
  },
  {
    id: "shenhua-ling", name: "Shenhua Ling", universe: "shenmue", emoji: "🥋", rarity: "UC",
  },
  {
    id: "braska", name: "Braska", universe: "ff10", emoji: "🌊", rarity: "UC",
  },
  {
    id: "duke-nukem", name: "Duke Nukem", universe: "dukenukem", emoji: "💪", rarity: "SR",
  },
  {
    id: "playboy-x", name: "Playboy X", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "lavinia-voda", name: "Lavinia Voda", universe: "codevein", emoji: "🩸", rarity: "UC",
  },
  {
    id: "the-paintress", name: "The Paintress", universe: "clair-obscur", emoji: "🖌️", rarity: "UC",
  },
  {
    id: "claude", name: "Claude", universe: "gta", emoji: "🚗", rarity: "R",
  },
  {
    id: "belgemine", name: "Belgemine", universe: "ff10", emoji: "🌊", rarity: "UC",
  },
  {
    id: "jimmy-pegorino", name: "Jimmy Pegorino", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "maitre-mika", name: "Maître Mika", universe: "ff10", emoji: "🌊", rarity: "UC",
  },
  {
    id: "steiner-adelbert", name: "Steiner Adelbert", universe: "ff9", emoji: "🎺", rarity: "SR",
  },
  {
    id: "mark-jefferson", name: "Mark Jefferson", universe: "lifeisstrange", emoji: "🦋", rarity: "UC",
  },
  {
    id: "big-boss", name: "Big Boss", universe: "metalgear", emoji: "🔫", rarity: "UR",
  },
  {
    id: "dimitri-rascalov", name: "Dimitri Rascalov", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "mog", name: "Mog", universe: "ff6", emoji: "🎭", rarity: "R",
  },
  {
    id: "nozomi-harasaki", name: "Nozomi Harasaki", universe: "shenmue", emoji: "🥋", rarity: "UC",
  },
  {
    id: "tanisha-jackson", name: "Tanisha Jackson", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "freyja-crescent", name: "Freyja Crescent", universe: "ff9", emoji: "🎺", rarity: "R",
  },
  {
    id: "ethan-winters", name: "Ethan Winters", universe: "residentevil", emoji: "🧟", rarity: "UC",
  },
  {
    id: "revolver-ocelot", name: "Revolver Ocelot", universe: "metalgear", emoji: "🐍", rarity: "SR",
  },
  {
    id: "holly-asturias", name: "Holly Asturias", universe: "codevein", emoji: "🩸", rarity: "UC",
  },
  {
    id: "wen-kinoc", name: "Wen Kinoc", universe: "ff10", emoji: "🌊", rarity: "UC",
  },
  {
    id: "mipha", name: "Mipha", universe: "zelda", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "8-ball", name: "8-Ball", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "kraid", name: "Kraid", universe: "metroid", emoji: "🚀", rarity: "SR",
  },
  {
    id: "eiko-carol", name: "Eiko Carol", universe: "ff9", emoji: "🎺", rarity: "SR",
  },
  {
    id: "locke-cole", name: "Locke Cole", universe: "ff6", emoji: "🎭", rarity: "SR",
  },
  {
    id: "lester-crest", name: "Lester Crest", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "slippy-toad", name: "Slippy Toad", universe: "starfox", emoji: "🦊", rarity: "UC",
  },
  {
    id: "verso", name: "Verso", universe: "clair-obscur", emoji: "🖌️", rarity: "UC",
  },
  {
    id: "darko-brevic", name: "Darko Brevic", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "cal-hampton", name: "Cal Hampton", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "mineru", name: "Mineru", universe: "zelda", emoji: "🗡️", rarity: "UC",
  },
  {
    id: "tarask-coral", name: "Tarask Coral", universe: "ff9", emoji: "🎺", rarity: "UC",
  },
  {
    id: "celes-chere", name: "Celes Chere", universe: "ff6", emoji: "🎭", rarity: "SR",
  },
  {
    id: "professeur-hojo", name: "Professeur Hojo", universe: "ff7", emoji: "⚔️", rarity: "UC",
  },
  {
    id: "otacon", name: "Otacon", universe: "metalgear", emoji: "🐍", rarity: "SR",
  },
  {
    id: "amanda-de-santa", name: "Amanda De Santa", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "peppy-hare", name: "Peppy Hare", universe: "starfox", emoji: "🦊", rarity: "UC",
  },
  {
    id: "sciel", name: "Sciel", universe: "clair-obscur", emoji: "🖌️", rarity: "UC",
  },
  {
    id: "tokabi", name: "Tokabi", universe: "metroid", emoji: "🚀", rarity: "UC",
  },
  {
    id: "bandana-waddle-dee", name: "Bandana Waddle Dee", universe: "kirby", emoji: "💛", rarity: "UC",
  },
  {
    id: "billy-coen", name: "Billy Coen", universe: "residentevil", emoji: "🧟", rarity: "UC",
  },
  {
    id: "ivy-valentine", name: "Ivy Valentine", universe: "soulcalibur", emoji: "⚔️", rarity: "UC",
  },
  {
    id: "tracy-de-santa", name: "Tracy De Santa", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "juzo-mido", name: "Juzo Mido", universe: "codevein", emoji: "🩸", rarity: "UC",
  },
  {
    id: "kefka-palazzo", name: "Kefka Palazzo", universe: "ff6", emoji: "🎭", rarity: "UR",
  },
  {
    id: "sylux", name: "Sylux", universe: "metroid", emoji: "🚀", rarity: "UC",
  },
  {
    id: "safiya-llewellyn-fayyad", name: "Safiya Llewellyn-Fayyad", universe: "lifeisstrange", emoji: "🦋", rarity: "UC",
  },
  {
    id: "rikku", name: "Rikku", universe: "ff10", emoji: "🌊", rarity: "SR",
  },
  {
    id: "monoco", name: "Monoco", universe: "clair-obscur", emoji: "🖌️", rarity: "UC",
  },
  {
    id: "yoshimitsu", name: "Yoshimitsu", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "the-player", name: "The Player", universe: "poppyplaytime", emoji: "🧸", rarity: "UC",
  },
  {
    id: "josha", name: "Josha", universe: "zelda", emoji: "🗡️", rarity: "UC",
  },
  {
    id: "ultros", name: "Ultros", universe: "ff6", emoji: "🎭", rarity: "SR",
  },
  {
    id: "armstrong", name: "Armstrong", universe: "metroid", emoji: "🚀", rarity: "UC",
  },
  {
    id: "djidane-tribal", name: "Djidane Tribal", universe: "ff9", emoji: "🎺", rarity: "SR",
  },
  {
    id: "louis-amamiya", name: "Louis Amamiya", universe: "codevein", emoji: "🩸", rarity: "UC",
  },
  {
    id: "helena-harper", name: "Helena Harper", universe: "residentevil", emoji: "🧟", rarity: "UC",
  },
  {
    id: "lou-magmell", name: "Lou MagMell", universe: "codevein", emoji: "🩸", rarity: "UC",
  },
  {
    id: "grenat-til-alexandros-xvii", name: "Grenat Til Alexandros XVII", universe: "ff9", emoji: "🎺", rarity: "SR",
  },
  {
    id: "daniel-diaz", name: "Daniel Diaz", universe: "lifeisstrange", emoji: "🦋", rarity: "UC",
  },
  {
    id: "sean-johnson", name: "Sean Johnson", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "teba", name: "Teba", universe: "zelda", emoji: "🗡️", rarity: "UC",
  },
  {
    id: "floyd-hebert", name: "Floyd Hebert", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "meve-de-lyria", name: "Meve de Lyria", universe: "witcher", emoji: "🐺", rarity: "UC",
  },
  {
    id: "issun", name: "Issun", universe: "okami", emoji: "🖌️", rarity: "UC",
  },
  {
    id: "john-marston", name: "John Marston", universe: "reddead", emoji: "🤠", rarity: "UR",
  },
  {
    id: "gary-smith", name: "Gary Smith", universe: "bully", emoji: "🎒", rarity: "SR",
  },
  {
    id: "sidon", name: "Sidon", universe: "zelda", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "bibi-orunitia", name: "Bibi Orunitia", universe: "ff9", emoji: "🎺", rarity: "SR",
  },
  {
    id: "alexandra-chen", name: "Alexandra Chen", universe: "lifeisstrange", emoji: "🦋", rarity: "UC",
  },
  {
    id: "myurdin", name: "Myurdin", universe: "crimson-desert", emoji: "🏜️", rarity: "UC",
  },
  {
    id: "steve-haines", name: "Steve Haines", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "riju", name: "Riju", universe: "zelda", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "setzer-gabbiani", name: "Setzer Gabbiani", universe: "ff6", emoji: "🎭", rarity: "SR",
  },
  {
    id: "joy", name: "Joy", universe: "shenmue", emoji: "🥋", rarity: "UC",
  },
  {
    id: "denise-clinton", name: "Denise Clinton", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "dr-proton", name: "Dr. Proton", universe: "dukenukem", emoji: "💪", rarity: "UC",
  },
  {
    id: "jaskier", name: "Jaskier", universe: "witcher", emoji: "🐺", rarity: "UC",
  },
  {
    id: "jack-marston", name: "Jack Marston", universe: "reddead", emoji: "🤠", rarity: "UC",
  },
  {
    id: "rauru", name: "Rauru", universe: "zelda", emoji: "🗡️", rarity: "UC",
  },
  {
    id: "wei-cheng", name: "Wei Cheng", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "jerrin", name: "Jerrin", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "catalina", name: "Catalina", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "cycloid-empero", name: "Cycloid Empero", universe: "dukenukem", emoji: "💪", rarity: "UC",
  },
  {
    id: "eredin-breacc-glas", name: "Eredin Bréacc Glas", universe: "witcher", emoji: "🐺", rarity: "UC",
  },
  {
    id: "ray-bulgarin", name: "Ray Bulgarin", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "arthur-morgan", name: "Arthur Morgan", universe: "reddead", emoji: "🤠", rarity: "L",
  },
  {
    id: "johnny-vincent", name: "Johnny Vincent", universe: "bully", emoji: "🎒", rarity: "UC",
  },
  {
    id: "sir-jyscal-guado", name: "Sir Jyscal Guado", universe: "ff10", emoji: "🌊", rarity: "C",
  },
  {
    id: "sonia", name: "Sonia", universe: "zelda", emoji: "🗡️", rarity: "UC",
  },
  {
    id: "naira", name: "Naira", universe: "crimson-desert", emoji: "🏜️", rarity: "UC",
  },
  {
    id: "frank-tenpenny", name: "Frank Tenpenny", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "stretch", name: "Stretch", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "mazli", name: "Mazli", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "miguel", name: "Miguel", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "strago-magus", name: "Strago Magus", universe: "ff6", emoji: "🎭", rarity: "UC",
  },
  {
    id: "iwao-hazuki", name: "Iwao Hazuki", universe: "shenmue", emoji: "🥋", rarity: "UC",
  },
  {
    id: "sophitia-alexandra", name: "Sophitia Alexandra", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "chef", name: "Chef", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "imlerith", name: "Imlerith", universe: "witcher", emoji: "🐺", rarity: "UC",
  },
  {
    id: "mikhail-faustin", name: "Mikhail Faustin", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "bill-williamson", name: "Bill Williamson", universe: "reddead", emoji: "🤠", rarity: "UC",
  },
  {
    id: "purah", name: "Purah", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "damon-merrick", name: "Damon Merrick", universe: "lifeisstrange", emoji: "🦋", rarity: "UC",
  },
  {
    id: "cesar-vialpando", name: "Cesar Vialpando", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "raiden", name: "Raiden", universe: "metalgear", emoji: "🐍", rarity: "SR",
  },
  {
    id: "lamar-davis", name: "Lamar Davis", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "markus", name: "Markus", universe: "ff9", emoji: "🎺", rarity: "C",
  },
  {
    id: "relm-arrowny", name: "Relm Arrowny", universe: "ff6", emoji: "🎭", rarity: "UC",
  },
  {
    id: "xiuying-hong", name: "Xiuying Hong", universe: "shenmue", emoji: "🥋", rarity: "C",
  },
  {
    id: "taki", name: "Taki", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "solomon-richards", name: "Solomon Richards", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "caranthir-ar-feiniel", name: "Caranthir Ar-Feiniel", universe: "witcher", emoji: "🐺", rarity: "UC",
  },
  {
    id: "vladimir-glebov", name: "Vladimir Glebov", universe: "gta", emoji: "🚗", rarity: "UC",
  },
  {
    id: "lyle-mcleish", name: "Lyle McLeish", universe: "codevein", emoji: "🩸", rarity: "C",
  },
  {
    id: "dutch-van-der-linde", name: "Dutch van der Linde", universe: "reddead", emoji: "🤠", rarity: "UR",
  },
  {
    id: "lola-lombardi", name: "Lola Lombardi", universe: "bully", emoji: "🎒", rarity: "C",
  },
  {
    id: "kelk-ronso", name: "Kelk Ronso", universe: "ff10", emoji: "🌊", rarity: "C",
  },
  {
    id: "impa", name: "Impa", universe: "zelda", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "hank-stamper", name: "Hank Stamper", universe: "lifeisstrange", emoji: "🦋", rarity: "UC",
  },
  {
    id: "carlos-oliveira", name: "Carlos Oliveira", universe: "residentevil", emoji: "🧟", rarity: "C",
  },
  {
    id: "gray-fox", name: "Gray Fox", universe: "metalgear", emoji: "🐍", rarity: "SR",
  },
  {
    id: "cid-fabul-ix", name: "Cid Fabul IX", universe: "ff9", emoji: "🎺", rarity: "C",
  },
  {
    id: "mallorie-bardas", name: "Mallorie Bardas", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "luigi-goterelli", name: "Luigi Goterelli", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "guizhang-chen", name: "Guizhang Chen", universe: "shenmue", emoji: "🥋", rarity: "C",
  },
  {
    id: "raphael-sorel", name: "Raphael Sorel", universe: "soulcalibur", emoji: "⚔️", rarity: "UC",
  },
  {
    id: "letho-de-guleta", name: "Letho de Guleta", universe: "witcher", emoji: "🐺", rarity: "UC",
  },
  {
    id: "zenon-gryfgote", name: "Zenon Gryfgote", universe: "codevein", emoji: "🩸", rarity: "C",
  },
  {
    id: "nathan-dempsy", name: "Nathan Dempsy", universe: "residentevil", emoji: "🧟", rarity: "C",
  },
  {
    id: "javier-escuella", name: "Javier Escuella", universe: "reddead", emoji: "🤠", rarity: "UC",
  },
  {
    id: "derby-harrington", name: "Derby Harrington", universe: "bully", emoji: "🎒", rarity: "UC",
  },
  {
    id: "lisbeth-fischer", name: "Lisbeth Fischer", universe: "lifeisstrange", emoji: "🦋", rarity: "UC",
  },
  {
    id: "rebecca-chambers", name: "Rebecca Chambers", universe: "residentevil", emoji: "🧟", rarity: "C",
  },
  {
    id: "urbosa", name: "Urbosa", universe: "zelda", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "patrick-mcreary", name: "Patrick McReary", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "joey-leone", name: "Joey Leone", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "gogo", name: "Gogo", universe: "ff6", emoji: "🎭", rarity: "UC",
  },
  {
    id: "chai", name: "Chai", universe: "shenmue", emoji: "🥋", rarity: "C",
  },
  {
    id: "jacques-de-aldersberg", name: "Jacques de Aldersberg", universe: "witcher", emoji: "🐺", rarity: "C",
  },
  {
    id: "noah-g-magmell", name: "Noah G. MagMell", universe: "codevein", emoji: "🩸", rarity: "C",
  },
  {
    id: "edgar-ross", name: "Edgar Ross", universe: "reddead", emoji: "🤠", rarity: "C",
  },
  {
    id: "zaon", name: "Zaon", universe: "ff10", emoji: "🌊", rarity: "C",
  },
  {
    id: "yunobo", name: "Yunobo", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "dr-harley-sawyer", name: "Dr. Harley Sawyer", universe: "poppyplaytime", emoji: "🧸", rarity: "C",
  },
  {
    id: "jedediah-lucan", name: "Jedediah Lucan", universe: "lifeisstrange", emoji: "🦋", rarity: "C",
  },
  {
    id: "edgar-roni-figaro", name: "Edgar Roni Figaro", universe: "ff6", emoji: "🎭", rarity: "SR",
  },
  {
    id: "daruk", name: "Daruk", universe: "zelda", emoji: "🗡️", rarity: "SR",
  },
  {
    id: "brucie-kibbutz", name: "Brucie Kibbutz", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "bubsy-bobcat", name: "Bubsy Bobcat", universe: "bubsy", emoji: "🐱", rarity: "C",
  },
  {
    id: "chai-xianghua", name: "Chai Xianghua", universe: "soulcalibur", emoji: "⚔️", rarity: "SR",
  },
  {
    id: "marx", name: "Marx", universe: "kirby", emoji: "💛", rarity: "C",
  },
  {
    id: "azar-javed", name: "Azar Javed", universe: "witcher", emoji: "🐺", rarity: "C",
  },
  {
    id: "iris-magmell", name: "Iris MagMell", universe: "codevein", emoji: "🩸", rarity: "C",
  },
  {
    id: "juan-garcia-cortez", name: "Juan García Cortez", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "agustin-allende", name: "Agustín Allende", universe: "reddead", emoji: "🤠", rarity: "C",
  },
  {
    id: "ted-thompson", name: "Ted Thompson", universe: "bully", emoji: "🎒", rarity: "C",
  },
  {
    id: "robbie", name: "Robbie", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "branet-raza-alexandros-xvi", name: "Branet Raza Alexandros XVI", universe: "ff9", emoji: "🎺", rarity: "C",
  },
  {
    id: "sabin-rene-figaro", name: "Sabin Rene Figaro", universe: "ff6", emoji: "🎭", rarity: "SR",
  },
  {
    id: "sheva-alomar", name: "Sheva Alomar", universe: "residentevil", emoji: "🧟", rarity: "C",
  },
  {
    id: "corrado-bastoni", name: "Corrado Bastoni", universe: "mafia", emoji: "🎩", rarity: "C",
  },
  {
    id: "tatl", name: "Tatl", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "dwayne-forge", name: "Dwayne Forge", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "cruz-silva", name: "Cruz Silva", universe: "codevein", emoji: "🩸", rarity: "C",
  },
  {
    id: "gestahl", name: "Gestahl", universe: "ff6", emoji: "🎭", rarity: "C",
  },
  {
    id: "dona", name: "Dona", universe: "ff10", emoji: "🌊", rarity: "C",
  },
  {
    id: "terry-bobcat", name: "Terry Bobcat", universe: "bubsy", emoji: "🐱", rarity: "C",
  },
  {
    id: "magolor", name: "Magolor", universe: "kirby", emoji: "💛", rarity: "C",
  },
  {
    id: "rachel-amber", name: "Rachel Amber", universe: "lifeisstrange", emoji: "🦋", rarity: "C",
  },
  {
    id: "jadwiga", name: "Jadwiga", universe: "codevein", emoji: "🩸", rarity: "C",
  },
  {
    id: "avery-carrington", name: "Avery Carrington", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "pj-pug-a-pillar", name: "PJ Pug-a-Pillar", universe: "poppyplaytime", emoji: "🧸", rarity: "C",
  },
  {
    id: "yasmin-fayyad", name: "Yasmin Fayyad", universe: "lifeisstrange", emoji: "🦋", rarity: "C",
  },
  {
    id: "shadow-2", name: "Shadow", universe: "ff6", emoji: "🎭", rarity: "C",
  },
  {
    id: "jake-muller", name: "Jake Muller", universe: "residentevil", emoji: "🧟", rarity: "C",
  },
  {
    id: "maxi", name: "Maxi", universe: "soulcalibur", emoji: "⚔️", rarity: "C",
  },
  {
    id: "ron-jakowski", name: "Ron Jakowski", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "skull-kid", name: "Skull Kid", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "karen-daniels", name: "Karen Daniels", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "gregorio-silva", name: "Gregorio Silva", universe: "codevein", emoji: "🩸", rarity: "C",
  },
  {
    id: "terri-bobcat", name: "Terri Bobcat", universe: "bubsy", emoji: "🐱", rarity: "C",
  },
  {
    id: "natsu", name: "Natsu", universe: "soulcalibur", emoji: "⚔️", rarity: "C",
  },
  {
    id: "midna", name: "Midna", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "sherry-birkin", name: "Sherry Birkin", universe: "residentevil", emoji: "🧟", rarity: "C",
  },
  {
    id: "brian-heder", name: "Brian Heder", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "paya", name: "Paya", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "garland", name: "Garland", universe: "ff9", emoji: "🎺", rarity: "C",
  },
  {
    id: "lucas-colmenero", name: "Lucas Colmenero", universe: "lifeisstrange", emoji: "🦋", rarity: "C",
  },
  {
    id: "cyan-garamonde", name: "Cyan Garamonde", universe: "ff6", emoji: "🎭", rarity: "C",
  },
  {
    id: "longsun-zhao", name: "Longsun Zhao (alias Lan Di)", universe: "shenmue", emoji: "🥋", rarity: "C",
  },
  {
    id: "wade-hebert", name: "Wade Hebert", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "vaati", name: "Vaati", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "triss-merigold-de-maribor", name: "Triss Merigold de Maribor", universe: "witcher", emoji: "🐺", rarity: "C",
  },
  {
    id: "bernie-crane", name: "Bernie Crane", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "curator", name: "Curator", universe: "clair-obscur", emoji: "🖌️", rarity: "C",
  },
  {
    id: "oinker-p-hamm", name: "Oinker P. Hamm", universe: "bubsy", emoji: "🐱", rarity: "C",
  },
  {
    id: "james-hopkins", name: "Jimmy Hopkins", universe: "bully", emoji: "🎒", rarity: "C",
  },
  {
    id: "vue-995", name: "VUE 995", universe: "metroid", emoji: "🚀", rarity: "C",
  },
  {
    id: "tulin", name: "Tulin", universe: "zelda", emoji: "🗡️", rarity: "C",
  },
  {
    id: "devin-weston", name: "Devin Weston", universe: "gta", emoji: "🚗", rarity: "C",
  },
  {
    id: "necron", name: "Nécron", universe: "ff9", emoji: "🎺", rarity: "C",
  },
  {
    id: "ryan-lucan", name: "Ryan Lucan", universe: "lifeisstrange", emoji: "🦋", rarity: "C",
  },
  {
    id: "gau", name: "Gau", universe: "ff6", emoji: "🎭", rarity: "C",
  },

  // ——— World of Warcraft ———
  {
    id: "arthas", name: "Arthas Menethil", universe: "wow", emoji: "❄️", rarity: "L",
  },
  {
    id: "illidan", name: "Illidan Stormrage", universe: "wow", emoji: "👁️", rarity: "L",
  },
  {
    id: "sylvanas", name: "Sylvanas Windrunner", universe: "wow", emoji: "🏹", rarity: "SR",
  },
  {
    id: "thrall", name: "Thrall", universe: "wow", emoji: "🌩️", rarity: "SR",
  },
  {
    id: "jaina", name: "Jaina Proudmoore", universe: "wow", emoji: "🧊", rarity: "R",
  },
  {
    id: "anduin", name: "Anduin Wrynn", universe: "wow", emoji: "🕊️", rarity: "UC",
  },

  // ——— Final Fantasy XIV ———
  {
    id: "emet-selch", name: "Emet-Selch", universe: "ff14", emoji: "🎭", rarity: "L",
  },
  {
    id: "yshtola", name: "Y'shtola Rhul", universe: "ff14", emoji: "🔮", rarity: "SR",
  },
  {
    id: "alphinaud", name: "Alphinaud Leveilleur", universe: "ff14", emoji: "📖", rarity: "UC",
  },
  {
    id: "alisaie", name: "Alisaie Leveilleur", universe: "ff14", emoji: "🗡️", rarity: "C",
  },
  {
    id: "estinien", name: "Estinien Wyrmblood", universe: "ff14", emoji: "🐉", rarity: "R",
  },
  {
    id: "urianger", name: "Urianger Augurelt", universe: "ff14", emoji: "📜", rarity: "UC",
  },

  // ——— Dofus ———
  {
    id: "goultard", name: "Goultard", universe: "dofus", emoji: "⚔️", rarity: "L",
  },
  {
    id: "comte-harebourg", name: "Comte Harebourg", universe: "dofus", emoji: "⏳", rarity: "UR",
  },
  {
    id: "dark-vlad", name: "Dark Vlad", universe: "dofus", emoji: "🦇", rarity: "SR",
  },
  {
    id: "nox", name: "Nox", universe: "dofus", emoji: "⌛", rarity: "SR",
  },
  {
    id: "joris-jurgen", name: "Joris Jurgen", universe: "dofus", emoji: "🗝️", rarity: "R",
  },
  {
    id: "kerubim", name: "Kerubim Crépin", universe: "dofus", emoji: "🐈", rarity: "C",
  },
  {
    id: "dathura", name: "Dathura", universe: "dofus", emoji: "🌑", rarity: "C",
  },

  // ——— Guild Wars 2 ———
  {
    id: "aurene", name: "Aurene", universe: "guildwars2", emoji: "🐲", rarity: "L",
  },
  {
    id: "rytlock", name: "Rytlock Brimstone", universe: "guildwars2", emoji: "🔥", rarity: "UR",
  },
  {
    id: "caithe", name: "Caithe", universe: "guildwars2", emoji: "🌿", rarity: "SR",
  },
  {
    id: "logan-thackeray", name: "Logan Thackeray", universe: "guildwars2", emoji: "🛡️", rarity: "UC",
  },
  {
    id: "zojja", name: "Zojja", universe: "guildwars2", emoji: "⚙️", rarity: "C",
  },
  {
    id: "trahearne", name: "Trahearne", universe: "guildwars2", emoji: "🌳", rarity: "SR",
  },

  // ——— Compléments World of Warcraft, FF XIV, Dofus et Guild Wars 2 ———
  {
    id: "tirion-fordring", name: "Tirion Fordring", universe: "wow", emoji: "⚖️", rarity: "UC",
  },
  {
    id: "garrosh", name: "Garrosh Hurlorage", universe: "wow", emoji: "🪓", rarity: "C",
  },
  {
    id: "venat", name: "Venat", universe: "ff14", emoji: "💠", rarity: "UR",
  },
  {
    id: "haurchefant", name: "Haurchefant Greystone", universe: "ff14", emoji: "🛡️", rarity: "C",
  },
  {
    id: "zenos", name: "Zenos yae Galvus", universe: "ff14", emoji: "🩸", rarity: "SR",
  },
  {
    id: "aymeric", name: "Aymeric de Borel", universe: "ff14", emoji: "⚜️", rarity: "C",
  },
  {
    id: "graha-tia", name: "G'raha Tia", universe: "ff14", emoji: "📚", rarity: "C",
  },
  {
    id: "arpagone", name: "Arpagone", universe: "dofus", emoji: "💰", rarity: "UC",
  },
  {
    id: "rushu", name: "Rushu", universe: "dofus", emoji: "😈", rarity: "UR",
  },
  {
    id: "palawa-joko", name: "Palawa Joko", universe: "guildwars2", emoji: "☠️", rarity: "R",
  },

  // ——— RuneScape ———
  {
    id: "king-black-dragon", name: "Roi Noir des Dragons", universe: "runescape", emoji: "🐉", rarity: "UR",
  },
  {
    id: "zamorak", name: "Zamorak", universe: "runescape", emoji: "🌪️", rarity: "SR",
  },
  {
    id: "zaros", name: "Zaros", universe: "runescape", emoji: "🌑", rarity: "R",
  },
  {
    id: "wise-old-man", name: "Le Grand Sage", universe: "runescape", emoji: "🪙", rarity: "UC",
  },

  // ——— The Elder Scrolls Online ———
  {
    id: "mannimarco", name: "Mannimarco", universe: "eso", emoji: "💀", rarity: "UR",
  },
  {
    id: "cadwell", name: "Cadwell", universe: "eso", emoji: "🍲", rarity: "SR",
  },

  // ——— Lost Ark ———
  {
    id: "brelshaza", name: "Brelshaza", universe: "lostark", emoji: "🕸️", rarity: "SR",
  },

  // ——— Star Wars: The Old Republic ———
  {
    id: "malgus", name: "Dark Malgus", universe: "swtor", emoji: "⚡", rarity: "UR",
  },
  {
    id: "satele-shan", name: "Satele Shan", universe: "swtor", emoji: "🌌", rarity: "SR",
  },

  // ——— EverQuest ———
  {
    id: "kerafyrm", name: "Kerafyrm, le Dormeur", universe: "everquest", emoji: "🐉", rarity: "UR",
  },
  {
    id: "firiona-vie", name: "Firiona Vie", universe: "everquest", emoji: "🌟", rarity: "SR",
  },

  // ——— Lineage II ———
  {
    id: "antharas", name: "Antharas", universe: "lineage2", emoji: "🐉", rarity: "UR",
  },
  {
    id: "baium", name: "Baium", universe: "lineage2", emoji: "👑", rarity: "SR",
  },

  // ——— Ragnarok Online ———
  {
    id: "baphomet", name: "Baphomet", universe: "ragnarok", emoji: "🐐", rarity: "UR",
  },
  {
    id: "valkyrie-randgris", name: "Valkyrie Randgris", universe: "ragnarok", emoji: "🌟", rarity: "SR",
  },

  // ——— MapleStory ———
  {
    id: "black-mage", name: "Le Mage Noir", universe: "maplestory", emoji: "🖤", rarity: "SR",
  },
  {
    id: "zakum", name: "Zakum", universe: "maplestory", emoji: "🔥", rarity: "UC",
  },

  // ——— Aion ———
  {
    id: "tiamat", name: "Tiamat", universe: "aion", emoji: "🐉", rarity: "SR",
  },
  {
    id: "marchutan", name: "Marchutan", universe: "aion", emoji: "🛡️", rarity: "UC",
  },

  // ——— TERA ———
  {
    id: "elion-dulas", name: "Elion Dulas", universe: "tera", emoji: "🗡️", rarity: "UC",
  },

  // ——— Blade & Soul ———
  {
    id: "jin-soyeon", name: "Jin Soyeon", universe: "bladeandsoul", emoji: "🌑", rarity: "SR",
  },
  {
    id: "hong-seokkeun", name: "Maître Hong", universe: "bladeandsoul", emoji: "🥋", rarity: "UC",
  },

  // ——— Black Desert Online ———
  {
    id: "black-spirit", name: "L'Esprit Occulte", universe: "blackdesert", emoji: "🌀", rarity: "SR",
  },

  // ——— The Secret World ———
  {
    id: "kirsten-geary", name: "Kirsten Geary", universe: "thesecretworld", emoji: "💼", rarity: "UC",
  },

  // ——— Phantasy Star Online 2 ———
  {
    id: "dark-falz-persona", name: "Dark Falz Persona", universe: "pso2", emoji: "🌑", rarity: "SR",
  },

  // ——— Age of Conan ———
  {
    id: "conan", name: "Conan le Cimmérien", universe: "ageofconan", emoji: "⚔️", rarity: "L",
  },

  // ——— City of Heroes ———
  {
    id: "statesman", name: "Statesman", universe: "cityofheroes", emoji: "🛡️", rarity: "SR",
  },
  {
    id: "lord-recluse", name: "Lord Recluse", universe: "cityofheroes", emoji: "🕷️", rarity: "UC",
  },

  // ——— Tibia ———
  {
    id: "ferumbras", name: "Ferumbras", universe: "tibia", emoji: "🧙", rarity: "SR",
  },

  // ——— WildStar ———
  {
    id: "avatus", name: "Avatus", universe: "wildstar", emoji: "🤖", rarity: "SR",
  },
  {
    id: "artemis-zin", name: "Artemis Zin", universe: "wildstar", emoji: "🎥", rarity: "UC",
  },

  // ——— Flyff ———
  {
    id: "clockworks", name: "Clockworks", universe: "flyff", emoji: "⚙️", rarity: "R",
  },

  // ——— Warhammer Online ———
  {
    id: "tcharzanek", name: "Tchar'zanek", universe: "warhammeronline", emoji: "🌀", rarity: "SR",
  },
  {
    id: "malekith", name: "Malekith, le Roi Sorcier", universe: "warhammeronline", emoji: "👑", rarity: "UC",
  },

  // ——— Albion Online ———

  // ——— MU Online ———
  {
    id: "kundun", name: "Kundun", universe: "muonline", emoji: "👹", rarity: "R",
  },

  // ——— Wakfu ———
  {
    id: "yugo", name: "Yugo", universe: "wakfu", emoji: "🌀", rarity: "SR",
  },
  {
    id: "qilby", name: "Qilby", universe: "wakfu", emoji: "🧠", rarity: "UC",
  },

  // ——— Star Trek Online ———
  {
    id: "jula", name: "J'Ula", universe: "startrek", emoji: "🛰️", rarity: "R",
  },

  // ——— DC Universe Online ———
  {
    id: "lex-luthor", name: "Lex Luthor", universe: "dcuo", emoji: "💼", rarity: "UR",
  },
  {
    id: "brainiac", name: "Brainiac", universe: "dcuo", emoji: "🛸", rarity: "SR",
  },

  // ——— Dragon Nest ———
  {
    id: "velskud", name: "Velskud", universe: "dragonnest", emoji: "🐉", rarity: "R",
  },

  // ——— Rift ———
  {
    id: "crucia", name: "Crucia", universe: "rift", emoji: "🌩️", rarity: "R",
  },

  // ——— Rappelz ———
  {
    id: "abhuva", name: "Abhuva, la Sorcière Blanche", universe: "rappelz", emoji: "❄️", rarity: "R",
  },

  // ——— The Lord of the Rings Online ———
  {
    id: "witch-king", name: "Le Roi-Sorcier d'Angmar", universe: "lotro", emoji: "👑", rarity: "L",
  },
  {
    id: "tom-bombadil", name: "Tom Bombadil", universe: "lotro", emoji: "🎶", rarity: "SR",
  },

  // ——— ArcheAge ———

  // ——— Star Wars Galaxies ———
  {
    id: "xizor", name: "Le Prince Xizor", universe: "swgalaxies", emoji: "🕶️", rarity: "R",
  },

  // ——— Phantasy Star Online (classique) ———
  {
    id: "dark-falz-pso", name: "Dark Falz", universe: "pso", emoji: "👁️", rarity: "R",
  },

  // ——— Ragnarok Online ———
  {
    id: "surt", name: "Surt", universe: "ragnarok", emoji: "🔥", rarity: "R",
  },

  // ——— Blade & Soul ———
  {
    id: "yura", name: "Yura", universe: "bladeandsoul", emoji: "🎭", rarity: "C",
  },

  // ——— Cabal Online ———

  // ——— Lineage II ———
  {
    id: "shilen", name: "Shilen", universe: "lineage2", emoji: "🌘", rarity: "R",
  },

  // ——— Knight Online ———

  // ——— Atlantica Online ———

  // ——— Fiesta Online ———

  // ——— Perfect World ———

  // ——— TERA ———

  // ——— Silent Hill ———
  {
    id: "james-sunderland", name: "James Sunderland", universe: "silenthill", emoji: "✉️", rarity: "SR",
  },

  // ——— Alien: Isolation ———
  {
    id: "xenomorphe", name: "L'Xénomorphe", universe: "alienisolation", emoji: "👽", rarity: "L",
  },
  {
    id: "amanda-ripley", name: "Amanda Ripley", universe: "alienisolation", emoji: "🔧", rarity: "UR",
  },

  // ——— Slender: The Eight Pages ———

  // ——— The Evil Within ———
  {
    id: "sebastian-castellanos", name: "Sebastian Castellanos", universe: "evilwithin", emoji: "🔦", rarity: "UR",
  },
  {
    id: "the-keeper", name: "The Keeper", universe: "evilwithin", emoji: "🔒", rarity: "UR",
  },

  // ——— Outlast ———
  {
    id: "trager", name: "Dr Richard Trager", universe: "outlast", emoji: "✂️", rarity: "UR",
  },

  // ——— Dead Space ———
  {
    id: "regenerateur", name: "Le Régénérateur", universe: "deadspace", emoji: "🦴", rarity: "UR",
  },

  // ——— Five Nights at Freddy's ———
  {
    id: "springtrap", name: "Springtrap", universe: "fnaf", emoji: "🐰", rarity: "L",
  },

  // ——— Until Dawn ———
  {
    id: "wendigo", name: "Le Wendigo", universe: "untildawn", emoji: "🦌", rarity: "UR",
  },

  // ——— Layers of Fear ———
  {
    id: "peintre", name: "Le Peintre", universe: "layersoffear", emoji: "🎨", rarity: "UR",
  },

  // ——— Project Zero ———
  {
    id: "femme-cheveux-denoues", name: "La Femme aux Cheveux Dénoués", universe: "projectzero", emoji: "📷", rarity: "UR",
  },

  // ——— Phasmophobia ———
  {
    id: "demon", name: "Le Démon", universe: "phasmophobia", emoji: "😈", rarity: "UR",
  },

  // ——— Dead by Daylight ———
  {
    id: "ghost-face", name: "Ghost Face", universe: "deadbydaylight", emoji: "🔪", rarity: "UR",
  },

  // ——— SOMA ———
  {
    id: "simon-jarrett", name: "Simon Jarrett", universe: "soma", emoji: "🤖", rarity: "SR",
  },

  // ——— Darkwood ———
  {
    id: "passant", name: "Le Passant", universe: "darkwood", emoji: "🪵", rarity: "SR",
  },

  // ——— Dead Space (compléments) ———
  {
    id: "mercer", name: "Le Docteur Mercer", universe: "deadspace", emoji: "🩺", rarity: "UR",
  },

  // ——— Amnesia: The Bunker ———
  {
    id: "bete", name: "La Bête", universe: "amnesia", emoji: "🐾", rarity: "L",
  },

  // ——— The Mortuary Assistant ———

  // ——— Iron Lung ———

  // ——— Manhunt ———
  {
    id: "james-earl-cash", name: "James Earl Cash", universe: "manhunt", emoji: "🎥", rarity: "UR",
  },

  // ——— Doki Doki Literature Club! ———
  {
    id: "monika", name: "Monika", universe: "dokidoki", emoji: "🎀", rarity: "L",
  },

  // ——— Dead by Daylight (compléments) ———
  {
    id: "chasseuse", name: "La Chasseuse", universe: "deadbydaylight", emoji: "🪓", rarity: "UR",
  },

  // ——— Project Zero (compléments) ———
  {
    id: "kusabi", name: "Kusabi", universe: "projectzero", emoji: "⛓️", rarity: "UR",
  },

  // ——— Subnautica ———
  {
    id: "leviatan-faucheur", name: "Le Léviathan Faucheur", universe: "subnautica", emoji: "🦈", rarity: "UR",
  },

  // ——— Signalis ———
  {
    id: "elster", name: "Elster", universe: "signalis", emoji: "🤖", rarity: "UR",
  },

  // ——— Ori ———
  {
    id: "kuro", name: "Kuro", universe: "ori", emoji: "🦉", rarity: "UR",
  },
  {
    id: "shriek", name: "Shriek", universe: "ori", emoji: "🌑", rarity: "L",
  },

  // ——— Elden Ring (compléments) ———
  {
    id: "tarnished", name: "Le Tarnisé", universe: "eldenring", emoji: "⚔️", rarity: "UR",
  },
  {
    id: "ranni", name: "Ranni la Sorcière", universe: "eldenring", emoji: "🌙", rarity: "L",
  },

  // ——— Bloodborne ———
  // « hunter » est déjà pris par le personnage de Spyro.
  {
    id: "hunter-bloodborne", name: "Le Chasseur", universe: "bloodborne", emoji: "🩸", rarity: "L",
  },

  // ——— Cyberpunk 2077 ———
  {
    id: "v", name: "V", universe: "cyberpunk", emoji: "🔫", rarity: "UR",
  },

  // ——— The Elder Scrolls V: Skyrim ———
  {
    id: "lydia", name: "Lydia", universe: "skyrim", emoji: "🛡️", rarity: "UC",
  },
  {
    id: "maiq", name: "M'aiq le Menteur", universe: "skyrim", emoji: "🐱", rarity: "C",
  },

  // ——— Fallout ———
  {
    id: "dogmeat", name: "Canigou", universe: "fallout", emoji: "🐕", rarity: "R",
  },
  {
    id: "vendeur-vault-tec", name: "Le Vendeur de Vault-Tec", universe: "fallout", emoji: "🧳", rarity: "C",
  },

  // ——— Mass Effect ———
  {
    id: "conrad-verner", name: "Conrad Verner", universe: "masseffect", emoji: "🫡", rarity: "C",
  },

  // ——— Borderlands ———
  {
    id: "claptrap", name: "Claptrap", universe: "borderlands", emoji: "🤖", rarity: "R",
  },
  {
    id: "face-mcshooty", name: "Face McShooty", universe: "borderlands", emoji: "🎯", rarity: "C",
  },

  // ——— Cyberpunk 2077 (compléments) ———
  {
    id: "jackie-welles", name: "Jackie Welles", universe: "cyberpunk", emoji: "🍻", rarity: "R",
  },

  // ——— Metal Gear Solid (compléments) ———
  {
    id: "johnny-sasaki", name: "Johnny Sasaki", universe: "metalgear", emoji: "🚽", rarity: "C",
  },

  // ——— Minecraft (compléments) ———
  {
    id: "villageois", name: "Le Villageois", universe: "minecraft", emoji: "🧑‍🌾", rarity: "C",
  },

  // ——— Left 4 Dead ———
  {
    id: "louis", name: "Louis", universe: "l4d", emoji: "💊", rarity: "UC",
  },

  // ——— Team Fortress 2 ———
  {
    id: "spy", name: "L'Espion", universe: "tf2", emoji: "🕵️", rarity: "R",
  },
  {
    id: "heavy", name: "Le Heavy", universe: "tf2", emoji: "💪", rarity: "R",
  },

  // ——— Stardew Valley ———
  {
    id: "m-qi", name: "M. Qi", universe: "stardew", emoji: "💠", rarity: "R",
  },

  // ——— Hollow Knight (compléments) ———
  {
    id: "cornifer", name: "Cornifer", universe: "hollowknight", emoji: "🗺️", rarity: "C",
  },

  // ——— Hades ———
  {
    id: "hypnos", name: "Hypnos", universe: "hades", emoji: "😴", rarity: "C",
  },

  // ——— Cuphead (compléments) ———
  {
    id: "diable", name: "Le Diable", universe: "cuphead", emoji: "😈", rarity: "UR",
  },

  // ——— Dead Cells ———
  {
    id: "prisonnier", name: "Le Prisonnier", universe: "deadcells", emoji: "🗡️", rarity: "R",
  },

  // ——— Plants vs. Zombies ———
  {
    id: "zombie-cone", name: "Le Zombie au Cône", universe: "pvz", emoji: "🚧", rarity: "C",
  },

  // ——— Katana Zero ———
  {
    id: "zero", name: "Zéro", universe: "katanazero", emoji: "⚡", rarity: "SR",
  },

  // ——— Untitled Goose Game ———
  {
    id: "oie", name: "L'Oie", universe: "goose", emoji: "🪿", rarity: "R",
  },

  // ——— Hotline Miami ———
  {
    id: "jacket", name: "Jacket", universe: "hotlinemiami", emoji: "🎭", rarity: "SR",
  },

  // ——— Don't Starve ———
  {
    id: "wilson", name: "Wilson P. Higgsbury", universe: "dontstarve", emoji: "🎩", rarity: "R",
  },

  // ——— Plants vs. Zombies (compléments) ———
  {
    id: "tournesol", name: "Le Tournesol", universe: "pvz", emoji: "🌻", rarity: "C",
  },

  // ——— Among Us ———
  {
    id: "imposteur", name: "L'Imposteur", universe: "amongus", emoji: "🔪", rarity: "R",
  },

  // ——— Fall Guys ———
  {
    id: "fall-guy", name: "Le Fall Guy", universe: "fallguys", emoji: "🫘", rarity: "C",
  },

  // ——— Goat Simulator ———
  {
    id: "pilgor", name: "Pilgor", universe: "goatsim", emoji: "🐐", rarity: "R",
  },

  // ——— Shovel Knight ———
  {
    id: "shovel-knight", name: "Shovel Knight", universe: "shovelknight", emoji: "🪏", rarity: "R",
  },

  // ——— Super Meat Boy ———
  {
    id: "meat-boy", name: "Meat Boy", universe: "supermeatboy", emoji: "🥩", rarity: "R",
  },

  // ——— Limbo ———
  {
    id: "petit-garcon", name: "Le Petit Garçon", universe: "limbo", emoji: "🌑", rarity: "C",
  },

  // ——— Papers, Please ———
  {
    id: "inspecteur", name: "L'Inspecteur des Douanes", universe: "papersplease", emoji: "🛂", rarity: "C",
  },

  // ——— Disco Elysium ———
  {
    id: "harry", name: "Harry Du Bois", universe: "discoelysium", emoji: "🥃", rarity: "UR",
  },

  // ——— Pentiment ———
  {
    id: "andreas", name: "Andreas Maler", universe: "pentiment", emoji: "🖋️", rarity: "R",
  },

  // ——— Outer Wilds ———
  {
    id: "explorateur", name: "L'Explorateur", universe: "outerwilds", emoji: "🪕", rarity: "R",
  },

  // ——— Katamari Damacy ———
  {
    id: "prince", name: "Le Prince", universe: "katamari", emoji: "🧶", rarity: "R",
  },

  // ——— Octopath Traveler ———

  // ——— Darkest Dungeon ———
  {
    id: "croise", name: "Le Croisé", universe: "darkesstdungeon", emoji: "✝️", rarity: "R",
  },

  // ——— Hotline Miami (compléments) ———
  {
    id: "biker", name: "Biker", universe: "hotlinemiami", emoji: "🪓", rarity: "SR",
  },

  // ——— Papers, Please (compléments) ———
  {
    id: "jorji", name: "Jorji Costava", universe: "papersplease", emoji: "🎫", rarity: "C",
  },

  // ——— Slime Rancher ———
  {
    id: "beatrix", name: "Beatrix LeBeau", universe: "slimerancher", emoji: "🫧", rarity: "UC",
  },

  // ——— Untitled Goose Game (compléments) ———
  {
    id: "jardinier", name: "Le Jardinier", universe: "goose", emoji: "🌷", rarity: "C",
  },

  // ——— Cuphead (compléments) ———
  {
    id: "baroness", name: "La Baronne Von Bon Bon", universe: "cuphead", emoji: "🍬", rarity: "SR",
  },

  // ——— Minecraft (compléments) ———
  {
    id: "marchand", name: "Le Marchand Ambulant", universe: "minecraft", emoji: "🦙", rarity: "C",
  },

  // ——— Subnautica (compléments) ———
  {
    id: "rodeur", name: "Le Rôdeur", universe: "subnautica", emoji: "🦎", rarity: "UC",
  },

  {
    id: "tanner", name: "Tanner", universe: "driver", emoji: "🚗", rarity: "R",
  },

  // ——— Stratégie (octobre 2026) ———
  {
    id: "thrawn", name: "Grand Amiral Thrawn", universe: "empireatwar", emoji: "🎯", rarity: "UR",
  },
  {
    id: "napoleon", name: "Napoléon Bonaparte", universe: "totalwar", emoji: "🎩", rarity: "UR",
  },
  {
    id: "cesar", name: "Jules César", universe: "totalwar", emoji: "🏛️", rarity: "SR",
  },
  {
    id: "duc-de-paille", name: "Le Duc de Paille", universe: "stronghold", emoji: "🐷", rarity: "R",
  },

  // ——— Halloween (octobre 2026) ———
  // Vingt cartes exclusives : des versions spectrales de personnages du
  // catalogue, à collectionner en plus de leur carte normale. `season` les
  // rattache à la saison : elles ne sortent que du pack d'Halloween (la
  // citrouille de l'overlay) et n'appartiennent à aucun pack de genre — voir
  // `card-genres` et le tirage en base (migration 061). Leur visuel est celui
  // du personnage d'origine, teinté de violet par le CSS `[data-season]` ; leur
  // identifiant finit par `-halloween` et leur nom ne reprend jamais celui de
  // la carte dont elles sont la version.
  {
    id: "luigi-halloween", name: "Luigi spectral", universe: "mario", emoji: "👻", rarity: "C", season: "halloween",
  },
  {
    id: "yoshi-halloween", name: "Yoshi des brumes", universe: "mario", emoji: "🕯️", rarity: "C", season: "halloween",
  },
  {
    id: "papyrus-halloween", name: "Papyrus momie", universe: "undertale", emoji: "🧟", rarity: "C", season: "halloween",
  },
  {
    id: "eggman-halloween", name: "Eggman citrouille", universe: "sonic", emoji: "🎃", rarity: "C", season: "halloween",
  },
  {
    id: "pikachu-halloween", name: "Pikachu fantôme", universe: "pokemon", emoji: "👻", rarity: "UC", season: "halloween",
  },
  {
    id: "knuckles-halloween", name: "Knuckles momie", universe: "sonic", emoji: "🧟", rarity: "UC", season: "halloween",
  },
  {
    id: "cuphead-halloween", name: "Cuphead démoniaque", universe: "cuphead", emoji: "😈", rarity: "UC", season: "halloween",
  },
  {
    id: "crash-halloween", name: "Crash citrouille", universe: "crash", emoji: "🎃", rarity: "UC", season: "halloween",
  },
  {
    id: "bowser-halloween", name: "Bowser citrouille", universe: "mario", emoji: "🎃", rarity: "R", season: "halloween",
  },
  {
    id: "peach-halloween", name: "Peach ensorcelée", universe: "mario", emoji: "🕸️", rarity: "R", season: "halloween",
  },
  {
    id: "zelda-halloween", name: "Zelda revenante", universe: "zelda", emoji: "🦇", rarity: "R", season: "halloween",
  },
  {
    id: "alucard-halloween", name: "Alucard vampire", universe: "castlevania", emoji: "🧛", rarity: "R", season: "halloween",
  },
  {
    id: "nemesis-halloween", name: "Nemesis rampant", universe: "residentevil", emoji: "🧟", rarity: "SR", season: "halloween",
  },
  {
    id: "doom-slayer-halloween", name: "Doom Slayer infernal", universe: "doom", emoji: "💀", rarity: "SR", season: "halloween",
  },
  {
    id: "master-chief-halloween", name: "Master Chief hanté", universe: "halo", emoji: "👽", rarity: "SR", season: "halloween",
  },
  {
    id: "dante-halloween", name: "Dante démoniaque", universe: "dmc", emoji: "😈", rarity: "SR", season: "halloween",
  },
  {
    id: "mario-halloween", name: "Mario fantôme", universe: "mario", emoji: "👻", rarity: "UR", season: "halloween",
  },
  {
    id: "link-halloween", name: "Link d'outre-tombe", universe: "zelda", emoji: "💀", rarity: "UR", season: "halloween",
  },
  {
    id: "sonic-halloween", name: "Sonic loup-garou", universe: "sonic", emoji: "🐺", rarity: "UR", season: "halloween",
  },
  {
    id: "kirby-halloween", name: "Kirby citrouille", universe: "kirby", emoji: "🎃", rarity: "L", season: "halloween",
  },
];

// Index des ajouts et corrections de l'atelier, par identifiant.
const ATELIER_BY_ID = new Map(ATELIER_CARDS.map((card) => [card.id, card]));
const BASE_IDS = new Set(BASE_CARDS.map((card) => card.id));

/**
 * Catalogue complet : le catalogue de base ci-dessus, puis les cartes créées
 * par l'atelier (`src/data/atelier-cards.json`). L'ordre fait les numéros
 * d'album : un ajout prend donc le dernier numéro, sans renuméroter le reste.
 *
 * Une entrée d'atelier qui porte l'identifiant d'une carte de base la remplace
 * sur place (l'atelier sert aussi à corriger une carte existante) : les numéros
 * d'album des autres cartes ne bougent pas et aucune carte n'apparaît deux fois.
 */
export const CARDS: Card[] = [
  ...BASE_CARDS.map((card) => ATELIER_BY_ID.get(card.id) ?? card),
  ...ATELIER_CARDS.filter((card) => !BASE_IDS.has(card.id)),
];

/** Cartes approuvées dans l'admin, disponibles immédiatement après publication. */
function allCards(): Card[] {
  const known = new Set(CARDS.map((card) => card.id));
  return [...CARDS, ...publishedCards().filter((card) => !known.has(card.id))];
}

/**
 * Contrôle d'unicité du catalogue.
 *
 * Deux cartes ne peuvent pas partager un identifiant (il sert de clé dans
 * `collection`) ni représenter le même personnage deux fois dans un univers.
 * Renvoie la liste des problèmes, vide si le catalogue est sain.
 */
export function findDuplicateCards(list: Card[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const seenCharacters = new Set<string>();

  for (const card of list) {
    const id = card.id.trim().toLowerCase();
    if (seenIds.has(id)) problems.push(`identifiant déjà utilisé : ${card.id}`);
    seenIds.add(id);

    // « Kratos (God of War) » et « Kratos (God of War) » sont le même personnage,
    // même si l'un a un espace de trop ou une majuscule différente.
    const character = `${card.universe}::${card.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
    if (seenCharacters.has(character)) {
      problems.push(`personnage déjà présent : ${card.name} (${card.universe})`);
    }
    seenCharacters.add(character);
  }

  return problems;
}

// Garde-fou : une carte en double casse le build et le démarrage du serveur,
// plutôt que d'apparaître silencieusement dans les boosters.
const CARD_DUPLICATES = findDuplicateCards(CARDS);
if (CARD_DUPLICATES.length > 0) {
  throw new Error(`Catalogue de cartes invalide :\n  ${CARD_DUPLICATES.join("\n  ")}`);
}

const CARDS_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

/** Numéro d'album : position de la carte dans le catalogue (1-indexé). */
const CARD_NUMBERS = new Map(CARDS.map((card, index) => [card.id, index + 1]));

/** Carte retirée du catalogue (elle n'est plus jouable, mais reste affichée). */
export function isRetiredCard(id: string): boolean {
  return CARDS.some((card) => card.id === id && card.retired === true);
}

/**
 * Cartes encore au catalogue, telles que le site doit les compter : les
 * retirées du code et les supprimées depuis l'atelier en ligne sont exclues,
 * et les corrections faites en ligne (nom, rareté…) sont appliquées.
 */
export function catalogCards(): Card[] {
  const published = publishedCardEdits().map((edit) => ({
    cardId: edit.cardId,
    number: edit.publishedCard?.number,
  }));
  const byId = new Map(published.map((edit) => [edit.cardId, edit]));
  return applyCardEdits(allCards())
    .filter((card) => card.retired !== true)
    .map((card) => {
      const edit = byId.get(card.id);
      return edit ? { ...card, number: edit.number } : card;
    });
}

/** Cartes du catalogue triées par le numéro persistant de l'album. */
export function catalogNumberedCards(): Card[] {
  return catalogCards().sort((a, b) =>
    (a.number ?? CARD_NUMBERS.get(a.id) ?? Number.MAX_SAFE_INTEGER)
      - (b.number ?? CARD_NUMBERS.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * Taille du catalogue jouable — la seule valeur à afficher dans un « sur N ».
 *
 * Les cartes retirées gardent leur entrée et leur numéro d'album, mais ne
 * comptent plus dans les totaux ; une suppression faite depuis l'atelier en
 * ligne doit donc faire baisser ce nombre sans redéployer. Le résultat est
 * mémoïsé par version de la couche d'édition, pour rester utilisable dans le
 * rendu d'une carte (appelé des dizaines de fois par page).
 */
let catalogSizeCache: { version: number; size: number } | null = null;

export function catalogSize(): number {
  const version = cardEditsVersion();
  if (catalogSizeCache?.version === version) return catalogSizeCache.size;
  const size = catalogCards().length;
  catalogSizeCache = { version, size };
  return size;
}

export function getCard(id: string): Card | undefined {
  // Une carte retirée depuis l'atelier en ligne n'existe plus pour le site.
  if (isHiddenCard(id)) return undefined;
  const card = CARDS_BY_ID.get(id);
  if (card) return applyCardEdit(card);
  const published = publishedCards().find((entry) => entry.id === id);
  return published ? applyPublishedCardEdit(published) : undefined;
}

export function getCardNumber(id: string): number | undefined {
  return CARD_NUMBERS.get(id) ?? publishedCards().find((card) => card.id === id)?.number;
}

export function getUniverseLabel(key: UniverseKey | string): string {
  return UNIVERSES[key as UniverseKey]?.label ?? key;
}

export function getCardGradient(card: Card): { from: string; to: string } {
  const universe = UNIVERSES[card.universe];
  if (universe) return { from: universe.from, to: universe.to };
  const hue = [...String(card.universe)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 0);
  return { from: `hsl(${hue} 55% 28%)`, to: `hsl(${(hue + 42) % 360} 55% 12%)` };
}
