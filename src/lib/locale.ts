import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/locale-translations";

export { isLocale, LOCALES, LOCALE_COOKIE, translate } from "@/lib/locale-translations";
export type { Locale } from "@/lib/locale-translations";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "fr";
}
