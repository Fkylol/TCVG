import Link from "next/link";
import { APP_CHAT_NAME, CHAT_DEFAULTS } from "@/lib/chat/config";
import { MAX_OFFER_MESSAGE, OFFER_DEFAULTS } from "@/lib/chat/offers";

export const metadata = { title: `Règles du chat — ${APP_CHAT_NAME} — TCVG` };

/**
 * Règles du chat, page publique.
 *
 * Les durées sont lues depuis les constantes de repli : si un réglage change
 * en base, cette page doit être mise à jour en même temps (voir README).
 */
export default function ChatRulesPage() {
  return (
    <article className="space-y-7">
      <header>
        <span className="eyebrow">Communauté</span>
        <h1 className="display mt-2 text-4xl">Règles de {APP_CHAT_NAME}</h1>
        <span className="title-rule" aria-hidden />
        <p className="mt-2 text-sm text-white/50">
          {APP_CHAT_NAME} est le salon du marché : on y annonce les cartes qu&apos;on échange, on y
          dit ce que l&apos;on cherche, et on y discute entre collectionneurs. Ces règles
          s&apos;appliquent à tous les salons, dans toutes les langues.
        </p>
      </header>

      <section className="panel p-4">
        <h2 className="display text-lg">Les règles</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-white/65">
          <li>Respecte les autres joueurs : pas d&apos;insultes, de harcèlement ni de propos haineux.</li>
          <li>
            Pas de spam ni de publicité. Un même message répété est bloqué, et les majuscules
            abusives sont corrigées automatiquement.
          </li>
          <li>
            Aucun lien, aucune image, aucune pièce jointe : le texte seul est accepté. Les adresses
            de site sont refusées.
          </li>
          <li>
            Ne partage jamais de données personnelles (adresse, e-mail, réseaux sociaux) — ni les
            tiennes, ni celles d&apos;un autre joueur.
          </li>
          <li>
            Les échanges se font <strong>carte contre carte</strong>, uniquement. Aucun échange de
            Pixels ni d&apos;argent n&apos;a sa place dans le chat : les ventes restent sur le
            marché.
          </li>
          <li>Les annonces doivent être honnêtes : on n&apos;annonce pas une carte qu&apos;on n&apos;a pas.</li>
        </ol>
      </section>

      <section className="panel p-4">
        <h2 className="display text-lg">Quand peut-on écrire ?</h2>
        <p className="mt-2 text-sm text-white/60">
          La lecture est ouverte à tous les comptes connectés. L&apos;écriture se débloque après un
          peu d&apos;activité réelle : {CHAT_DEFAULTS.unlockBoosters} boosters ouverts et un compte
          de plus de {CHAT_DEFAULTS.unlockHours} heures. Avant cela, le panneau indique exactement
          ce qu&apos;il reste à faire.
        </p>
        <p className="mt-2 text-sm text-white/60">
          Une fois débloqué : un message toutes les {CHAT_DEFAULTS.rateSeconds} secondes,{" "}
          {CHAT_DEFAULTS.ratePerMinute} par minute, {CHAT_DEFAULTS.maxAnnouncements} annonces
          actives au maximum, qui expirent après {CHAT_DEFAULTS.announcementMinutes} minutes. Les
          messages font 300 caractères au plus.
        </p>
      </section>

      <section className="panel p-4">
        <h2 className="display text-lg">Proposer un échange</h2>
        <p className="mt-2 text-sm text-white/60">
          Depuis une annonce, « Proposer un échange » (ou « Faire une offre » pour une recherche)
          envoie une proposition à son auteur : une de tes copies contre la carte annoncée, avec un
          mot de {MAX_OFFER_MESSAGE} caractères au plus.
        </p>
        <p className="mt-2 text-sm text-white/60">
          La carte proposée est <strong>réservée dès l&apos;envoi</strong> : elle quitte ton album et
          ne peut pas être vendue ni proposée ailleurs jusqu&apos;à la réponse. Une offre expire au
          bout de {OFFER_DEFAULTS.hours} heures : la copie revient alors automatiquement. Tu peux la
          retirer toi-même à tout moment, et le destinataire peut accepter, refuser ou
          contre-proposer.
        </p>
        <p className="mt-2 text-sm text-white/60">
          Limites : {OFFER_DEFAULTS.activeMax} propositions en attente et{" "}
          {OFFER_DEFAULTS.perDay} par jour. Quand une offre est acceptée, les deux cartes changent
          de propriétaire dans la même opération : l&apos;une ne peut pas partir sans l&apos;autre.
          Aucun Pixels n&apos;entre dans un échange.
        </p>
        <p className="mt-2 text-sm text-white/60">
          Une carte retirée du catalogue ne peut plus être échangée : les offres en cours qui la
          concernent sont annulées et les copies rendues.
        </p>
      </section>

      <section className="panel p-4">
        <h2 className="display text-lg">Signalements et modération</h2>
        <p className="mt-2 text-sm text-white/60">
          Chaque message peut être signalé (spam, harcèlement, contenu inapproprié, arnaque,
          autre). Un joueur peut aussi bloquer un autre joueur : ses messages disparaissent alors
          de ton fil, et il ne pourra plus te proposer d&apos;échange.
        </p>
        <p className="mt-2 text-sm text-white/60">
          La modération peut supprimer un message, réduire un joueur au silence, retirer ses
          annonces ou passer un salon en lecture seule. Chaque décision est tracée dans un journal
          d&apos;audit interne (qui, quoi, quand, raison).
        </p>
      </section>

      <section className="panel p-4">
        <h2 className="display text-lg">Données personnelles</h2>
        <p className="mt-2 text-sm text-white/60">
          Seuls ton pseudo, ton avatar et ton cadre sont visibles dans le chat. Aucune adresse
          e-mail, aucun identifiant privé n&apos;est publié, et la collection d&apos;un joueur
          n&apos;est jamais exposée : la mention « Il te manque » est calculée avec{" "}
          <em>ta</em> collection, côté serveur.
        </p>
        <p className="mt-2 text-sm text-white/60">
          Les propositions d&apos;échange ne contiennent que les identifiants des deux cartes et un
          mot facultatif. Si tu actives l&apos;alerte e-mail, ton adresse n&apos;est lue que par le
          serveur pour cet envoi : elle n&apos;apparaît jamais dans le chat ni dans une offre.
        </p>
        <p className="mt-2 text-sm text-white/60">
          Les messages sont conservés {CHAT_DEFAULTS.retentionDays} jours, puis supprimés
          automatiquement. Tu peux supprimer tes propres messages à tout moment ; à la suppression
          de ton compte, ils sont anonymisés. Il n&apos;y a pas de messages privés dans cette
          version : aucune sollicitation directe n&apos;est possible en dehors des annonces, que tu
          peux masquer ou bloquer.
        </p>
      </section>

      <p className="text-xs text-white/35">
        En utilisant le chat, tu acceptes ces règles. Un manquement peut entraîner une réduction au
        silence temporaire ou définitive.{" "}
        <Link href="/marche" className="text-acid underline-offset-2 hover:underline">
          Retour au marché
        </Link>
        .
      </p>
    </article>
  );
}
