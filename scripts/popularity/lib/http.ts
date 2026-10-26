/**
 * Accès HTTP aux API Wikimedia, avec cache disque, limitation de débit et
 * reprise après interruption.
 *
 * Politique Wikimedia : User-Agent descriptif avec un contact, au plus 20
 * requêtes par seconde, attente exponentielle après un 429 ou une erreur,
 * 3 tentatives par requête.
 *
 * Le cache rend le pipeline reprenable : une requête déjà faite n'est pas
 * refaite. Effacer `.popularity/cache/` force un nouveau passage complet.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".popularity", "cache");

/** Contact déclaré dans le User-Agent. À défaut, l'URL du site (signalé au rapport). */
const CONTACT = process.env.WIKI_CONTACT ?? "https://tcvg.fun";
export const CONTACT_FALLBACK = !process.env.WIKI_CONTACT;

export function userAgent(): string {
  return `TCVG-rarity-audit/1.0 (${CONTACT})`;
}

type Bucket = { limit: number; delayMs: number; next: number };
const buckets = new Map<string, Bucket>();

function bucket(name: string, perSecond: number): Bucket {
  const current = buckets.get(name);
  if (current) return current;
  const created = { limit: perSecond, delayMs: Math.ceil(1000 / perSecond), next: 0 };
  buckets.set(name, created);
  return created;
}

/** Espacement simple : 20 req/s sur les API, 2 req/s sur SPARQL. */
async function throttle(name: string, perSecond: number): Promise<void> {
  const target = bucket(name, perSecond);
  const now = Date.now();
  const wait = Math.max(0, target.next - now);
  target.next = Math.max(now, target.next) + target.delayMs;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

function cachePath(url: string): string {
  const digest = crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
  return path.join(CACHE_DIR, `${digest}.json`);
}

type Cached = { url: string; status: number; body: string; fetchedAt: string; attempts: number };

export type HttpResult = { status: number; body: string; cached: boolean };

/** Compteurs de session, pour le récapitulatif des scripts. */
export const netStats = { requests: 0, cached: 0, retries: 0, failures: 0 };

export type FetchOptions = {
  /** Nom du seau de débit (« api », « rest », « sparql »). */
  bucket?: string;
  /** Requêtes par seconde autorisées pour ce seau. */
  perSecond?: number;
  /** 404 n'est pas une erreur : l'absence de données est fréquente. */
  acceptStatus?: number[];
  /** Ne pas écrire dans le cache (utile pour un test ponctuel). */
  noCache?: boolean;
};

/**
 * GET avec cache, limitation de débit et 3 tentatives exponentielles.
 * Un 404 sur les pages vues signifie « pas de données », pas un échec.
 */
export async function wikiGet(url: string, options: FetchOptions = {}): Promise<HttpResult> {
  const cacheFile = cachePath(url);
  if (!options.noCache) {
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, "utf8")) as Cached;
      netStats.cached += 1;
      return { status: cached.status, body: cached.body, cached: true };
    } catch {
      // pas encore en cache
    }
  }

  const name = options.bucket ?? "api";
  const perSecond = options.perSecond ?? 20;
  const accept = new Set([200, ...(options.acceptStatus ?? [])]);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await throttle(name, perSecond);
    netStats.requests += 1;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent(), "Api-User-Agent": userAgent(), Accept: "application/json" },
        signal: AbortSignal.timeout(60_000),
      });
      const body = await response.text();

      if (response.ok || accept.has(response.status)) {
        const entry: Cached = {
          url,
          status: response.status,
          body,
          fetchedAt: new Date().toISOString(),
          attempts: attempt,
        };
        if (!options.noCache) {
          await fs.mkdir(CACHE_DIR, { recursive: true });
          await fs.writeFile(cacheFile, JSON.stringify(entry), "utf8");
        }
        return { status: response.status, body, cached: false };
      }

      if (response.status === 429 || response.status >= 500) {
        netStats.retries += 1;
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        const wait = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500 + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      // 4xx définitif : on le renvoie tel quel, l'appelant décide.
      return { status: response.status, body, cached: false };
    } catch (error) {
      netStats.retries += 1;
      if (attempt === 3) {
        netStats.failures += 1;
        throw new Error(`${(error as Error).message} — ${url}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500 + Math.random() * 250));
    }
  }

  netStats.failures += 1;
  throw new Error(`3 tentatives échouées — ${url}`);
}

export async function wikiJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const result = await wikiGet(url, options);
  if (result.status !== 200) throw new Error(`HTTP ${result.status} — ${url}`);
  return JSON.parse(result.body) as T;
}

/** Récapitulatif réseau, affiché en fin de script. */
export function netSummary(): string {
  return `${netStats.requests} requêtes (${netStats.cached} en cache, ${netStats.retries} reprises, ${netStats.failures} échecs)`;
}
