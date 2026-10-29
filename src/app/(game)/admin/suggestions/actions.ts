"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { prepareAction } from "@/app/atelier/cartes/actions";
import { detectUniverse } from "@/lib/atelier-search";
import { slugify } from "@/lib/atelier-core";
import { cardStats } from "@/lib/stats";
import type { Card } from "@/lib/cards";
import { CARDS, UNIVERSES } from "@/lib/cards";

export type SuggestionDraft = {
  id: string;
  card_id: string;
  name: string;
  universe: string;
  universe_label?: string;
  rarity: string;
  emoji: string;
  genres: string[];
  tagline: string;
  bio: string;
  quote: string;
  power: string;
  image_url: string;
  image_source_name: string;
  image_source_page: string;
  image_file: string;
  image_width: number;
  image_height: number;
  image_credit: string;
  image_license: string;
  quality: number;
};

async function adminSession() {
  const session = await requireSession();
  const { data, error } = await session.supabase.rpc("is_admin");
  if (error || data !== true) notFound();
  return session;
}

function readCard(formData: FormData, id: string): SuggestionDraft {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const genres = formData.getAll("genre").map(String).filter(Boolean);
  return {
    id,
    card_id: text("card_id"),
    name: text("name"),
    universe: text("universe").toLowerCase(),
    universe_label: text("universe").toLowerCase() === "__custom__" ? text("universeLabel") : "",
    rarity: text("rarity"),
    emoji: text("emoji"),
    genres,
    tagline: text("tagline"),
    bio: text("bio"),
    quote: text("quote"),
    power: text("power"),
    image_url: text("image_url"),
    image_source_name: text("image_source_name"),
    image_source_page: text("image_source_page"),
    image_file: text("image_file"),
    image_width: Number(text("image_width")) || 0,
    image_height: Number(text("image_height")) || 0,
    image_credit: text("image_credit"),
    image_license: text("image_license"),
    quality: 0,
  };
}

