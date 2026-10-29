import Image from "next/image";
import { CardFace } from "@/components/card-face";
import type { Card } from "@/lib/cards";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { GENRES } from "@/lib/card-genres";
import { UNIVERSES } from "@/lib/cards";
import { publishSuggestion, rejectSuggestion, saveSuggestion, generateSuggestion } from "./actions";

export const metadata = {
  title: "Suggestions de personnages — TCVG",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const RARITIES = [
  ["C", "Commune"], ["UC", "Peu commune"], ["R", "Rare"],
  ["SR", "Épique"], ["UR", "Légendaire"], ["L", "Mythique"],
] as const;

type Suggestion = {
  id: string; card_id: string; name: string; universe: string; universe_label: string | null; rarity: string;
  emoji: string; genres: string[]; tagline: string; bio: string; quote: string | null;
  power: string | null; image_url: string | null; image_source_name: string | null;
  image_source_page: string | null; image_file: string | null; image_width: number | null;
  image_height: number | null; image_credit: string | null; image_license: string | null;
  status: string; created_at: string;
};

export default async function SuggestionsPage({ searchParams }: { searchParams: Promise<{ edit?: string; ok?: string; erreur?: string; note?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireSession();
  const { data: admin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || admin !== true) notFound();

  const { data, error } = await supabase
    .from("card_suggestions")
    .select("id, card_id, name, universe, universe_label, rarity, emoji, genres, tagline, bio, quote, power, image_url, image_source_name, image_source_page, image_file, image_width, image_height, image_credit, image_license, status, created_at")
    .order("created_at", { ascending: false });
  const suggestionsUnavailable = Boolean(error);
  const suggestions = (data ?? []) as Suggestion[];
  const pending = suggestions.filter((item) => item.status === "pending");
  const selected = pending.find((item) => item.id === params.edit) ?? pending[0] ?? null;
  const universes = Object.entries(UNIVERSES).map(([slug, info]) => ({ slug, name: info.label })).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <article className="mx-auto max-w-6xl">
      <span className="eyebrow">Administration · catalogue</span>
      <h1 className="display mt-2 text-4xl">Suggestions de personnages</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55">
        Génère une fiche à partir du nom d’un personnage absent. Vérifie l’image, ajuste la fiche,
        puis publie-la immédiatement dans le catalogue et les boosters, ou rejette-la.
      </p>

      <section className="panel mt-6 p-4 sm:p-5">
        <h2 className="display text-lg">Nouvelle proposition</h2>
        <form action={generateSuggestion} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-xs text-white/55">Personnage
            <input className="field" name="newName" placeholder="Ex. Wario" required maxLength={60} />
          </label>
          <label className="grid gap-1 text-xs text-white/55">Franchise existante <span className="text-white/35">(facultatif, suggestion automatique)</span>
            <select className="field" name="newUniverse" defaultValue="">
              <option value="">Détecter depuis le personnage…</option>
              {universes.map((universe) => <option key={universe.slug} value={universe.slug}>{universe.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-white/55">Ou nouvelle franchise
            <input className="field" name="newUniverseLabel" placeholder="Ex. Sonic the Hedgehog" maxLength={80} />
          </label>
          <button className="btn btn-primary self-end" type="submit">Générer la fiche</button>
        </form>
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">Si une franchise existante est reconnue, elle sera proposée automatiquement. Tu pourras toujours choisir une autre franchise ou en créer une nouvelle ; la franchise sera ajoutée au catalogue seulement à la publication.</p>
      </section>

      {params.erreur && <p role="alert" className="mt-4 border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{params.erreur}</p>}
      {params.ok && <p role="status" className="mt-4 border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{params.ok === "publiee" ? "Carte publiée dans le jeu." : params.ok === "refusee" ? "Proposition rejetée." : params.ok === "sauve" ? "Modifications enregistrées." : "Proposition ajoutée à la file."}</p>}
      {params.note && <p role="status" className="mt-2 border border-cyan/20 bg-cyan/5 p-3 text-sm text-cyan/80">{params.note}</p>}
      {suggestionsUnavailable && (
        <p role="alert" className="mt-4 border border-amber-300/20 bg-amber-400/5 p-3 text-sm leading-relaxed text-amber-100/80">
          La file des suggestions n’est pas accessible. Vérifie que la migration
          <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5 font-mono text-xs">065_suggestions_personnages.sql</code>
          a été appliquée à la base et que l’accès admin est configuré ; la page reste affichée, mais la file ne peut pas encore être utilisée.
        </p>
      )}

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="panel p-3">
          <h2 className="px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">À examiner · {pending.length}</h2>
          {pending.length === 0 ? <p className="p-3 text-sm text-white/40">Aucune proposition en attente.</p> : (
            <ul className="mt-2 space-y-1">
              {pending.map((item) => (
                <li key={item.id}>
                  <a href={`/admin/suggestions?edit=${encodeURIComponent(item.id)}`} className={`block border p-3 transition ${selected?.id === item.id ? "border-cyan/40 bg-cyan/10" : "border-white/5 hover:bg-white/[0.04]"}`}>
                    <span className="block text-sm text-white/85">{item.name}</span>
                    <span className="mt-1 block text-[11px] text-white/40">{UNIVERSES[item.universe as keyof typeof UNIVERSES]?.label ?? item.universe} · {item.rarity}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {suggestions.some((item) => item.status !== "pending") && (
            <details className="mt-4 border-t border-white/10 pt-3">
              <summary className="cursor-pointer px-2 text-[11px] uppercase tracking-[0.14em] text-white/35">Historique</summary>
              <ul className="mt-2 space-y-1">{suggestions.filter((item) => item.status !== "pending").map((item) => <li key={item.id} className="flex justify-between gap-2 px-2 py-1 text-xs text-white/40"><span>{item.name}</span><span>{item.status === "published" ? "publiée" : "rejetée"}</span></li>)}</ul>
            </details>
          )}
        </aside>

        {selected ? <SuggestionEditor key={selected.id} suggestion={selected} /> : (
          <div className="panel grid min-h-64 place-items-center p-8 text-sm text-white/40">Génère une proposition pour commencer.</div>
        )}
      </div>
    </article>
  );
}

function SuggestionEditor({ suggestion }: { suggestion: Suggestion }) {
  const universeLabel = UNIVERSES[suggestion.universe as keyof typeof UNIVERSES]?.label ?? suggestion.universe;
  const previewCard = previewCardFromSuggestion(suggestion);
  return (
    <section className="panel min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><span className="eyebrow">À valider ou modifier</span><h2 className="display mt-1 text-2xl">{suggestion.name}</h2></div>
        <span className="chip px-2 py-1 text-[11px] text-white/50">{universeLabel}</span>
      </div>

      {suggestion.image_url ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 border border-white/10 bg-black/20 p-3">
          <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded bg-white/5">
            <Image src={suggestion.image_url} alt={`Visuel proposé de ${suggestion.name}`} fill unoptimized sizes="112px" className="object-contain" />
          </div>
          <div className="min-w-0 text-xs leading-relaxed text-white/50">
            <p className="text-sm text-white/80">{suggestion.image_file ?? "Portrait externe"}</p>
            <p>{suggestion.image_width} × {suggestion.image_height} · {suggestion.image_source_name ?? "source non précisée"}</p>
            {suggestion.image_license && <p>Licence : {suggestion.image_license}</p>}
            {suggestion.image_credit && <p>Crédit : {suggestion.image_credit}</p>}
            {suggestion.image_source_page && <a href={suggestion.image_source_page} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-cyan underline">Ouvrir la source du visuel</a>}
          </div>
        </div>
      ) : <p className="mt-4 border border-amber-300/20 bg-amber-400/5 p-3 text-xs text-amber-100/80">Aucun portrait trouvé ; la carte utilisera son emoji. Tu peux coller une URL d’image vérifiée dans le champ ci-dessous.</p>}

      <div className="mt-4 flex flex-wrap items-center gap-4 border border-white/10 bg-black/20 p-4">
        <div className="w-36 shrink-0">
          <CardFace
            card={previewCard}
            size="sm"
            art={suggestion.image_url ? {
              src: suggestion.image_url,
              local: false,
              framing: { objectFit: "contain", objectPosition: "50% 50%" },
            } : null}
          />
        </div>
        <div className="text-sm text-white/60">
          <p className="font-display text-lg text-white/85">Aperçu de carte</p>
          <p className="mt-1">{suggestion.name} · {suggestion.rarity}</p>
          <p>{universeLabel} · {suggestion.emoji}</p>
        </div>
      </div>

      <form id="suggestion-edit" action={saveSuggestion} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="suggestionId" value={suggestion.id} />
        <Field label="Nom"><input className="field" name="name" required maxLength={60} defaultValue={suggestion.name} /></Field>
        <Field label="Identifiant"><input className="field" name="card_id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={suggestion.card_id} /></Field>
        <Field label="Franchise"><select className="field" name="universe" defaultValue={suggestion.universe}>{Object.entries(UNIVERSES).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}<option value="__custom__">Nouvelle franchise…</option></select></Field>
        <Field label="Nom de la nouvelle franchise"><input className="field" name="universeLabel" maxLength={80} defaultValue={suggestion.universe_label ?? ""} placeholder="Utilisé si « Nouvelle franchise » est choisie" /></Field>
        <Field label="Rareté"><select className="field" name="rarity" defaultValue={suggestion.rarity}>{RARITIES.map(([key, label]) => <option key={key} value={key}>{label} · {key}</option>)}</select></Field>
        <Field label="Emoji de secours"><input className="field" name="emoji" required maxLength={16} defaultValue={suggestion.emoji} /></Field>
        <fieldset className="grid gap-2 sm:col-span-2"><legend className="mb-1 text-xs text-white/50">Genres de booster</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{GENRES.map((genre) => <label key={genre.slug} className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" name="genre" value={genre.slug} defaultChecked={suggestion.genres.includes(genre.slug)} />{genre.name}</label>)}</div></fieldset>
        <Field label="Accroche" wide><input className="field" name="tagline" required maxLength={140} defaultValue={suggestion.tagline} /></Field>
        <Field label="Biographie complète" wide><textarea className="field min-h-28" name="bio" required maxLength={1400} defaultValue={suggestion.bio} /></Field>
        <Field label="Citation (facultatif)" wide><textarea className="field min-h-16" name="quote" maxLength={300} defaultValue={suggestion.quote ?? ""} /></Field>
        <Field label="Pouvoir (facultatif)" wide><input className="field" name="power" maxLength={240} defaultValue={suggestion.power ?? ""} /></Field>
        <Field label="URL du portrait"><input className="field" type="url" name="image_url" defaultValue={suggestion.image_url ?? ""} /></Field>
        <Field label="Source du portrait"><input className="field" name="image_source_name" defaultValue={suggestion.image_source_name ?? ""} /></Field>
        <Field label="Page source"><input className="field" type="url" name="image_source_page" defaultValue={suggestion.image_source_page ?? ""} /></Field>
        <Field label="Fichier"><input className="field" name="image_file" defaultValue={suggestion.image_file ?? ""} /></Field>
        <Field label="Largeur"><input className="field" type="number" name="image_width" min="0" defaultValue={suggestion.image_width ?? 0} /></Field>
        <Field label="Hauteur"><input className="field" type="number" name="image_height" min="0" defaultValue={suggestion.image_height ?? 0} /></Field>
        <Field label="Crédit"><input className="field" name="image_credit" defaultValue={suggestion.image_credit ?? ""} /></Field>
        <Field label="Licence"><input className="field" name="image_license" defaultValue={suggestion.image_license ?? ""} /></Field>
      </form>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <button form="suggestion-edit" type="submit" className="btn btn-outline">Enregistrer les modifications</button>
        <button form="suggestion-edit" formAction={publishSuggestion} type="submit" className="btn btn-primary">Publier dans le jeu</button>
        <form action={rejectSuggestion}><input type="hidden" name="suggestionId" value={suggestion.id} /><button type="submit" className="btn btn-outline border-rose-300/20 text-rose-100 hover:bg-rose-500/10">Rejeter</button></form>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/35">La publication crée la carte dans le catalogue, les packs correspondant aux genres sélectionnés, et la fiche complète. La bio, la citation et le pouvoir restent cachés aux joueurs qui ne possèdent pas la carte.</p>
    </section>
  );
}

function previewCardFromSuggestion(suggestion: Suggestion): Card {
  return {
    id: suggestion.card_id,
    name: suggestion.name,
    universe: suggestion.universe as Card["universe"],
    rarity: suggestion.rarity as Card["rarity"],
    emoji: suggestion.emoji,
  };
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`grid gap-1 text-xs text-white/50 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}
