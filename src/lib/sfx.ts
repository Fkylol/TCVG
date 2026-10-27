"use client";

import { useSyncExternalStore } from "react";
import type { Rarity } from "@/lib/cards";

/**
 * Sons de la révélation, synthétisés à la volée en Web Audio.
 *
 * Aucun fichier audio n'est servi : tout est fabriqué avec des oscillateurs et
 * un buffer de bruit, ce qui évite d'ajouter des centaines de kilo-octets au
 * chargement et de dépendre d'un format supporté partout. Le contexte audio
 * n'est créé qu'au premier son, c'est-à-dire après un geste du joueur (le clic
 * sur « Déchirer ») : les navigateurs bloquent l'audio lancé avant.
 *
 * Le réglage « son » est mémorisé dans le navigateur ; coupé, plus aucun son ni
 * vibration n'est produit, et le contexte n'est même pas créé.
 */

const STORAGE_KEY = "tcvg:son";

/** Volume général : les sons ponctuels sont déjà dosés en dessous. */
const MASTER_GAIN = 0.5;

/** Réglage sonore d'une carte tirée, par rareté. */
export type RaritySound = {
  /** Fondamentale de l'arpège, en hertz. */
  root: number;
  /** Notes de l'arpège, en demi-tons au-dessus de la fondamentale. */
  degrees: number[];
  /** Gain du carillon. */
  gain: number;
  /** Part de souffle, plus présente sur les hautes raretés. */
  air: number;
};

/**
 * Plus la carte est rare, plus l'arpège est long, aigu et fort : une Commune
 * fait « toc », un Mythique fait une montée de six notes avec un grave tenu.
 */
const RARITY_SOUND: Record<Rarity, RaritySound> = {
  C: { root: 523.25, degrees: [0], gain: 0.13, air: 0 },
  UC: { root: 523.25, degrees: [0, 4], gain: 0.14, air: 0.04 },
  R: { root: 587.33, degrees: [0, 4, 7], gain: 0.15, air: 0.07 },
  SR: { root: 659.25, degrees: [0, 3, 7, 12], gain: 0.16, air: 0.1 },
  UR: { root: 659.25, degrees: [0, 4, 7, 12, 16], gain: 0.17, air: 0.13 },
  L: { root: 783.99, degrees: [0, 4, 7, 12, 16, 19], gain: 0.18, air: 0.16 },
};

/** Réglage sonore d'une rareté (les mauvaises clés retombent sur Commune). */
export function raritySound(rarity: Rarity): RaritySound {
  return RARITY_SOUND[rarity] ?? RARITY_SOUND.C;
}

/** Fréquence d'un demi-ton au-dessus (ou en dessous) d'une fondamentale. */
export function semitone(root: number, degrees: number): number {
  return root * 2 ** (degrees / 12);
}

/* ————— Le contexte audio, créé au premier geste ————— */

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
};

let engine: Engine | null = null;
let unsupported = false;

/** Bruit blanc court, réutilisé par tous les souffles (déchirure, air). */
function makeNoise(ctx: AudioContext): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

/** Contexte prêt à jouer, ou null si le navigateur n'a pas de Web Audio. */
function boot(): Engine | null {
  if (engine) {
    if (engine.ctx.state === "suspended") void engine.ctx.resume().catch(() => {});
    return engine;
  }
  if (unsupported || typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    unsupported = true;
    return null;
  }
  try {
    const ctx = new Ctor();
    // Compresseur sur la sortie : la déchirure au doigt superpose des dizaines
    // de souffles, et sans lui l'ouverture sature sur haut-parleur de téléphone.
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(compressor);
    engine = { ctx, master, noise: makeNoise(ctx) };
    // Le contexte peut naître suspendu même après un geste (Safari).
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return engine;
  } catch {
    // Audio refusé (permissions, mémoire) : le jeu reste jouable en silence.
    unsupported = true;
    return null;
  }
}

/* ————— Briques de synthèse ————— */

type ToneOptions = {
  /** Décalage en secondes depuis maintenant. */
  at?: number;
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Glissando exponentiel vers cette fréquence. */
  glide?: number;
};

/** Une note : attaque très courte, extinction douce. */
function tone(engine: Engine, { at = 0, freq, dur, type = "sine", gain = 0.12, glide }: ToneOptions) {
  const start = engine.ctx.currentTime + at;
  const osc = engine.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(glide, 1), start + dur);
  const envelope = engine.ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(envelope);
  envelope.connect(engine.master);
  osc.start(start);
  osc.stop(start + dur + 0.04);
}

type AirOptions = {
  at?: number;
  dur: number;
  gain?: number;
  /** Bande passante au début, puis à la fin : c'est le balayage qui « souffle ». */
  from: number;
  to: number;
  q?: number;
};

