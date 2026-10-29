"use client";

import { useRouter } from "next/navigation";

import { BoosterReveal } from "@/components/booster-reveal";
import { getPack } from "@/lib/packs";
import { setPendingReveal, usePendingReveal } from "@/lib/reveal-queue";

/**
 * Hôte unique de la révélation.
 *
 * L'écran d'ouverture est monté une fois pour toutes, à la racine du site :
 * l'accueil, la vitrine et la citrouille d'Halloween ouvrent le même overlay,
 * où que le joueur se trouve au moment du tirage. La révélation en attente vit
 * hors de React (`lib/reveal-queue`), donc sa fermeture et la relecture de la
 * page se décident ici, en un seul endroit.
 *
 * Le pack vient de la liste complète (`PACKS`), pas de la vitrine : un pack
 * saisonnier, absent de la boutique, se redessine donc exactement comme celui
 * qui a été déchiré.
 */
export function RevealHost() {
  const router = useRouter();
  const reveal = usePendingReveal();

  const close = () => {
    setPendingReveal(null);
    // Les stocks et l'album viennent du serveur : on les relit une fois
    // l'animation refermée, pas pendant.
    router.refresh();
  };

  // Un tirage dont aucune carte n'est reconnue ici laisserait une scène noire,
  // sans rien à révéler : cela arrive quand le catalogue en base est plus
  // récent que le site déployé (des cartes tirées que ce bundle ne connaît
  // pas). Le booster est déjà consommé : on le dit au joueur plutôt que de lui
  // montrer le vide.
  if (reveal && reveal.items.length === 0) {
    return (
      <div
        className="reveal-screen items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label="Booster ouvert"
      >
        <div className="panel panel-accent mx-4 my-auto max-w-md p-7 text-center">
          <span className="eyebrow">Booster ouvert</span>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Les cartes tirées ne sont pas encore reconnues par cette version du site : elles
            viennent d&apos;arriver au catalogue. Elles sont bien enregistrées dans ta collection et
            apparaîtront après la prochaine mise à jour.
          </p>
          <button type="button" className="btn btn-primary btn-sm mt-6" onClick={close}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (!reveal) return null;

  const pack = getPack(reveal.packId);
  const count = reveal.items.length;

  return (
    <BoosterReveal
      title={pack ? `Booster ${pack.name}` : "Booster ouvert"}
      subtitle={`${reveal.opened} booster${reveal.opened > 1 ? "s" : ""} · ${count} carte${
        count > 1 ? "s" : ""
      }`}
      items={reveal.items}
      pack={pack}
      onClose={close}
      closeLabel="Fermer"
    />
  );
}
