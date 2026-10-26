import Link from "next/link";
import { DISCORD_MFA_HELP, REFERRAL_CONFIG } from "@/lib/referral/config";

export const metadata = { title: "Confidentialité — TCVG" };

export default function PrivacyPage() {
  return (
    <article>
      <span className="eyebrow">Données personnelles</span>
      <h1 className="display mt-2 text-4xl">Confidentialité</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        TCVG ne collecte que ce qui est nécessaire au jeu. Pas de publicité, pas de traceur, aucune
        revente de données.
      </p>

      <Section title="Connexion Discord">
        La connexion passe uniquement par Discord. Le site demande le scope{" "}
        <strong className="text-white/80">« identify »</strong> : il reçoit ton identifiant Discord,
        ton pseudo et l&apos;indicateur d&apos;authentification à deux facteurs (A2F). Il ne demande
        jamais l&apos;email, la liste de tes serveurs, tes messages ou tes amis. Aucun mot de passe
        n&apos;est créé ni stocké par TCVG.
      </Section>

      <Section title="Parrainage">
        Un lien d&apos;invitation contient un code propre à chaque joueur. Quand tu passes par ce
        lien, un cookie technique first-party de {REFERRAL_CONFIG.cookieDays} jours retient ce code
        jusqu&apos;à ta première connexion Discord. Si tu crées un compte, le lien entre le parrain
        et toi est enregistré ; un compte déjà existant ne peut pas être parrainé et un parrain ne
        change jamais. Le parrain voit ton pseudo et ta progression dans le parrainage
        (boosters ouverts, statut). Aucun autre joueur n&apos;y a accès.
      </Section>

      <Section title="Vérification de l'A2F">
        Pour décider si la récompense de parrainage est immédiate ou différée, TCVG lit le champ
        « mfa_enabled » de ton compte Discord au moment de la connexion. La date de la dernière
        vérification est conservée. Le bouton « J&apos;ai activé l&apos;A2F, revérifier » redemande
        une connexion Discord pour relire cette valeur. Aucun jeton Discord n&apos;est conservé sur
        les serveurs du jeu. L&apos;aide officielle est disponible sur{" "}
        <Link
          href={DISCORD_MFA_HELP}
          target="_blank"
          rel="noreferrer"
          className="text-acid underline-offset-4 hover:underline"
        >
          le site de Discord
        </Link>
        .
      </Section>

      <Section title="Empreintes anti-fraude">
        Pour décourager les multi-comptes, l&apos;adresse IP et l&apos;agent utilisateur des
        connexions sont transformés en empreintes salées (HMAC-SHA256) au moment de
        l&apos;inscription et des connexions. L&apos;adresse IP en clair n&apos;est jamais écrite en
        base. Ces empreintes servent uniquement à repérer des inscriptions rapprochées : elles sont
        conservées au maximum {REFERRAL_CONFIG.fingerprintRetentionDays} jours, puis supprimées
        automatiquement par la tâche planifiée. Elles ne sont ni affichées, ni transmises, ni
        utilisées pour de la publicité.
      </Section>

      <Section title="Boosters bonus">
        Les boosters offerts par le parrainage sont un solde de jeu sans valeur monétaire. Ils ne
        peuvent pas être échangés, revendus ni convertis en argent.
      </Section>

      <Section title="Tes droits">
        Tu peux demander la suppression de ton compte et des données associées via la page{" "}
        <Link href="/avis-et-bugs" className="text-acid underline-offset-4 hover:underline">
          Avis et bugs
        </Link>
        . La suppression du compte efface le profil, la collection, les parrainages et les
        empreintes qui lui sont liés.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <span className="section-rule section-rule-tight" aria-hidden />
      <h2 className="display text-xl">{title}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-white/55">{children}</div>
    </section>
  );
}
