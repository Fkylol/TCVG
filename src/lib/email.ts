/**
 * Envoi des avis et bugs par email (Resend).
 *
 * Le message est d'abord enregistré dans `public.feedback` : l'email n'est
 * qu'une notification. Si Resend n'est pas configuré ou échoue, l'envoi reste
 * enregistré et le joueur voit quand même sa confirmation.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type FeedbackEmail = {
  kind: "avis" | "bug";
  message: string;
  page: string | null;
  /** Pseudo et email du joueur connecté, ou visiteur anonyme. */
  sender: string;
};

/**
 * Destinataire des notifications, réglé par `FEEDBACK_EMAIL_TO`.
 * Resend compare l'adresse du mode test à la casse près : on normalise en
 * minuscules pour qu'une majuscule dans `.env` ne bloque pas l'envoi.
 */
export function feedbackRecipient(): string | null {
  const value = process.env.FEEDBACK_EMAIL_TO?.trim();
  return value ? value.toLowerCase() : null;
}

/**
 * Poste le message sur l'API Resend. Sans clé ou sans destinataire, la
 * fonction ne fait rien et renvoie `false`.
 */
export async function sendFeedbackEmail(payload: FeedbackEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = feedbackRecipient();
  if (!apiKey || !to) return false;

  // Sans domaine vérifié, Resend n'accepte que `onboarding@resend.dev` et
  // n'envoie qu'à l'adresse du compte. `FEEDBACK_EMAIL_FROM` permet de passer
  // à `TCVG <avis@ton-domaine>` une fois le domaine vérifié.
  const from = process.env.FEEDBACK_EMAIL_FROM?.trim() || "TCVG <onboarding@resend.dev>";
  const subject =
    payload.kind === "bug"
      ? `[TCVG] Bug${payload.page ? ` · ${payload.page}` : ""}`
      : `[TCVG] Avis${payload.page ? ` · ${payload.page}` : ""}`;

  const text = [
    payload.kind === "bug" ? "Type : bug" : "Type : avis",
    payload.page ? `Page : ${payload.page}` : "Page : non précisée",
    `De : ${payload.sender}`,
    "",
    payload.message,
  ].join("\n");

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });

    if (!response.ok) {
      console.error("resend", response.status, (await response.text()).slice(0, 300));
      return false;
    }

    return true;
  } catch (error) {
    console.error("resend", error);
    return false;
  }
}
