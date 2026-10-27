import { headers } from "next/headers";

/**
 * Origine publique de la requête, pour les retours OAuth.
 *
 * Sur Cloudflare, `x-forwarded-proto` n'est pas toujours présent : retomber sur
 * `http` construisait `http://tcvg.fun`, une adresse absente de la liste
 * blanche Supabase. Celle-ci renvoyait alors le joueur vers sa « Site URL »
 * (localhost) après Discord, et la connexion semblait impossible. On suppose
 * donc HTTPS partout, sauf sur une machine locale.
 */
export async function currentOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL;

  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const proto = headerList.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
