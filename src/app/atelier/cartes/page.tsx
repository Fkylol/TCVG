import { OnlineCardEditor } from "@/app/atelier/cartes/en-ligne";
import { loadCardAction } from "@/app/atelier/cartes/actions";
import { AtelierForm } from "@/app/atelier/cartes/atelier-form";
import { ATELIER_LOCAL } from "@/lib/atelier-access";
import { GENRES } from "@/lib/card-genres";
import { CARDS, UNIVERSES } from "@/lib/cards";

export const metadata = { title: "Atelier — ajout et correction de carte" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Atelier d'ajout de cartes, réservé au serveur de développement.
 *
 * En local, il écrit dans les fichiers de données du projet et lance la
 * synchro de la base. En ligne, il n'y a pas de disque : la page bascule sur
 * `OnlineCardEditor`, qui édite `public.card_edits` (nom, rareté, univers,
 * emoji, visuel) et supprime une carte pour de bon.
 */
export default async function AtelierPage({
  searchParams,
}: {
  /** `?edit=<id>` ouvre directement la carte à corriger (lien d'un signalement). */
  searchParams: Promise<{
    edit?: string | string[];
    q?: string | string[];
    ok?: string | string[];
    erreur?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : "";

  // En ligne, l'éditeur de fichiers ne peut pas tourner (pas de disque) :
  // l'atelier écrit alors dans `public.card_edits`, relu à chaque rendu.
  if (!ATELIER_LOCAL) {
    return (
      <OnlineCardEditor
        query={typeof params.q === "string" ? params.q : ""}
        editId={editId}
        ok={typeof params.ok === "string" ? params.ok : undefined}
        error={typeof params.erreur === "string" ? params.erreur : undefined}
      />
    );
  }
  // Carte visée par un signalement : elle arrive déjà chargée dans le formulaire.
  const loaded = editId ? await loadCardAction({ id: editId }) : null;
  const initialCard = loaded?.ok ? loaded.draft : null;
  const initialCandidates = loaded?.ok ? loaded.candidates : [];

  const counts = new Map<string, number>();
  for (const card of CARDS) counts.set(card.universe, (counts.get(card.universe) ?? 0) + 1);

  const universes = Object.entries(UNIVERSES)
    .map(([slug, universe]) => ({ slug, label: universe.label, count: counts.get(slug) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  // Catalogue complet, pour ouvrir une carte existante à corriger.
  const cards = CARDS.map((card) => ({ id: card.id, name: card.name, universe: card.universe })).sort(
    (a, b) => a.name.localeCompare(b.name, "fr"),
  );

  return (
    <article className="mx-auto w-full max-w-6xl">
      <span className="eyebrow">Atelier · local</span>
      <h1 className="display mt-2 text-4xl">Ajouter ou modifier une carte</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Donne une franchise et un nom : l&apos;atelier cherche les visuels sur le wiki de la
        franchise et sur Wikipédia, rédige une fiche à partir de la page, estime la rareté avec
        la méthode du jeu et reprend les genres de la franchise. Un visuel trouvé ailleurs (une
        recherche d&apos;images, par exemple) peut être collé : il est vérifié puis retenu. Tu
        corriges, tu valides, et la carte rejoint le catalogue puis la base. Choisis une carte
        existante pour réécrire sa fiche ou son visuel sans la dupliquer.
      </p>

      <AtelierForm
        universes={universes}
        genres={GENRES}
        cards={cards}
        total={CARDS.length}
        initialCard={initialCard}
        initialCandidates={initialCandidates}
      />
    </article>
  );
}
