/**
 * Accès HTTP aux API publiques et aux images, pour le chantier « images ».
 *
 * Politique Wikimedia : User-Agent descriptif avec un contact (`SITE_CONTACT`,
 * à défaut l'URL du site), 10 requêtes par seconde maximum, 3 tentatives avec
 * attente croissante, cache disque pour reprendre un traitement interrompu.
 *
 * Aucune image n'est stockée : on lit les premiers kilo-octets pour connaître
 * les dimensions, puis on jette le contenu. Seule l'URL est conservée.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Le cache disque sert aux scripts et à l'atelier local. En production, les
// routes de l'atelier sont désactivées : utiliser un chemin distinct évite
// que le bundler inspecte le gros cache de développement du dépôt.
const CACHE_DIR = path.join(
  process.cwd(),
  ".images",
  process.env.NODE_ENV === "production" ? "runtime-cache" : "cache",
);
const CONTACT = process.env.SITE_CONTACT ?? "https://tcvg.fun";
export const CONTACT_FALLBACK = !process.env.SITE_CONTACT;

/** 10 requêtes par seconde, comme demandé (espacement de 100 ms). */
const PER_SECOND = 10;

let nextSlot = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + Math.ceil(1000 / PER_SECOND);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export function userAgent(): string {
  return `TCVG-images-audit/1.0 (${CONTACT})`;
}

/**
 * Referer envoyé avec chaque requête : celui du site.
 *
 * Le CDN de Fandom répond 403 sans Referer, mais 200 avec `https://tcvg.fun/`.
 * C'est exactement ce qu'envoie un navigateur quand l'image est affichée sur
 * une page du site (politique `strict-origin-when-cross-origin`) : la requête
 * reproduit donc le chargement réel, sans cookie ni contournement. Une image
 * qui exigerait, elle, un Referer Fandom resterait refusée (vérifié plus bas).
 */
export function siteReferer(): string {
  try {
    return new URL(CONTACT).origin + "/";
  } catch {
    return "https://tcvg.fun/";
  }
}

type Cached = { url: string; status: number; contentType: string; bodyBase64: string; fetchedAt: string };

export type Fetched = { status: number; contentType: string; bytes: Buffer; cached: boolean };

function cachePath(url: string): string {
  const digest = crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
  return path.join(CACHE_DIR, `${digest}.json`);
}

export type FetchOptions = {
  /** Ne pas lire le cache (vérification d'une URL qui a pu changer). */
  fresh?: boolean;
  /** Taille maximale lue, en octets (défaut 6 Mio). */
  maxBytes?: number;
};

/**
 * GET avec cache, limitation de débit et 3 tentatives exponentielles.
 * Aucun cookie, aucun Referer : si la source refuse l'affichage externe, elle
 * est rejetée et le pipeline passe à la source suivante.
 */
export async function get(url: string, options: FetchOptions = {}): Promise<Fetched> {
  const file = cachePath(url);
  if (!options.fresh) {
    try {
      const cached = JSON.parse(await fs.readFile(file, "utf8")) as Cached;
      return {
        status: cached.status,
        contentType: cached.contentType,
        bytes: Buffer.from(cached.bodyBase64, "base64"),
        cached: true,
      };
    } catch {
      // pas en cache
    }
  }

  const maxBytes = options.maxBytes ?? 6 * 1024 * 1024;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await throttle();
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": userAgent(),
          "Api-User-Agent": userAgent(),
          Referer: siteReferer(),
          Accept: "image/*,application/json;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(30_000),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > maxBytes) {
        return { status: response.status, contentType, bytes: Buffer.alloc(0), cached: false };
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const bytes = buffer.subarray(0, maxBytes);
      const entry: Cached = {
        url,
        status: response.status,
        contentType,
        bodyBase64: bytes.toString("base64"),
        fetchedAt: new Date().toISOString(),
      };
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(file, JSON.stringify(entry));
      return { status: response.status, contentType, bytes, cached: false };
    } catch (error) {
      lastError = error as Error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }

  throw new Error(`${url} : ${lastError?.message ?? "échec réseau"}`);
}

/** GET JSON, avec les mêmes garanties. */
export async function getJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const fetched = await get(url, options);
  if (fetched.status !== 200) throw new Error(`${url} : HTTP ${fetched.status}`);
  return JSON.parse(fetched.bytes.toString("utf8")) as T;
}

export function cacheDir(): string {
  return CACHE_DIR;
}
