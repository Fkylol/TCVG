import net from "node:net";

import { get } from "../../../../scripts/images/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Plafond du relais : au-delà, l'image n'est pas une vignette de carte. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Le relais ne sert que des images publiques.
 *
 * L'atelier tourne en local : sans ce filtre, la route serait un proxy ouvert
 * capable d'atteindre le réseau interne (métadonnées de cloud, imprimante…).
 * On refuse donc les adresses littérales privées, la boucle locale et les noms
 * internes.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa")) return true;

  const family = net.isIP(host);
  if (family === 6) {
    return (
      host === "::1" ||
      host === "::" ||
      host.startsWith("fe80") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("::ffff:127.")
    );
  }
  if (family === 4) {
    const [a, b] = host.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return false;
}

/**
 * Relais d'affichage des visuels de l'atelier.
 *
 * Le CDN de Fandom (et d'autres hébergeurs) répond 403 sans le `Referer` du
 * site ; le navigateur local n'envoie pas celui qu'attend l'hébergeur. Cette
 * route relit l'image côté serveur, avec les en-têtes du site, et la renvoie
 * telle quelle : l'aperçu montre exactement ce que la vérification a validé.
 *
 * Réservée au développement, et à aucune écriture : rien n'est conservé, seule
 * la réponse transite.
 */
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response("Introuvable", { status: 404 });
  }

  const raw = new URL(request.url).searchParams.get("u") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("URL invalide", { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new Response("URL invalide", { status: 400 });
  }
  if (isPrivateHost(target.hostname)) {
    return new Response("Hôte refusé", { status: 400 });
  }

  try {
    const fetched = await get(target.toString(), { maxBytes: MAX_BYTES });
    if (fetched.status !== 200 || !/^image\//i.test(fetched.contentType) || fetched.bytes.length === 0) {
      return new Response("Image indisponible", { status: 404 });
    }
    return new Response(new Uint8Array(fetched.bytes), {
      headers: {
        "Content-Type": fetched.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Image indisponible", { status: 404 });
  }
}
