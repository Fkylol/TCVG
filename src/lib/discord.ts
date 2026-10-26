/**
 * Messages privés Discord (bot du jeu).
 *
 * Les propositions d'échange préviennent le destinataire en MP Discord. Le bot
 * n'a pas besoin de commandes : il ouvre la conversation privée avec le joueur
 * (`POST /users/@me/channels`) puis y poste le message. Discord n'autorise
 * l'ouverture d'un MP que si le joueur partage un serveur avec le bot ; sinon
 * l'API répond 403 et l'on se contente de la notification in-site.
 *
 * Sans `DISCORD_BOT_TOKEN` (ou sans identifiant lié), rien n'est envoyé et
 * aucune action ne doit échouer : l'échange, lui, est déjà enregistré en base.
 */

const DISCORD_API = "https://discord.com/api/v10";

/** Origine du site, utilisée dans le lien du message. */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tcvg.fun").replace(/\/$/, "");
}

/** Le bot est-il configuré ? */
export function discordDmEnabled(): boolean {
  return Boolean(process.env.DISCORD_BOT_TOKEN);
}

export type SwapOfferDm = {
  /** Pseudo du joueur qui reçoit la proposition. */
  owner: string;
  /** Pseudo du joueur qui propose. */
  proposer: string;
  /** Carte apportée, telle qu'affichée dans le jeu. */
  offered: string;
  /** Carte demandée, ou `null` pour une annonce « Je cherche ». */
  requested: string | null;
  /** Message joint à la proposition, s'il y en a un. */
  message?: string | null;
  /** Durée de validité, en heures. */
  hours?: number;
};

/**
 * Texte du MP. Fonction pure : le contenu est testé sans réseau.
 *
 * Aucune mention `@` n'est insérée : un pseudo de carte ou de joueur ne doit pas
 * déclencher une notification de serveur.
 */
export function swapOfferDmText(payload: SwapOfferDm): string {
  const hours = payload.hours ?? 24;
  const lines = [
    `🎴 **${payload.proposer}** te propose un échange.`,
    `Il apporte **${payload.offered}** ; il demande ${
      payload.requested ? `**${payload.requested}**` : "**la carte de ton choix**"
    }.`,
  ];

  const message = payload.message?.trim();
  if (message) lines.push(`« ${message} »`);

  lines.push(
    `Réponds sur TCVG : ${siteUrl()}/agora/offres — l'offre expire dans ${hours} h.`,
  );

  const text = lines.join("\n");
  // Limite Discord : 2000 caractères par message.
  return text.length > 1900 ? `${text.slice(0, 1897)}…` : text;
}

type DiscordError = { message?: string; code?: number };

async function discordFetch(
  path: string,
  token: string,
  body: unknown,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; detail: string }> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    return { ok: false, status: response.status, detail };
  }
  return { ok: true, data: await response.json().catch(() => null) };
}

/**
 * Envoie un message privé au joueur. Renvoie `false` (sans lever) si le bot
 * n'est pas configuré, si l'identifiant Discord est vide ou si Discord refuse
 * la conversation (403 : le joueur ne partage aucun serveur avec le bot).
 */
export async function sendDiscordDm(discordId: string, content: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !discordId || !content) return false;

  try {
    const channel = await discordFetch("/users/@me/channels", token, {
      recipient_id: discordId,
    });
    if (!channel.ok) {
      console.error("discord_dm_channel", channel.status, channel.detail);
      return false;
    }

    const id = (channel.data as { id?: unknown } | null)?.id;
    if (typeof id !== "string") return false;

    const sent = await discordFetch(`/channels/${id}/messages`, token, { content });
    if (!sent.ok) {
      console.error("discord_dm_message", sent.status, sent.detail);
      return false;
    }
    return true;
  } catch (error) {
    console.error("discord_dm", (error as DiscordError).message ?? error);
    return false;
  }
}
