"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { translate } from "@/lib/locale-translations";

export function LanguageSwitcher({ locale }: { locale: "fr" | "en" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nextLocale = locale === "fr" ? "en" : "fr";

  function switchLocale() {
    document.cookie = `tcvg-locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={pending}
      aria-label={translate(locale === "fr" ? "Passer en anglais" : "Passer en français", locale)}
      title={translate(locale === "fr" ? "Passer en anglais" : "Passer en français", locale)}
      className="chip min-w-12 py-1 text-[11px] font-semibold text-white/75 transition hover:border-cyan/40 hover:text-cyan disabled:opacity-50"
    >
      {pending ? "…" : locale === "fr" ? "EN" : "FR"}
    </button>
  );
}