/** Un souffle filtré : déchirure du papier, montée de l'aura, impact. */
function air(engine: Engine, { at = 0, dur, gain = 0.2, from, to, q = 0.9 }: AirOptions) {
  const start = engine.ctx.currentTime + at;
  const source = engine.ctx.createBufferSource();
  source.buffer = engine.noise;
  const filter = engine.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.max(from, 40), start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(to, 40), start + dur);
  const envelope = engine.ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + Math.min(0.03, dur / 3));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(engine.master);
  source.start(start);
  source.stop(start + dur + 0.05);
}

/* ————— Le réglage son, partagé entre composants ————— */

let soundOnCache: boolean | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Son activé ? La valeur est lue une fois puis gardée en mémoire. */
export function readSoundOn(): boolean {
  if (soundOnCache !== null) return soundOnCache;
  if (typeof window === "undefined") return true;
  try {
    soundOnCache = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    // Navigation privée : pas de stockage, on garde le son par défaut.
    soundOnCache = true;
  }
  return soundOnCache;
}

/** Active ou coupe le son, et mémorise le choix dans le navigateur. */
export function setSoundOn(on: boolean) {
  soundOnCache = on;
  // Couper le son pendant une déchirure doit l'éteindre tout de suite : la
  // boucle de bruit tournerait sinon jusqu'au prochain geste.
  if (!on) stopRip();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch {
      // Stockage indisponible : le réglage ne survivra pas au rechargement.
    }
  }
  notify();
}

/** Réglage son, réactif : la bascule et la révélation lisent la même valeur. */
export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readSoundOn,
    () => true,
  );
}

/* ————— La déchirure au doigt ————— */

type Rip = {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  timer: number;
};

let ripLoop: Rip | null = null;

/**
 * Craquement continu de la soudure, piloté par la vitesse du doigt.
 *
 * Le bruit blanc tourne en boucle dans un filtre passe-bande dont la fréquence
 * saute à chaque déplacement : c'est ce grain irrégulier qui fait « papier »
 * plutôt que « souffle ». `intensity` (0–1) suit le geste ; le son s'éteint
 * seul 90 ms après le dernier appel, donc un doigt immobile ne bruite pas.
 */
export function rip(intensity: number) {
  if (!readSoundOn()) return;
  const ready = boot();
  if (!ready || typeof window === "undefined") return;

  if (!ripLoop) {
    const source = ready.ctx.createBufferSource();
    source.buffer = ready.noise;
    source.loop = true;
    const filter = ready.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.value = 3000;
    const gain = ready.ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ready.master);
    source.start();
    ripLoop = { source, filter, gain, timer: 0 };
  }

  const now = ready.ctx.currentTime;
  // Le gain suit le geste, avec une légère variance : deux passages du doigt
  // ne sonnent jamais exactement pareil.
  ripLoop.gain.gain.setTargetAtTime(
    Math.min(0.5, Math.max(0, intensity) * 30) * (0.6 + Math.random() * 0.8),
    now,
    0.015,
  );
  ripLoop.filter.frequency.setValueAtTime(2000 + Math.random() * 4500, now);
  window.clearTimeout(ripLoop.timer);
  ripLoop.timer = window.setTimeout(stopRip, 90);
}

/** Coupe la déchirure en cours (geste relâché, son coupé, pack ouvert). */
export function stopRip() {
  if (!ripLoop) return;
  const current = ripLoop;
  ripLoop = null;
  if (typeof window !== "undefined") window.clearTimeout(current.timer);
  if (!engine) return;
  const now = engine.ctx.currentTime;
  current.gain.gain.setTargetAtTime(0, now, 0.03);
  try {
    current.source.stop(now + 0.2);
  } catch {
    // Source déjà arrêtée : sans conséquence.
  }
}

/* ————— Les sons de l'ouverture ————— */

/** Déchirure du sachet : craquement de papier, puis un grave qui retombe. */
function tear() {
  if (!readSoundOn()) return;
  const ready = boot();
  if (!ready) return;
  air(ready, { dur: 0.34, gain: 0.34, from: 1500, to: 4400, q: 0.7 });
  air(ready, { at: 0.06, dur: 0.2, gain: 0.2, from: 2800, to: 6800, q: 0.8 });
  tone(ready, { freq: 118, dur: 0.24, gain: 0.16, type: "sine", glide: 46 });
}

