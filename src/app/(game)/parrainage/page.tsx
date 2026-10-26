import Link from "next/link";
import { recheckDiscordMfa } from "@/app/actions/referral";
import { AvatarFrame } from "@/components/avatar-frame";
import { ReferralLink } from "@/components/referral-link";
import { getCardArt } from "@/lib/card-art";
import { requireSession } from "@/lib/auth";
import { DISCORD_MFA_HELP, REFERRAL_CONFIG } from "@/lib/referral/config";
import { getReferralOverview, getReferralReferredAvatars } from "@/lib/referral/service";
import {
  STATUS_LABEL,
  inviteUrl,
  openingsProgress,
  type ReferralStatus,
} from "@/lib/referral/rules";

export const metadata = { title: "Parrainage — TCVG" };

const STATUS_TONE: Record<ReferralStatus, string> = {
  en_cours: "bg-white/10 text-white/60",
  eligible: "bg-acid/15 text-acid",
  en_attente: "bg-amber-400/15 text-amber-200",
  a_examiner: "bg-amber-400/15 text-amber-200",
  paye: "bg-emerald-400/15 text-emerald-300",
  refuse: "bg-rose-400/15 text-rose-200",
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ReferralPage({
  searchParams,
}: {
  searchParams: Promise<{ mfa?: string }>;
}) {
  const { mfa } = await searchParams;
  const { supabase } = await requireSession();
  const [overview, avatars] = await Promise.all([
    getReferralOverview(supabase),
    getReferralReferredAvatars(supabase),
  ]);

  if (!overview) {
    return (
      <div>
        <span className="eyebrow">Parrainage</span>
        <h1 className="display mt-2 text-4xl">Parrainage</h1>
        <span className="title-rule" aria-hidden />
        <p className="mt-4 max-w-2xl text-sm text-white/55">
          Le parrainage n&apos;est pas encore activé sur cette base. La migration 046 doit être
          appliquée.
        </p>
      </div>
    );
  }

  const link = inviteUrl(overview.code);
  const invited = overview.invited;
  const invitedProgress = invited
    ? openingsProgress(invited.openings, overview.requiredOpenings)
    : null;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Invitation</span>
          <h1 className="display mt-2 text-4xl">Parrainage</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Invite un ami : quand il a ouvert {overview.requiredOpenings} boosters, vous recevez{" "}
            {overview.rewardBoosters} boosters bonus chacun.
          </p>
        </div>

        <div className="flex gap-2 text-center">
          {[
            { label: "Payés", value: `${overview.paid} / ${overview.maxPaid}` },
            { label: "En cours", value: `${overview.active} / ${overview.maxPending}` },
          ].map((item) => (
            <div key={item.label} className="border border-white/10 px-4 py-2">
              <p className="font-mono text-lg font-semibold text-acid">{item.value}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {overview.missed > 0 && (
        <p className="mb-5 border-l-2 border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {overview.missed} invitation{overview.missed > 1 ? "s" : ""} récente
          {overview.missed > 1 ? "s" : ""} n&apos;a pas pu être rattachée : tu as atteint le
          plafond de {overview.maxPending} parrainages en cours. Les filleuls concernés ont été
          enregistrés sans parrain.
        </p>
      )}

      {mfa === "limite" && (
        <p role="alert" className="mb-5 border-l-2 border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Trop de vérifications d&apos;A2F en peu de temps. Réessaie dans quelques minutes.
        </p>
      )}
      {mfa === "echec" && (
        <p role="alert" className="mb-5 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          La vérification Discord a échoué. Réessaie depuis cette page.
        </p>
      )}
      {mfa === "1" && (
        <p className="mb-5 border-l-2 border-acid/60 bg-acid/10 px-3 py-2 text-sm text-acid">
          Vérification Discord effectuée : ton état A2F vient d&apos;être relu.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-xl">Ton lien</h2>
              <span className="text-[11px] text-white/35">Cookie {REFERRAL_CONFIG.cookieDays} jours</span>
            </div>
            <p className="mb-4 mt-1 text-sm text-white/45">
              Ton filleul doit créer son compte en passant par ce lien, puis ouvrir{" "}
              {overview.requiredOpenings} boosters.
            </p>
            <ReferralLink code={overview.code} url={link} />
          </section>

          <section className="panel p-5">
            <h2 className="display text-xl">Tes filleuls</h2>
            {overview.referrals.length === 0 ? (
              <p className="mt-3 text-sm text-white/45">
                Personne pour l&apos;instant. Partage ton lien : le compteur se remplit dès la
                première ouverture.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-white/10">
                {overview.referrals.map((row) => {
                  const progress = openingsProgress(row.openings, overview.requiredOpenings);
                  const avatar = avatars.get(row.id);
                  return (
                    <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium text-white/80">
                          <AvatarFrame
                            avatar={avatar?.avatarCardId ? getCardArt(avatar.avatarCardId) : null}
                            initial={row.username.charAt(0)}
                            size={24}
                            frameId={avatar?.frame ?? "steel"}
                          />
                          {row.username}
                        </span>
                        <span className={`chip px-2 py-0.5 text-[10px] ${STATUS_TONE[row.status]}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden bg-white/10">
                          <div
                            className="h-full bg-acid"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-white/50">
                          {progress.openings} / {progress.required} ouverts
                        </span>
                      </div>

                      <p className="mt-1.5 text-[11px] text-white/35">
                        {row.status === "paye"
                          ? `Payé le ${dateLabel(row.paidAt)}`
                          : row.status === "en_attente"
                            ? `Paiement prévu le ${dateLabel(row.eligibleAt)}`
                            : row.status === "a_examiner"
                              ? "Vérification manuelle en cours."
                              : row.status === "refuse"
                                ? "Conditions non réunies."
                                : progress.done
                                  ? "Seuil atteint, vérification en cours."
                                  : `${progress.remaining} booster${progress.remaining > 1 ? "s" : ""} restant${progress.remaining > 1 ? "s" : ""}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="display text-xl">Comment ça marche</h2>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-white/55">
              <li>
                <span className="text-white/80">1.</span> Ton ami crée son compte avec Discord en
                passant par ton lien. Un compte déjà existant ne peut pas être parrainé.
              </li>
              <li>
                <span className="text-white/80">2.</span> Il ouvre {overview.requiredOpenings}{" "}
                boosters (un ×10 compte pour 10). Le compteur vient du journal serveur : rien
                n&apos;est déclaré par le navigateur.
              </li>
              <li>
                <span className="text-white/80">3.</span> Vous recevez chacun{" "}
                {overview.rewardBoosters} boosters bonus, hors plafond de stock et sans expiration.
                Avec l&apos;A2F Discord active, tout de suite ; sinon après {overview.delayDays}{" "}
                jours.
              </li>
            </ol>
            <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
              Les boosters offerts n&apos;ont aucune valeur monétaire et ne s&apos;échangent pas
              contre de l&apos;argent. Les invitations suspectes (même appareil, rafales
              d&apos;inscriptions) sont vérifiées avant paiement.
            </p>
          </section>
        </div>

        <aside className="space-y-5">
          {invited && invitedProgress && (
            <section className="panel panel-accent p-5">
              <span className="eyebrow">Invitation reçue</span>
              <h2 className="display mt-1 text-lg">
                Invité par <span className="text-acid">{invited.referrer}</span>
              </h2>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden bg-white/10">
                  <div className="h-full bg-acid" style={{ width: `${invitedProgress.percent}%` }} />
                </div>
                <span className="font-mono text-[11px] text-white/55">
                  {invitedProgress.openings} / {invitedProgress.required}
                </span>
              </div>

              <dl className="mt-4 space-y-1.5 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">Statut</dt>
                  <dd className={STATUS_TONE[invited.status].split(" ")[1]}>
                    {STATUS_LABEL[invited.status]}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">Compte Discord</dt>
                  <dd className={invited.discordLinked ? "text-emerald-300" : "text-rose-300"}>
                    {invited.discordLinked ? "Lié" : "Non lié"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">A2F</dt>
                  <dd className={overview.mfaEnabled ? "text-emerald-300" : "text-white/55"}>
                    {overview.mfaEnabled ? "Active" : "Non active"}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-[12px] leading-relaxed text-white/50">
                {invited.status === "paye"
                  ? `Parrainage payé : ${overview.rewardBoosters} boosters bonus t'ont été crédités.`
                  : overview.mfaEnabled
                    ? "Ton A2F est active : tes boosters arrivent dès que le seuil est atteint."
                    : invited.eligibleAt
                      ? `Active l'A2F sur Discord pour recevoir tes boosters tout de suite ; sinon ils arrivent le ${dateLabel(invited.eligibleAt)}.`
                      : "Active l'A2F sur Discord pour recevoir tes boosters tout de suite dès le seuil atteint."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={recheckDiscordMfa}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    J&apos;ai activé l&apos;A2F, revérifier
                  </button>
                </form>
                <Link
                  href={DISCORD_MFA_HELP}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  Aide Discord
                </Link>
              </div>
            </section>
          )}

          <section className="panel p-5">
            <h2 className="display text-base">Ton A2F</h2>
            <p className="mt-2 text-sm text-white/55">
              {overview.mfaEnabled
                ? "Active. C'est ce qui débloque le paiement immédiat de tes parrainages."
                : "Non active. Sans A2F, les boosters arrivent après le délai de vérification."}
            </p>
            <p className="mt-1 text-[11px] text-white/35">
              Dernière vérification : {dateLabel(overview.mfaCheckedAt)}
            </p>
            <form action={recheckDiscordMfa} className="mt-3">
              <button type="submit" className="btn btn-outline btn-sm w-full">
                Revérifier via Discord
              </button>
            </form>
            <p className="mt-2 text-[10px] leading-relaxed text-white/30">
              La vérification redemande une connexion Discord (scope « identify »). Aucun jeton
              Discord n&apos;est conservé.
            </p>
          </section>

          <section className="panel p-5">
            <h2 className="display text-base">Boosters bonus</h2>
            <p className="mt-2 font-mono text-3xl font-semibold text-acid">
              +{overview.bonusBoosters}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Utilisés après le stock normal, ils ne sont jamais perdus et ne comptent pas dans le
              plafond de 10.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
