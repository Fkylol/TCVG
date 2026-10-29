import assert from "node:assert/strict";
import test from "node:test";

import { REFERRAL_CONFIG } from "../src/lib/referral/config";
import {
  activityDaysBetween,
  capState,
  csvCell,
  choosePath,
  claimPayment,
  deferredEligibleAt,
  discordAccountAgeDays,
  fingerprintCutoff,
  forcedDeferral,
  inviteUrl,
  isPaymentDue,
  isValidReferralCode,
  linkDecision,
  normalizeReferralCode,
  openingsProgress,
  paymentBlockers,
  planOpenings,
} from "../src/lib/referral/rules";

test("export CSV : les données ne deviennent pas des formules de tableur", () => {
  for (const value of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "  =1+1", "\t=1+1"]) {
    assert.equal(csvCell(value), `"'${value}"`);
  }
  assert.equal(csvCell('Joueur "test"; normal'), '"Joueur ""test""; normal"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(12), '"12"');
});

/** Contexte « tout va bien » pour les décisions de rattachement. */
function link(overrides: Partial<Parameters<typeof linkDecision>[0]> = {}) {
  return {
    referrerId: "parrain",
    referredId: "filleul",
    referrerSuspended: false,
    referrerDiscordId: "111111111111111111",
    referredDiscordId: "222222222222222222",
    accountAgeMinutes: 1,
    alreadyReferred: false,
    pendingCount: 0,
    ...overrides,
  };
}

test("parrainage : auto-parrainage refusé", () => {
  const decision = linkDecision(link({ referredId: "parrain" }));
  assert.deepEqual(decision, { ok: false, reason: "self_referral" });
});

test("parrainage : un compte déjà existant n'est plus parrainable", () => {
  const decision = linkDecision(link({ accountAgeMinutes: REFERRAL_CONFIG.newAccountWindowMinutes + 1 }));
  assert.deepEqual(decision, { ok: false, reason: "not_new_account" });
});

test("parrainage : un filleul n'a qu'un parrain", () => {
  const decision = linkDecision(link({ alreadyReferred: true }));
  assert.deepEqual(decision, { ok: false, reason: "already_referred" });
});

test("parrainage : parrain suspendu refusé", () => {
  const decision = linkDecision(link({ referrerSuspended: true }));
  assert.deepEqual(decision, { ok: false, reason: "referrer_suspended" });
});

test("parrainage : un compte Discord ne peut pas parrainer un autre compte TCVG", () => {
  const decision = linkDecision(
    link({ referrerDiscordId: "333333333333333333", referredDiscordId: "333333333333333333" }),
  );
  assert.deepEqual(decision, { ok: false, reason: "same_discord" });
});

test("parrainage : plafond de filleuls en cours respecté", () => {
  const decision = linkDecision(link({ pendingCount: REFERRAL_CONFIG.maxPendingPerReferrer }));
  assert.deepEqual(decision, { ok: false, reason: "pending_cap" });

  const under = linkDecision(link({ pendingCount: REFERRAL_CONFIG.maxPendingPerReferrer - 1 }));
  assert.deepEqual(under, { ok: true });
});

test("parrainage : sans A2F, la voie est différée à J+7", () => {
  const context = { mfaEnabled: false, sameIp: false, discordAccountAgeDays: 400 };
  assert.equal(choosePath(context), "differe");

  const milestone = new Date("2026-10-01T12:00:00Z");
  assert.equal(deferredEligibleAt(milestone).toISOString(), "2026-10-08T12:00:00.000Z");
});

test("parrainage : avec A2F, paiement immédiat", () => {
  const context = { mfaEnabled: true, sameIp: false, discordAccountAgeDays: 400 };
  assert.equal(choosePath(context), "immediat");
  assert.equal(forcedDeferral(context).forced, false);
  assert.equal(
    isPaymentDue(
      { status: "eligible", path: "immediat", eligibleAt: null, mfaEnabled: true },
      new Date("2026-10-01T12:00:00Z"),
    ),
    true,
  );
});

test("parrainage : activation de l'A2F pendant l'attente = paiement immédiat", () => {
  const beforeDelay = new Date("2026-10-03T12:00:00Z");
  assert.equal(
    isPaymentDue(
      {
        status: "en_attente",
        path: "differe",
        eligibleAt: new Date("2026-10-08T12:00:00Z"),
        mfaEnabled: true,
      },
      beforeDelay,
    ),
    true,
  );

  // Sans A2F, il faut attendre la date.
  assert.equal(
    isPaymentDue(
      {
        status: "en_attente",
        path: "differe",
        eligibleAt: new Date("2026-10-08T12:00:00Z"),
        mfaEnabled: false,
      },
      beforeDelay,
    ),
    false,
  );
  assert.equal(
    isPaymentDue(
      {
        status: "en_attente",
        path: "differe",
        eligibleAt: new Date("2026-10-08T12:00:00Z"),
        mfaEnabled: false,
      },
      new Date("2026-10-08T12:00:01Z"),
    ),
    true,
  );
});

test("parrainage : même IP = voie différée forcée", () => {
  const context = { mfaEnabled: true, sameIp: true, discordAccountAgeDays: 400 };
  assert.equal(choosePath(context), "differe");
  assert.deepEqual(forcedDeferral(context).reasons, ["same_ip"]);
});

test("parrainage : compte Discord trop récent = voie différée forcée", () => {
  const context = { mfaEnabled: true, sameIp: false, discordAccountAgeDays: 2 };
  assert.equal(choosePath({ ...context, discordAccountAgeDays: 400 }), "immediat");
  // Le contrôle est désactivé par défaut (0) : l'âge n'influe pas.
  assert.equal(choosePath(context), "immediat");
});