/** Aura : montée qui trahit la meilleure rareté du tirage. */
function aura(rarity: Rarity) {
  if (!readSoundOn()) return;
  const ready = boot();
  if (!ready) return;
  const preset = raritySound(rarity);
  const heat = preset.degrees.length;
  air(ready, { dur: 0.62, gain: 0.1 + heat * 0.015, from: 380, to: 2600 + heat * 220, q: 1.4 });
  tone(ready, {
    freq: preset.root / 4,
    dur: 0.6,
    gain: 0.1 + heat * 0.01,
    type: "triangle",
    glide: preset.root,
  });
  if (rarity === "UR" || rarity === "L") {
    // Scintillement : deux notes aiguës qui se répondent.
    tone(ready, { at: 0.24, freq: semitone(preset.root, 24), dur: 0.4, gain: 0.05 });
    tone(ready, { at: 0.36, freq: semitone(preset.root, 31), dur: 0.42, gain: 0.045 });
  }
}

/**
 * Le pack cède : souffle qui monte, impact grave, pluie d'éclats.
 *
 * C'est le son le plus fort de l'ouverture, et le seul à durer : la traîne
 * couvre l'arrivée des cartes, pour que le silence ne retombe pas entre la
 * déchirure et le premier retournement.
 */
function open(rarity: Rarity) {
  if (!readSoundOn()) return;
  stopRip();
  const ready = boot();
  if (!ready) return;
  const hot = rarity === "L" || rarity === "UR";

  air(ready, { dur: 0.45, gain: 0.34, from: 500, to: 5200, q: 0.8 });
  tone(ready, { freq: 150, dur: 0.26, gain: 0.34, type: "sine", glide: 40 });
  tone(ready, { at: 0.02, freq: 74, dur: 0.5, gain: 0.18, type: "triangle" });

  // Éclats : des notes très aiguës, désaccordées, qui tombent en pluie.
  const sparkles = hot ? 12 : 6;
  for (let index = 0; index < sparkles; index += 1) {
    tone(ready, {
      at: 0.05 + Math.random() * 0.5,
      freq: 2200 + Math.random() * 3000,
      dur: 0.25,
      gain: 0.045,
      type: "sine",
    });
  }

  // Craquements du plastique qui se détend.
  for (let index = 0; index < 5; index += 1) {
    air(ready, {
      at: 0.3 + index * 0.09,
      dur: 0.14,
      gain: 0.12,
      from: 800,
      to: 2600,
      q: 1.2,
    });
  }

  air(ready, { at: 1.35, dur: 0.5, gain: 0.14, from: 1800, to: 300, q: 0.7 });
}

/**
 * Retournement d'une carte : froissement bref puis l'arpège de sa rareté.
 * `holo` ajoute une note cristalline au-dessus de l'accord.
 */
function card(rarity: Rarity, options: { holo?: boolean } = {}) {
  if (!readSoundOn()) return;
  const ready = boot();
  if (!ready) return;
  const preset = raritySound(rarity);
  const holo = options.holo === true;

  air(ready, { dur: 0.16, gain: 0.16, from: 900, to: 3800, q: 1.4 });
  tone(ready, { at: 0.04, freq: 700, dur: 0.05, gain: 0.1, type: "square" });

  // Éclat de corde : le carton claque avant que les notes ne montent.
  air(ready, { dur: 0.09, gain: 0.1 + preset.air, from: 2400, to: 5400, q: 1.1 });

  preset.degrees.forEach((degree, position) => {
    const at = 0.02 + position * 0.072;
    const freq = semitone(preset.root, degree);
    tone(ready, { at, freq, dur: 0.5, gain: preset.gain, type: "sine" });
    tone(ready, { at, freq: freq * 2, dur: 0.28, gain: preset.gain * 0.22, type: "sine" });
  });

  if (rarity === "UR" || rarity === "L") {
    // Grave tenu sous l'arpège : la carte « pèse ».
    tone(ready, { freq: preset.root / 2, dur: 1.2, gain: 0.09, type: "triangle" });
  }

  if (holo) {
    tone(ready, { at: 0.12, freq: semitone(preset.root, 28), dur: 0.5, gain: 0.06 });
  }
}

/** Récapitulatif : accord doux, plus discret que le tirage lui-même. */
function recap() {
  if (!readSoundOn()) return;
  const ready = boot();
  if (!ready) return;
  [0, 4, 7, 12].forEach((degree, position) => {
    tone(ready, {
      at: position * 0.085,
      freq: semitone(523.25, degree),
      dur: 0.62,
      gain: 0.075,
      type: "triangle",
    });
  });
}

/** Vibration courte, calée sur la rareté ; sans effet sur les appareils qui n'en ont pas. */
export function haptic(rarity: Rarity) {
  if (!readSoundOn()) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const pattern = rarity === "L" ? [14, 28, 22, 34, 30] : rarity === "UR" || rarity === "SR" ? [14, 26, 20] : 12;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration refusée : sans conséquence.
  }
}

export const sfx = { tear, aura, open, card, recap, rip, stopRip };
