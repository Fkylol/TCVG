import Link from "next/link";

import { OnlineCardForm } from "@/app/atelier/cartes/en-ligne-form";
import { atelierSession } from "@/lib/atelier-access";
import { getCardArt } from "@/lib/card-art";
import { getCard, UNIVERSES, type Card, type Rarity } from "@/lib/cards";
import { RARITY_META } from "@/lib/rarity";

type CardRow = { id: string; name: string; rarity: string; universe: string };

type EditRow = {
  card_id: string;
  name: string | null;
  rarity: string | null;
  universe: string | null;
  emoji: string | null;
  image_url: string | null;
  image_fit: string | null;
  image_position: string | null;
  image_zoom: number | null;
};

const RARITIES = ["C", "UC", "R", "SR", "UR", "L"] as const;

/**
 * Édition du catalogue depuis le site.
 *
 * Le catalogue de base vit dans le code ; cette page écrit dans
 * `public.card_edits` (nom, rareté, univers, emoji, visuel, retrait), relu à
 * chaque rendu par le site. La suppression passe par une fonction SQL qui
 * purge les copies, annonces et fiches de la carte.
 */
export async function OnlineCardEditor({
  query,
  editId,
  ok,
  error,
}: {
  query: string;
  editId: string;
  ok?: string;
  error?: string;
}) {
  const session = await atelierSession();
  const supabase = session?.supabase;

  let cards: CardRow[] = [];
  let edits = new Map<string, EditRow>();
  let failure: string | null = null;

  if (supabase) {
    const [list, overrides] = await Promise.all([
      supabase
        .from("cards")
        .select("id, name, rarity, universe")
        .ilike("name", query ? `%${query}%` : "%")
        .order("name")
        .limit(300),
      supabase
        .from("card_edits")
        .select("card_id, name, rarity, universe, emoji, image_url, image_fit, image_position, image_zoom"),
    ]);

    if (list.error) failure = list.error.message;
    cards = (list.data ?? []) as CardRow[];
    edits = new Map(((overrides.data ?? []) as EditRow[]).map((row) => [row.card_id, row]));

    // La carte demandée est relue par son identifiant. La liste est plafonnée
    // et suit la recherche : une carte ouverte depuis un résultat de recherche
    // — « Ciel » pour « Sciel », par exemple — ou depuis un signalement n'y
    // figurait plus, et la page restait sans formulaire.
    if (editId && !cards.some((row) => row.id === editId)) {
      const { data } = await supabase
        .from("cards")
        .select("id, name, rarity, universe")
        .eq("id", editId)
        .maybeSingle();
      if (data) cards = [data as CardRow, ...cards];
    }
  }

  const current = editId ? cards.find((card) => card.id === editId) : undefined;
  const edit = editId ? edits.get(editId) : undefined;

  // Aperçu : la carte du catalogue (éditions déjà appliquées), ou une carte
  // reconstituée si elle n'existe plus dans le code.
  const catalogCard = current ? getCard(current.id) : undefined;
  const previewCard: Card | null = current
    ? (catalogCard ?? {
        id: current.id,
        name: edit?.name ?? current.name,
        universe: (edit?.universe ?? current.universe) as Card["universe"],
        emoji: edit?.emoji ?? "🔹",
        rarity: (edit?.rarity ?? current.rarity) as Rarity,
      })
    : null;
  const art = current ? getCardArt(current.id) : null;

  /** Lien vers une carte : la recherche en cours est conservée, pour que la
   *  carte ouverte reste dans la liste affichée. */
  function cardHref(id: string): string {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("edit", id);
    return `/atelier/cartes?${params.toString()}`;
  }

  return (
    <article className="mx-auto w-full max-w-5xl">
      <span className="eyebrow">Atelier · en ligne</span>
      <h1 className="display mt-2 text-3xl sm:text-4xl">Modifier une carte</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        Les changements partent en ligne immédiatement : nom, rareté, univers, emoji et visuel
        remplacent le catalogue du code. La suppression retire la carte du jeu avec tout ce
        qu&apos;elle porte (copies, annonces, ordres, fiches).
      </p>

      {ok && (
        <p
          role="status"
          className="mt-4 border-l-2 border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
        >
          {ok === "supprimee" ? "Carte supprimée définitivement." : "Modification enregistrée."}
        </p>
      )}
      {(failure || error) && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {failure ?? (error === "confirmation" ? "Coche la confirmation avant de supprimer." : error)}
        </p>
      )}

      <form className="mt-6 flex flex-wrap items-center gap-2" action="/atelier/cartes">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Chercher une carte par nom…"
          className="w-full max-w-sm rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/85 outline-none focus:border-cyan/45 sm:w-auto"
        />
        <button type="submit" className="btn btn-outline px-3 text-xs">
          Chercher
        </button>
        <span className="font-mono text-[11px] text-white/35">{cards.length} carte(s)</span>
      </form>

      {editId && !current && !failure && (
        <p
          role="status"
          className="mt-4 border-l-2 border-amber-300/60 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
        >
          Aucune carte <span className="font-mono">{editId}</span> dans le catalogue : elle a
          peut-être été supprimée. Cherche-la par son nom, ou vérifie que la synchronisation du
          catalogue est passée.
        </p>
      )}

      {current && previewCard && (
        <section className="panel mt-6 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display text-lg text-white/90">{current.name}</h2>
            <span className="font-mono text-[11px] text-white/35">{current.id}</span>
          </div>

          {/* `key` sur l'identifiant : `?edit=` change sans changer de route, et
              React réutilise alors l'instance du composant. Sans la clé, les
              champs d'identité (non contrôlés) et le cadrage (état) gardaient
              la carte précédente : on enregistrait l'identité de l'ancienne
              carte sur la nouvelle, ce qui se brisait sur l'unicité du
              personnage. */}
          <OnlineCardForm
            key={current.id}
            card={previewCard}
            art={art}
            values={{
              name: edit?.name ?? current.name,
              rarity: edit?.rarity ?? current.rarity,
              universe: edit?.universe ?? current.universe,
              emoji: edit?.emoji ?? "",
              imageUrl: edit?.image_url ?? "",
            }}
            rarities={RARITIES.map((key) => ({
              key,
              label: `${RARITY_META[key].name} (${RARITY_META[key].letter})`,
            }))}
            universes={Object.entries(UNIVERSES).map(([key, universe]) => ({
              key,
              label: universe.label,
            }))}
          />
        </section>
      )}

      <ul className="mt-6 overflow-hidden rounded-[var(--radius)] border border-white/10 bg-[var(--panel-bg-deep)]">
        {cards.map((card) => (
          <li key={card.id} className="border-b border-white/[0.07] last:border-b-0">
            <Link
              href={cardHref(card.id)}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 hover:bg-white/[0.04]"
            >
              <span className="text-sm text-white/85">{edits.get(card.id)?.name ?? card.name}</span>
              <span className="font-mono text-[11px] text-white/35">{card.id}</span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
                {(edits.get(card.id)?.rarity ?? card.rarity) as string}
              </span>
              {card.id === editId && <span className="text-cyan">●</span>}
            </Link>
          </li>
        ))}
        {cards.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-white/40">Aucune carte trouvée.</li>
        )}
      </ul>
    </article>
  );
}
