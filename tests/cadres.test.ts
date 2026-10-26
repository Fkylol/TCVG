import assert from "node:assert/strict";
import test from "node:test";
import {
  FRAMES,
  FRAME_FEATURES,
  bestUnlockedFrame,
  evaluateFrameSet,
  frameDisplayName,
  frameProgress,
  getFrame,
  nextFrameToUnlock,
  percentTarget,
  resolveSelectedFrame,
  shouldAnimateFrame,
  type FrameStats,
} from "@/lib/frames.config";

function stats(overrides: Partial<FrameStats> = {}): FrameStats {
  return {
    totalActive: 100,
    ownedDistinct: 0,
    rarities: { UR: { total: 10, owned: 0 }, L: { total: 4, owned: 0 } },
    genres: {},
    franchises: [],
    sales: 0,
    referralsPaid: 0,
    boostersOpened: 0,
    streakDays: 0,
    createdAt: "2026-10-25T10:00:00Z",
    lastSeenAt: null,
    ...overrides,
  };
}

function progress(frameId: string, value: FrameStats, unlocked = false) {
  const frame = getFrame(frameId);
  assert.ok(frame);
  return frameProgress(frame, value, {
    now: new Date("2026-10-25T12:00:00Z"),
    unlocked,
  });
}

test("le seuil de l'album suit le nombre de cartes actives", () => {
  const frame = getFrame("gold");
  assert.ok(frame);

  const small = stats({ totalActive: 100, ownedDistinct: 60 });
  const large = stats({ totalActive: 200, ownedDistinct: 60 });

  assert.equal(progress("gold", small).reached, true);
  assert.equal(progress("gold", small).target, 60);
  assert.equal(progress("gold", large).reached, false);
  assert.equal(progress("gold", large).target, 120);
  assert.equal(percentTarget(357, 60), 215);
});

test("les doublons ne comptent pas : ownedDistinct fait foi", () => {
  const value = stats({ totalActive: 100, ownedDistinct: 59 });
  assert.equal(progress("gold", value).current, 59);
  assert.equal(progress("gold", value).reached, false);
  assert.match(progress("gold", value).remaining, /1 personnage/);
});

test("Prisme et Complétiste ne tombent pas avant leur seuil", () => {
  assert.equal(progress("prism", stats({ ownedDistinct: 89 })).reached, false);
  assert.equal(progress("prism", stats({ ownedDistinct: 90 })).reached, true);
  assert.equal(progress("completionist", stats({ ownedDistinct: 99 })).reached, false);
  assert.equal(progress("completionist", stats({ ownedDistinct: 100 })).reached, true);
});

test("un genre sous MIN_POOL_SIZE reste « bientôt » même avec 100 %", () => {
  const soon = stats({
    genres: { horreur: { total: 10, owned: 10 } },
  });
  const state = progress("genre-horreur", soon);
  assert.equal(state.soon, true);
  assert.equal(state.reached, false);
  assert.equal(state.target, 10);

  const open = stats({
    genres: { horreur: { total: 15, owned: 15 } },
  });
  assert.equal(progress("genre-horreur", open).soon, false);
  assert.equal(progress("genre-horreur", open).reached, true);
});

test("les cadres de genre reprennent les couleurs des packs", () => {
  const action = getFrame("genre-action-aventure");
  assert.ok(action);
  assert.deepEqual(action.colors, ["#86d9b0", "#1f6e55"]);
  assert.equal(action.motif, "action-aventure");
});

test("le secret est masqué avant son obtention mais reste évalué", () => {
  const fan = getFrame("absolute-fan");
  assert.ok(fan);

  const value = stats({
    franchises: [
      { slug: "mario", name: "Super Mario", total: 8, owned: 8 },
      { slug: "zelda", name: "Zelda", total: 20, owned: 2 },
    ],
  });

  const hidden = progress("absolute-fan", value, false);
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.condition, "???");
  assert.equal(frameDisplayName(fan, false), "???");
  assert.equal(hidden.reached, true);

  const visible = progress("absolute-fan", value, true);
  assert.equal(visible.hidden, false);
  assert.equal(visible.reached, true);
  assert.match(visible.detail, /Super Mario/);
});

test("une franchise sous 8 personnages ne débloque pas le secret", () => {
  const value = stats({
    franchises: [{ slug: "petite", name: "Petite", total: 7, owned: 7 }],
  });
  assert.equal(progress("absolute-fan", value).reached, false);
});