function validateSuggestion(card: SuggestionDraft): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.card_id)) return "Identifiant invalide.";
  if (!card.name || card.name.length > 60 || !card.universe || !(Object.hasOwn(UNIVERSES, card.universe) || (card.universe_label && card.universe === slugify(card.universe_label)))) return "Nom ou franchise invalide.";
  if (!(["C", "UC", "R", "SR", "UR", "L"] as string[]).includes(card.rarity)) return "Rareté invalide.";
  if (!card.emoji || !card.tagline || !card.bio || card.genres.length === 0) return "Emoji, accroche, biographie et au moins un genre sont obligatoires.";
  if (card.image_url && (!/^https?:\/\//i.test(card.image_url) || card.image_width <= 0 || card.image_height <= 0)) return "URL ou dimensions du portrait invalides.";
  return null;
}

async function persist(supabase: Awaited<ReturnType<typeof adminSession>>["supabase"], card: SuggestionDraft) {
  const { error } = await supabase.rpc("admin_save_card_suggestion", { p_id: card.id, p_card: card });
  return error;
}

export async function saveSuggestion(formData: FormData) {
  const { supabase } = await adminSession();
  const id = String(formData.get("suggestionId") ?? "").trim();
  if (!id) redirect("/admin/suggestions?erreur=id");
  const card = readCard(formData, id);
  if (card.universe === "__custom__") {
    card.universe = slugify(card.universe_label ?? "");
    card.universe_label = card.universe_label?.replace(/\s+/g, " ").trim() ?? "";
  } else {
    card.universe_label = Object.hasOwn(UNIVERSES, card.universe)
      ? UNIVERSES[card.universe as keyof typeof UNIVERSES].label
      : "";
  }
  const validation = validateSuggestion(card);
  if (validation) redirect(`/admin/suggestions?edit=${encodeURIComponent(id)}&erreur=${encodeURIComponent(validation)}`);
  const error = await persist(supabase, card);
  revalidatePath("/admin/suggestions");
  if (error) redirect(`/admin/suggestions?edit=${encodeURIComponent(id)}&erreur=${encodeURIComponent(error.message)}`);
  redirect(`/admin/suggestions?edit=${encodeURIComponent(id)}&ok=sauve`);
}

export async function publishSuggestion(formData: FormData) {
  const { supabase } = await adminSession();
  const id = String(formData.get("suggestionId") ?? "").trim();
  if (!id) redirect("/admin/suggestions?erreur=id");
  const card = readCard(formData, id);
  if (card.universe === "__custom__") {
    card.universe = slugify(card.universe_label ?? "");
    card.universe_label = card.universe_label?.replace(/\s+/g, " ").trim() ?? "";
  } else {
    card.universe_label = Object.hasOwn(UNIVERSES, card.universe)
      ? UNIVERSES[card.universe as keyof typeof UNIVERSES].label
      : "";
  }
  const validation = validateSuggestion(card);
  if (validation) redirect(`/admin/suggestions?edit=${encodeURIComponent(id)}&erreur=${encodeURIComponent(validation)}`);
  card.quality = cardStats({ id: card.card_id, name: card.name, universe: card.universe as Card["universe"],
    emoji: card.emoji, rarity: card.rarity as Card["rarity"] }).quality;
  const error = await persist(supabase, card);
  if (error) redirect(`/admin/suggestions?edit=${encodeURIComponent(id)}&erreur=${encodeURIComponent(error.message)}`);
  const { data, error: publishError } = await supabase.rpc("admin_publish_card_suggestion", {
    p_id: id,
    p_card: card,
  });
  if (publishError) redirect(`/admin/suggestions?edit=${encodeURIComponent(id)}&erreur=${encodeURIComponent(publishError.message)}`);
  revalidatePath("/", "layout");
  revalidatePath("/collection");
  revalidatePath("/boosters");
  revalidatePath(`/card/${String(data)}`);
  redirect("/admin/suggestions?ok=publiee");
}

export async function rejectSuggestion(formData: FormData) {
  const { supabase } = await adminSession();
  const id = String(formData.get("suggestionId") ?? "").trim();
  if (!id) redirect("/admin/suggestions?erreur=id");
  const { error } = await supabase.rpc("admin_reject_card_suggestion", { p_id: id });
  revalidatePath("/admin/suggestions");
  if (error) redirect(`/admin/suggestions?erreur=${encodeURIComponent(error.message)}`);
  redirect("/admin/suggestions?ok=refusee");
}

export async function generateSuggestion(formData: FormData) {
  await adminSession();
  const name = String(formData.get("newName") ?? "").trim();
  const chosenUniverse = String(formData.get("newUniverse") ?? "").trim();
  const newUniverseLabel = String(formData.get("newUniverseLabel") ?? "").trim().replace(/\s+/g, " ");
  if (!name || (chosenUniverse && newUniverseLabel)) {
    redirect(`/admin/suggestions?erreur=${encodeURIComponent("Indique un personnage et choisis une franchise existante ou un nouveau nom de franchise, pas les deux.")}`);
  }

  let universe = chosenUniverse;
  let universeLabel = Object.hasOwn(UNIVERSES, chosenUniverse)
    ? UNIVERSES[chosenUniverse as keyof typeof UNIVERSES].label
    : "";
  let suggestionNote = "";

  if (!universe && newUniverseLabel) {
    if (newUniverseLabel.length < 2 || newUniverseLabel.length > 80) {
      redirect(`/admin/suggestions?erreur=${encodeURIComponent("Le nom de la franchise doit faire entre 2 et 80 caractères.")}`);
    }
    universeLabel = newUniverseLabel;
    universe = slugify(newUniverseLabel);
    if (!universe) redirect(`/admin/suggestions?erreur=${encodeURIComponent("Impossible de créer un identifiant pour cette franchise.")}`);
    const { data: existingFranchises, error: franchisesError } = await (await adminSession()).supabase.from("franchises").select("slug, name");
    if (franchisesError) redirect(`/admin/suggestions?erreur=${encodeURIComponent(franchisesError.message)}`);
    const normalizedLabel = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nameMatch = existingFranchises?.find((entry) => normalizedLabel(entry.name) === normalizedLabel(newUniverseLabel));
    const codeMatch = Object.entries(UNIVERSES).find(([, item]) => normalizedLabel(item.label) === normalizedLabel(newUniverseLabel));
    if (nameMatch) {
      universe = nameMatch.slug;
      universeLabel = nameMatch.name;
    } else if (codeMatch) {
      universe = codeMatch[0];
      universeLabel = codeMatch[1].label;
    } else {
      const takenSlug = existingFranchises?.find((entry) => entry.slug === universe);
      if (takenSlug && normalizedLabel(takenSlug.name) !== normalizedLabel(newUniverseLabel)) {
        redirect(`/admin/suggestions?erreur=${encodeURIComponent(`L’identifiant « ${universe} » est déjà utilisé par ${takenSlug.name}. Indique un nom de franchise plus distinctif.`)}`);
      }
    }
  }

  if (!universe) {
    const { data: existingFranchises } = await (await adminSession()).supabase.from("franchises").select("slug, name").order("name");
    const known = new Map<string, string>();
    for (const [slug, entry] of Object.entries(UNIVERSES)) known.set(slug, entry.label);
    for (const franchise of existingFranchises ?? []) known.set(franchise.slug, franchise.name);
    const guess = await detectUniverse(name, [...known].map(([slug, label]) => ({ slug, label })));
    if (guess) {
      universe = guess.universe;
      universeLabel = guess.label;
      suggestionNote = guess.note;
    } else {
      redirect(`/admin/suggestions?erreur=${encodeURIComponent(`Je n’ai pas pu déterminer la franchise de « ${name} ». Choisis une franchise existante, saisis-en une nouvelle, ou vérifie le nom du personnage.`)}`);
    }
  }

  const result = await prepareAction({ name, universe, universeLabel });
  if (!result.ok) redirect(`/admin/suggestions?erreur=${encodeURIComponent(result.error)}`);

  const draft: SuggestionDraft = {
    id: `suggestion-${result.draft.id}`,
    card_id: result.draft.id,
    name: result.draft.name,
    universe: result.draft.universe,
    universe_label: universeLabel,
    rarity: result.draft.rarity,
    emoji: result.draft.emoji,
    genres: result.draft.genres,
    tagline: result.draft.lore.tagline,
    bio: result.draft.lore.bio,
    quote: result.draft.lore.quote ?? "",
    power: result.draft.lore.power ?? "",
    image_url: result.draft.portrait?.url ?? "",
    image_source_name: result.draft.portrait?.sourceName ?? "",
    image_source_page: result.draft.portrait?.page ?? "",
    image_file: result.draft.portrait?.file ?? "",
    image_width: result.draft.portrait?.width ?? 0,
    image_height: result.draft.portrait?.height ?? 0,
    image_credit: result.draft.portrait?.credit ?? "",
    image_license: result.draft.portrait?.license ?? "",
    quality: cardStats({ id: result.draft.id, name: result.draft.name,
      universe: result.draft.universe as Card["universe"], emoji: result.draft.emoji,
      rarity: result.draft.rarity }).quality,
  };
  const { supabase } = await adminSession();
  const duplicateCard = CARDS.find((card) => card.universe === draft.universe && card.name.localeCompare(draft.name, "fr", { sensitivity: "base" }) === 0);
  if (duplicateCard) redirect(`/admin/suggestions?erreur=${encodeURIComponent(`« ${draft.name} » est déjà au catalogue (${duplicateCard.id}).`)}`);
  const { data: existing } = await supabase.from("card_suggestions").select("id")
    .eq("universe", draft.universe).ilike("name", draft.name).eq("status", "pending").maybeSingle();
  if (existing) redirect(`/admin/suggestions?edit=${encodeURIComponent(existing.id)}&ok=deja-generee`);
  const { data: previous } = await supabase.from("card_suggestions").select("id")
    .eq("card_id", draft.card_id).eq("status", "pending").maybeSingle();
  if (previous) redirect(`/admin/suggestions?edit=${encodeURIComponent(previous.id)}&ok=deja-generee`);
  const { error } = await supabase.rpc("admin_create_card_suggestion", { p_card: draft });
  if (error) redirect(`/admin/suggestions?erreur=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/suggestions");
  redirect(`/admin/suggestions?edit=${encodeURIComponent(draft.id)}&ok=generee${suggestionNote ? `&note=${encodeURIComponent(suggestionNote)}` : ""}`);
}
