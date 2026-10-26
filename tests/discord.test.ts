import assert from "node:assert/strict";
import test from "node:test";

import { sendDiscordDm, swapOfferDmText } from "../src/lib/discord";

const BASE = {
  owner: "Kaito",
  proposer: "Nova",
  offered: "Arthas",
  requested: "Yshtola",
};

test("MP d'échange : proposeur, cartes et lien vers les offres", () => {
  const text = swapOfferDmText(BASE);
  assert.match(text, /Nova/);
  assert.match(text, /Arthas/);
  assert.match(text, /Yshtola/);
  assert.match(text, /\/agora\/offres/);
  assert.match(text, /24 h/);
});

test("MP d'échange : une annonce « Je cherche » ne nomme pas de carte demandée", () => {
  const text = swapOfferDmText({ ...BASE, requested: null });
  assert.match(text, /la carte de ton choix/);
  assert.doesNotMatch(text, /Yshtola/);
});

test("MP d'échange : le message joint est repris, sans mention Discord", () => {
  const text = swapOfferDmText({ ...BASE, message: "  Ça t'intéresse ? @everyone  " });
  assert.match(text, /« Ça t'intéresse \? @everyone »/);
  // Aucune mention n'est ajoutée par le bot lui-même (le contenu du joueur, lui,
  // est échappé par Discord à l'affichage).
  assert.doesNotMatch(text, /<@&?\d+>/);
});

test("MP d'échange : la durée suit l'offre et le texte reste sous la limite Discord", () => {
  assert.match(swapOfferDmText({ ...BASE, hours: 12 }), /12 h/);

  const long = swapOfferDmText({ ...BASE, offered: "A".repeat(4000) });
  assert.ok(long.length <= 1900, `${long.length} caractères`);
  assert.match(long, /…$/);
});

test("MP Discord : sans jeton de bot, rien n'est envoyé (aucune requête)", async () => {
  const previous = process.env.DISCORD_BOT_TOKEN;
  delete process.env.DISCORD_BOT_TOKEN;

  try {
    assert.equal(await sendDiscordDm("123456789012345678", "coucou"), false);
    assert.equal(await sendDiscordDm("", "coucou"), false);
  } finally {
    if (previous !== undefined) process.env.DISCORD_BOT_TOKEN = previous;
  }
});
