import Link from "next/link";
import { markAllNotificationsRead } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getCard } from "@/lib/cards";
import { getNotifications, type Notification } from "@/lib/data";

export const metadata = { title: "Notifications — TCVG" };

const TONE: Record<Notification["kind"], string> = {
  listing_sold: "bg-emerald-400/15 text-emerald-300",
  order_filled: "bg-acid/15 text-acid",
  listing_expired: "bg-white/10 text-white/55",
  wishlist_listing: "bg-white/10 text-white/70",
  swap_offer: "bg-acid/15 text-acid",
  swap_accepted: "bg-emerald-400/15 text-emerald-300",
  swap_declined: "bg-white/10 text-white/55",
  swap_expired: "bg-white/10 text-white/55",
  listing_cancelled: "bg-amber-400/15 text-amber-300",
  order_cancelled: "bg-amber-400/15 text-amber-300",
  referral_milestone: "bg-acid/15 text-acid",
  referral_pending: "bg-amber-400/15 text-amber-200",
  referral_paid: "bg-emerald-400/15 text-emerald-300",
  referral_refused: "bg-rose-400/15 text-rose-200",
  frame_unlocked: "bg-fuchsia-400/15 text-fuchsia-200",
};

const LABEL: Record<Notification["kind"], string> = {
  listing_sold: "Vente",
  order_filled: "Ordre servi",
  listing_expired: "Expiration",
  wishlist_listing: "Envie",
  swap_offer: "Échange",
  swap_accepted: "Échange",
  swap_declined: "Échange",
  swap_expired: "Échange",
  listing_cancelled: "Annonce annulée",
  order_cancelled: "Ordre annulé",
  referral_milestone: "Parrainage",
  referral_pending: "Parrainage",
  referral_paid: "Parrainage payé",
  referral_refused: "Parrainage",
  frame_unlocked: "Cadre",
};

function sentence(notification: Notification): string {
  // Les événements de parrainage portent leur propre texte, écrit côté serveur.
  if (notification.message) return notification.message;

  const name = notification.cardId
    ? (getCard(notification.cardId)?.name ?? notification.cardId)
    : "Une carte";

  switch (notification.kind) {
    case "listing_sold":
      return `${name} a trouvé preneur : ◆ ${notification.amount ?? 0} nets crédités.`;
    case "order_filled":
      return `Ton ordre d'achat sur ${name} a été servi pour ◆ ${notification.amount ?? 0}.`;
    case "listing_expired":
      return `L'annonce de ${name} a expiré : la copie est revenue dans ta collection.`;
    case "wishlist_listing":
      return `${name}, que tu suis dans tes envies, est en vente pour ◆ ${notification.amount ?? 0}.`;
    case "swap_offer":
      return `Nouvelle proposition d'échange autour de ${name}. Les cartes proposées sont réservées le temps de la réponse.`;
    case "swap_accepted":
      return `Échange conclu : ${name} a rejoint ta collection.`;
    case "swap_declined":
      return `Ta proposition d'échange autour de ${name} a été refusée. La carte est revenue dans ta collection.`;
    case "swap_expired":
      return `Une proposition d'échange autour de ${name} a expiré. Les cartes réservées sont revenues à leurs propriétaires.`;
    case "listing_cancelled":
      return `Ton annonce de ${name} a été annulée : sa rareté a changé, le prix ne tenait plus dans la nouvelle fourchette. La carte est revenue dans ta collection.`;
    case "order_cancelled":
      return `Ton ordre d'achat sur ${name} a été annulé : sa rareté a changé, ton prix ne tenait plus dans la nouvelle fourchette. ◆ ${notification.amount ?? 0} de réservation restitués.`;
    case "referral_milestone":
      return "Ton parrainage a atteint son seuil d'ouvertures.";
    case "referral_pending":
      return "Ton parrainage est en attente : les boosters arrivent à la date de vérification.";
    case "referral_paid":
      return "Ton parrainage a été payé : boosters bonus crédités.";
    case "referral_refused":
      return "Un parrainage n'a pas abouti : les conditions ne sont plus réunies.";
    case "frame_unlocked":
      return "Nouveau cadre débloqué.";
  }
}

function formatMoment(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const { supabase } = await requireSession();
  const notifications = await getNotifications(supabase);
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Activité</span>
          <h1 className="display mt-2 text-4xl">Notifications</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Tes ventes, tes ordres d&apos;achat servis, tes annonces expirées et les cartes de ta
            liste d&apos;envies mises en vente, du plus récent au plus ancien.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="chip py-2 text-white/60">
            <span className="font-sans text-white/40">Non lues</span>{" "}
            <span className={unread > 0 ? "font-semibold text-acid" : "text-white/80"}>{unread}</span>
          </span>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button type="submit" className="btn btn-outline btn-sm">
                Tout marquer comme lu
              </button>
            </form>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="border border-dashed border-white/15 px-6 py-14 text-center text-sm text-white/50">
          Aucune notification pour le moment. Dès qu&apos;une carte est vendue, qu&apos;un ordre est
          servi ou qu&apos;une annonce expire, tu la retrouveras ici.
        </div>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden border border-white/10 bg-white/[0.02]">
          {notifications.map((notification) => {
            const card = notification.cardId ? getCard(notification.cardId) : undefined;
            const isUnread = !notification.readAt;

            return (
              <li
                key={notification.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                  isUnread ? "bg-white/[0.03]" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isUnread ? "bg-acid" : "bg-transparent"
                  }`}
                />
                <span
                  className={`chip shrink-0 px-2 py-0.5 text-[10px] font-semibold ${TONE[notification.kind]}`}
                >
                  {LABEL[notification.kind]}
                </span>

                <span className="min-w-0 flex-1 text-sm text-white/75">
                  {sentence(notification)}
                  {card && (
                    <>
                      {" "}
                      <Link
                        href={`/card/${card.id}`}
                        className="text-[11px] text-white/35 transition hover:text-acid"
                      >
                        Voir la fiche →
                      </Link>
                      {notification.kind.startsWith("swap") && (
                        <>
                          {" "}
                          <Link
                            href="/agora/offres"
                            className="text-[11px] text-acid/80 transition hover:text-acid"
                          >
                            Voir mes échanges →
                          </Link>
                        </>
                      )}
                    </>
                  )}
                  {notification.kind === "frame_unlocked" && notification.frameId && (
                    <>
                      {" "}
                      <Link
                        href={`/profil?cadre=${encodeURIComponent(notification.frameId)}#cadres`}
                        className="text-[11px] font-semibold text-acid transition hover:underline"
                      >
                        Équiper →
                      </Link>
                    </>
                  )}
                </span>

                <span className="w-32 text-right font-mono text-[11px] text-white/35">
                  {formatMoment(notification.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-white/30">
        Les notifications sont conservées sans limite et ne sont jamais partagées avec les autres
        joueurs.
      </p>
    </div>
  );
}