test("Pionnier ne s'obtient qu'avant la date, une seule fois", () => {
  const before = stats({ createdAt: "2026-10-20T10:00:00Z" });
  const after = stats({ createdAt: "2026-11-02T10:00:00Z" });

  assert.equal(progress("pioneer", before).reached, true);
  assert.equal(progress("pioneer", after).reached, false);

  const first = evaluateFrameSet({
    stats: before,
    unlocked: [{ frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" }],
    pending: [],
    now: new Date("2026-10-25T12:00:00Z"),
  });
  assert.ok(first.newUnlockedIds.includes("pioneer"));

  const second = evaluateFrameSet({
    stats: before,
    unlocked: first.unlocks.map((frame) => ({
      frameId: frame.id,
      unlockedAt: "2026-10-25T12:00:00Z",
    })),
    pending: [],
    now: new Date("2026-10-26T12:00:00Z"),
  });
  assert.equal(second.newUnlockedIds.includes("pioneer"), false);
});

test("un cadre débloqué reste acquis après une vente", () => {
  const full = stats({ ownedDistinct: 100, createdAt: "2027-01-01T00:00:00Z" });
  const evaluation = evaluateFrameSet({
    stats: full,
    unlocked: [{ frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" }],
    pending: [],
    now: new Date("2026-10-25T12:00:00Z"),
  });
  assert.ok(evaluation.newUnlockedIds.includes("completionist"));

  const unlocked = [
    { frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" },
    ...evaluation.unlocks.map((frame) => ({
      frameId: frame.id,
      unlockedAt: "2026-10-25T12:00:00Z",
    })),
  ];

  const afterSale = evaluateFrameSet({
    stats: stats({ ownedDistinct: 5, createdAt: "2027-01-01T00:00:00Z" }),
    unlocked,
    pending: [],
    now: new Date("2026-10-26T12:00:00Z"),
  });

  assert.equal(afterSale.newUnlockedIds.length, 0);
  assert.equal(afterSale.pendingRemove.length, 0);
  assert.equal(
    resolveSelectedFrame(
      "completionist",
      unlocked.map((entry) => entry.frameId),
    ),
    "completionist",
  );
});

test("une sélection invalide retombe sur le meilleur cadre débloqué", () => {
  const unlocked = ["steel", "jade", "platinum"];
  assert.equal(resolveSelectedFrame("gold", unlocked), "platinum");
  assert.equal(resolveSelectedFrame("mythic", unlocked), "platinum");
  assert.equal(resolveSelectedFrame("completionist", unlocked), "platinum");
  assert.equal(resolveSelectedFrame(null, ["steel"]), "steel");
  assert.equal(bestUnlockedFrame(unlocked), "platinum");
});

test("un cadre désactivé par l'administration n'est plus sélectionnable", () => {
  assert.equal(
    resolveSelectedFrame("platinum", ["steel", "platinum"], ["platinum"]),
    "steel",
  );
});

test("le prochain cadre le plus proche ignore les secrets et les indisponibles", () => {
  const value = stats({ ownedDistinct: 59, totalActive: 100 });
  const evaluation = evaluateFrameSet({
    stats: value,
    unlocked: [{ frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" }],
    pending: [],
    now: new Date("2026-10-25T12:00:00Z"),
  });

  const next = nextFrameToUnlock(evaluation.progress, ["steel"]);
  assert.equal(next?.frame.id, "gold");
  assert.match(next?.progress.remaining ?? "", /1 personnage/);
});

test("les animations respectent reduced-motion, la visibilité et le budget", () => {
  assert.equal(
    shouldAnimateFrame({ animated: true, reducedMotion: false, visible: true, activeAnimated: 0 }),
    true,
  );
  assert.equal(
    shouldAnimateFrame({ animated: true, reducedMotion: true, visible: true, activeAnimated: 0 }),
    false,
  );
  assert.equal(
    shouldAnimateFrame({ animated: true, reducedMotion: false, visible: false, activeAnimated: 0 }),
    false,
  );
  assert.equal(
    shouldAnimateFrame({
      animated: true,
      reducedMotion: false,
      visible: true,
      activeAnimated: FRAME_FEATURES.maxAnimatedAtOnce,
    }),
    false,
  );
});

test("le maintien optionnel retarde les prestiges 4 et 5", () => {
  const full = stats({ ownedDistinct: 100 });
  const first = evaluateFrameSet({
    stats: full,
    unlocked: [{ frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" }],
    pending: [],
    now: new Date("2026-10-25T12:00:00Z"),
    maintenanceHours: 24,
  });

  assert.ok(first.pendingAdd.includes("platinum"));
  assert.equal(first.newUnlockedIds.includes("platinum"), false);

  const tooEarly = evaluateFrameSet({
    stats: full,
    unlocked: [{ frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" }],
    pending: [{ frameId: "platinum", firstMetAt: "2026-10-25T12:00:00Z" }],
    now: new Date("2026-10-26T11:00:00Z"),
    maintenanceHours: 24,
  });
  assert.equal(tooEarly.newUnlockedIds.includes("platinum"), false);

  const ready = evaluateFrameSet({
    stats: full,
    unlocked: [{ frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" }],
    pending: [{ frameId: "platinum", firstMetAt: "2026-10-25T12:00:00Z" }],
    now: new Date("2026-10-26T12:01:00Z"),
    maintenanceHours: 24,
  });
  assert.ok(ready.newUnlockedIds.includes("platinum"));
});

test("Chasseur de légendes et Panthéon comptent sur les raretés actives", () => {
  assert.equal(
    progress("legends-hunter", stats({ rarities: { UR: { total: 10, owned: 4 }, L: { total: 4, owned: 0 } } }))
      .reached,
    false,
  );
  assert.equal(
    progress("legends-hunter", stats({ rarities: { UR: { total: 10, owned: 5 }, L: { total: 4, owned: 0 } } }))
      .reached,
    true,
  );
  assert.equal(
    progress("pantheon", stats({ rarities: { UR: { total: 10, owned: 0 }, L: { total: 4, owned: 2 } } }))
      .reached,
    true,
  );
});

test("Élu exige toutes les Mythiques actives", () => {
  assert.equal(
    progress("chosen", stats({ rarities: { UR: { total: 10, owned: 10 }, L: { total: 4, owned: 3 } } }))
      .reached,
    false,
  );
  assert.equal(
    progress("chosen", stats({ rarities: { UR: { total: 10, owned: 0 }, L: { total: 4, owned: 4 } } }))
      .reached,
    true,
  );
});

test("les cadres de saison et désactivés sont indisponibles", () => {
  const season = getFrame("season-example");
  assert.ok(season);
  assert.equal(season.active, false);
  assert.equal(
    frameProgress(season, stats(), { now: new Date("2026-10-25T12:00:00Z") }).available,
    false,
  );

  const prism = getFrame("prism");
  assert.ok(prism);
  const disabled = frameProgress(prism, stats({ ownedDistinct: 100 }), {
    now: new Date("2026-10-25T12:00:00Z"),
    disabled: ["prism"],
  });
  assert.equal(disabled.available, false);
  assert.equal(disabled.reached, false);
});

test("chaque cadre expose les champs attendus et un identifiant unique", () => {
  const ids = new Set<string>();
  for (const frame of FRAMES) {
    assert.ok(frame.id);
    assert.ok(frame.name);
    assert.ok(frame.prestige >= 1 && frame.prestige <= 5);
    assert.ok(frame.colors.length >= 2);
    assert.ok(["linear", "conic"].includes(frame.gradient));
    assert.equal(typeof frame.secret, "boolean");
    assert.equal(typeof frame.active, "boolean");
    assert.ok(!ids.has(frame.id), `identifiant dupliqué : ${frame.id}`);
    ids.add(frame.id);
  }
});

test("un cadre ajouté à la configuration est évalué sans autre changement", () => {
  const full = stats({
    ownedDistinct: 100,
    rarities: { UR: { total: 10, owned: 10 }, L: { total: 4, owned: 4 } },
    streakDays: 30,
    boostersOpened: 2000,
    referralsPaid: 5,
    sales: 50,
  });
  const evaluation = evaluateFrameSet({
    stats: full,
    unlocked: [{ frameId: "steel", unlockedAt: "2026-10-20T10:00:00Z" }],
    pending: [],
    now: new Date("2026-10-25T12:00:00Z"),
  });

  for (const id of ["regular", "grand-opener", "ambassador", "merchant", "chosen", "prism"]) {
    assert.ok(evaluation.newUnlockedIds.includes(id), `${id} devrait être débloqué`);
  }
});