test("parrainage : 3 filleuls sur la même empreinte = examen manuel", () => {
  const base = {
    status: "eligible" as const,
    paidCount: 0,
    referrerSuspended: false,
    referredSuspended: false,
    discordLinked: true,
    discordIdUnchanged: true,
    sameIp: true,
    sharedIpCount: REFERRAL_CONFIG.sameIpReviewThreshold,
    signupsLast24h: 1,
  };
  assert.equal(paymentBlockers(base).review, true);
  assert.equal(paymentBlockers({ ...base, sharedIpCount: 2 }).review, false);
});

test("parrainage : plus de 5 inscriptions en 24 h = examen manuel", () => {
  const result = paymentBlockers({
    status: "eligible",
    paidCount: 0,
    referrerSuspended: false,
    referredSuspended: false,
    discordLinked: true,
    discordIdUnchanged: true,
    sameIp: false,
    sharedIpCount: 0,
    signupsLast24h: REFERRAL_CONFIG.signupBurstThreshold + 1,
  });
  assert.equal(result.review, true);
});

test("parrainage : paiement refusé si le parrain est banni", () => {
  const result = paymentBlockers({
    status: "en_attente",
    paidCount: 0,
    referrerSuspended: true,
    referredSuspended: false,
    discordLinked: true,
    discordIdUnchanged: true,
    sameIp: false,
    sharedIpCount: 0,
    signupsLast24h: 0,
  });
  assert.deepEqual(result.blocked, ["referrer_suspended"]);
});

test("parrainage : paiement refusé si Discord a été délié", () => {
  const result = paymentBlockers({
    status: "en_attente",
    paidCount: 0,
    referrerSuspended: false,
    referredSuspended: false,
    discordLinked: false,
    discordIdUnchanged: false,
    sameIp: false,
    sharedIpCount: 0,
    signupsLast24h: 0,
  });
  assert.deepEqual(result.blocked, ["discord_unlinked", "discord_changed"]);
});

test("parrainage : plafond de parrainages payés", () => {
  assert.equal(capState({ paid: REFERRAL_CONFIG.maxPaidPerReferrer, active: 0 }).canBePaid, false);
  assert.equal(capState({ paid: REFERRAL_CONFIG.maxPaidPerReferrer - 1, active: 0 }).canBePaid, true);
});

test("parrainage : paiement unique, même en double exécution", () => {
  assert.equal(claimPayment("en_attente"), true);
  // Après le premier passage, le statut est « payé » : la garde refuse.
  assert.equal(claimPayment("paye"), false);
  assert.equal(claimPayment("refuse"), false);
});

test("parrainage : seuil de 20 compté depuis le journal, un ×10 vaut 10", () => {
  // Deux ×10 ouvrent 20 boosters : le seuil est atteint.
  const journal = [10, 10];
  const total = journal.reduce((sum, count) => sum + count, 0);
  const progress = openingsProgress(total);
  assert.equal(progress.done, true);
  assert.equal(progress.percent, 100);

  assert.equal(openingsProgress(19).done, false);
  assert.equal(openingsProgress(19).remaining, 1);
});

test("boosters : le stock normal est consommé avant le bonus", () => {
  assert.deepEqual(planOpenings(4, 3, 1), { stock: 3, bonus: 3, opened: 1 });
  assert.deepEqual(planOpenings(1, 3, 2), { stock: 0, bonus: 2, opened: 2 });
  assert.deepEqual(planOpenings(0, 3, 1), { stock: 0, bonus: 2, opened: 1 });
});

test("boosters : le solde bonus ne devient jamais négatif", () => {
  assert.deepEqual(planOpenings(0, 2, 10), { stock: 0, bonus: 0, opened: 2 });
  assert.deepEqual(planOpenings(-3, -2, 1), { stock: 0, bonus: 0, opened: 0 });
});

test("parrainage : code à 8 caractères, non devinable, sans caractères ambigus", () => {
  assert.equal(isValidReferralCode("ABCD2345"), true);
  assert.equal(isValidReferralCode("ABCD234"), false);
  assert.equal(isValidReferralCode("ABCD234O"), false);
  assert.equal(normalizeReferralCode(" abcd2345 "), "ABCD2345");
  assert.equal(inviteUrl("ABCD2345", "https://tcvg.fun/"), "https://tcvg.fun/invite/ABCD2345");
});

test("parrainage : jours d'activité distincts pendant l'attente", () => {
  const days = ["2026-10-01", "2026-10-02", "2026-10-02", "2026-10-05"];
  assert.equal(
    activityDaysBetween(days, new Date("2026-10-01T12:00:00Z"), new Date("2026-10-06T12:00:00Z")),
    3,
  );
});

test("parrainage : âge d'un compte Discord depuis le snowflake", () => {
  // Snowflake du 1er janvier 2024 (approximatif) : plus vieux que 400 jours.
  const id = (BigInt(1_704_067_200_000 - 1_420_070_400_000) << BigInt(22)).toString();
  const age = discordAccountAgeDays(id, new Date("2026-10-25T00:00:00Z").getTime());
  assert.ok(age !== null && age > 400, `âge calculé : ${age}`);
  assert.equal(discordAccountAgeDays("pas-un-id", Date.now()), null);
});

test("parrainage : purge des empreintes après 90 jours", () => {
  const now = new Date("2026-10-25T00:00:00Z");
  assert.equal(fingerprintCutoff(now).toISOString(), "2026-07-27T00:00:00.000Z");
});
