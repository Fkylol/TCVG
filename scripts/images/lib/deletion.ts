/**
 * Étape 5 — garde-fous puis suppression définitive des cartes sans image.
 *
 * Garde-fous (bloquants) :
 *   a) plus de 40 % du catalogue supprimé → arrêt (recherche probablement cassée) ;
 *   b) plus de 10 % des cartes encore « à retenter » → arrêt (réseau instable) ;
 *   c) plus de 20 cartes d'une même franchise → arrêt, revérification demandée ;
 *   d) instantané de l'étape 0 présent.
 *
 * La suppression tient en un seul bloc `do $$ … $$` : ordres d'achat annulés
 * avec restitution des Pixels réservés, annonces annulées, lignes dépendantes
 * effacées (aucune ligne orpheline ne doit rester), puis les cartes.
 */

import type { Runner } from "../../lib/db-runner";
import { RARITY_ORDER } from "../../../src/lib/rarity-distribution.config";

export type Guard = { label: string; ok: boolean; blocking: boolean; detail: string };

export const MAX_DELETED_SHARE = 0.4;
export const MAX_RETRY_SHARE = 0.1;
export const MAX_PER_FRANCHISE = 20;

export async function DELETE_GUARDRAILS(
  runner: Runner,
  toDelete: { id: string; franchise: string }[],
  total: number,
  snapshotExists: boolean,
): Promise<Guard[]> {
  const share = total > 0 ? toDelete.length / total : 0;
  const perFranchise = new Map<string, number>();
  for (const card of toDelete) perFranchise.set(card.franchise, (perFranchise.get(card.franchise) ?? 0) + 1);
  const crowded = [...perFranchise].filter(([, count]) => count > MAX_PER_FRANCHISE);

  const retryRows = await runner.query(`
    select count(*)::int as n from public.cards where image_status = 'retry'
  `);
  const retry = Number(retryRows[0]?.n ?? 0);
  const retryShare = total > 0 ? retry / total : 0;

  return [
    {
      label: "a — part du catalogue supprimée",
      ok: share <= MAX_DELETED_SHARE,
      blocking: true,
      detail: `${toDelete.length}/${total} (${(share * 100).toFixed(1)} %), plafond ${Math.round(MAX_DELETED_SHARE * 100)} %`,
    },
    {
      label: "b — cartes encore à retenter",
      ok: retryShare <= MAX_RETRY_SHARE,
      blocking: true,
      detail: `${retry}/${total} (${(retryShare * 100).toFixed(1)} %), plafond ${Math.round(MAX_RETRY_SHARE * 100)} %`,
    },
    {
      label: `c — franchises à plus de ${MAX_PER_FRANCHISE} suppressions`,
      ok: crowded.length === 0,
      blocking: true,
      detail: crowded.length
        ? crowded.map(([name, count]) => `${name} : ${count}`).join(" · ")
        : "aucune franchise au-dessus du seuil",
    },
    {
      label: "d — instantané de l'étape 0",
      ok: snapshotExists,
      blocking: true,
      detail: snapshotExists ? "instantané présent dans .snapshots" : "aucun instantané",
    },
  ];
}

/** Plan lisible, pour le rapport. */
export function planDeletion(ids: string[]): string[] {
  return [
    "annuler les ordres d'achat actifs et restituer les Pixels réservés",
    "annuler les annonces actives des cartes visées",
    "supprimer trades, market_audit, notifications liées",
    "supprimer collection, wishlist, card_genres, card_profiles, card_appearances, chat_offers, chat_announcements",
    "supprimer market_listings, buy_orders, puis cards",
    "vérifier qu'aucune carte ne subsiste",
  ].map((step, index) => `${ids.length} cartes — ${index + 1}. ${step}`);
}

function arrayLiteral(ids: string[]): string {
  return `array[${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(", ")}]::text[]`;
}

/**
 * Un seul bloc atomique : toute erreur annule l'ensemble. Le tri final
 * s'appuie sur `rarity` uniquement pour rester lisible dans les journaux.
 */
export function DELETE_SQL(ids: string[]): string {
  void RARITY_ORDER;
  return `
do $img$
declare
  v_ids text[] := ${arrayLiteral(ids)};
  v_order record;
  v_refunded integer := 0;
  v_remaining integer;
begin
  -- 1. Ordres d'achat actifs : annulation et restitution des Pixels réservés.
  for v_order in
    select id, buyer_id, reserved_pixels
      from public.buy_orders
     where card_id = any(v_ids) and status = 'active'
       for update
  loop
    update public.buy_orders
       set status = 'cancelled',
           cancelled_at = now(),
           reserved_pixels = 0
     where id = v_order.id;

    if v_order.reserved_pixels > 0 then
      update public.profiles
         set pixels = pixels + v_order.reserved_pixels
       where id = v_order.buyer_id;

      insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
      values (v_order.buyer_id, v_order.reserved_pixels, 'annulation_ordre', 'buy_order', v_order.id);

      v_refunded := v_refunded + v_order.reserved_pixels;
    end if;
  end loop;

  -- 2. Annonces actives : annulées (traçabilité) avant la suppression.
  update public.market_listings
     set status = 'cancelled',
         cancelled_at = now()
   where card_id = any(v_ids) and status = 'active';

  -- 3. Lignes dépendantes sans clé étrangère en cascade.
  delete from public.trades where card_id = any(v_ids);
  delete from public.market_audit where card_id is not null and card_id = any(v_ids);
  delete from public.notifications where card_id = any(v_ids);

  -- 4. Lignes dépendantes avec cascade, effacées explicitement pour l'ordre.
  delete from public.collection where card_id = any(v_ids);
  delete from public.wishlist where card_id = any(v_ids);
  delete from public.card_genres where card_id = any(v_ids);
  delete from public.card_profiles where card_id = any(v_ids);
  delete from public.card_appearances where card_id = any(v_ids);
  delete from public.chat_offers
   where offered_card_id = any(v_ids) or requested_card_id = any(v_ids);
  delete from public.chat_announcements where card_id = any(v_ids);
  delete from public.market_listings where card_id = any(v_ids);
  delete from public.buy_orders where card_id = any(v_ids);

  -- 5. Les cartes.
  delete from public.cards where id = any(v_ids);

  select count(*) into v_remaining from public.cards where id = any(v_ids);
  if v_remaining > 0 then
    raise exception 'suppression incomplète : % carte(s) restante(s)', v_remaining;
  end if;

  raise notice 'suppression : % carte(s), % Pixels restitués', array_length(v_ids, 1), v_refunded;
end $img$;
`;
}
