import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PackLab } from "@/app/dev/packs/pack-lab";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Laboratoire packs — TCVG",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Planche de contrôle : les douze posters, sans tirage ni écriture en base. */
export default async function PackLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) notFound();

  return (
    <article>
      <span className="eyebrow">Atelier</span>
      <h1 className="display mt-2 text-4xl">Laboratoire packs</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Les douze posters côte à côte, dans l&apos;ordre de la page Boosters. Au repos, chacun
        garde son inclinaison ; au survol ou au focus clavier, il se redresse et se soulève,
        sans aucun reflet qui suive le pointeur. Le sélecteur de fond vérifie la lisibilité en
        clair et en sombre.
      </p>

      <PackLab />
    </article>
  );
}
