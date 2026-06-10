import { describe, expect, it } from "vitest";
import {
  buildBig3Skeleton,
  buildOffDaySkeleton,
  completedSessions,
  DEFAULT_PROGRAM_CONFIG,
  detectDeload,
  epley1RM,
  isStressSession,
  lastPerformanceFor,
  loadRange,
  mainLiftPrescription,
  movementsNeedingRotation,
  nextBig3,
  nextCalf,
  offDayNudge,
  plannedWorkingSets,
  planningAdjustment,
  rollupSummary,
  roundTo5,
  rpeDropPct,
  suggestMaxBump,
  topSetOf,
  zercherCapLbs,
  zercherTopSetTarget,
  type EngineSession,
  type EngineSet,
  type Intensity,
  type Lift,
} from "./workout-engine";

const cfg = DEFAULT_PROGRAM_CONFIG;

// --- fixtures -------------------------------------------------------------

let seq = 0;
function session(over: Partial<EngineSession> = {}): EngineSession {
  seq += 1;
  const date = over.date ?? new Date(2026, 5, seq); // June seq, local midnight
  return {
    date,
    category: "BIG3",
    mainLift: "DEADLIFT",
    intensity: "LIGHT",
    calfType: "STANDING",
    status: "COMPLETED",
    completedAt: over.completedAt ?? new Date(date.getTime() + 10 * 3600_000),
    ...over,
  };
}

function big3(
  lift: Lift,
  intensity: Intensity,
  date: Date,
  over: Partial<EngineSession> = {}
): EngineSession {
  return session({ mainLift: lift, intensity, date, ...over });
}

function mainLiftWith(sets: EngineSet[], name = "Deadlift") {
  return { block: 2, order: 0, role: "MAIN_LIFT", name, sets };
}

const d = (day: number) => new Date(2026, 5, day); // June 2026, local midnight

// --- rotation ---------------------------------------------------------------

describe("nextBig3", () => {
  it("defaults to Deadlift · Light with no history", () => {
    expect(nextBig3([])).toEqual({ lift: "DEADLIFT", intensity: "LIGHT" });
  });

  it("honors a settings override for the first session", () => {
    expect(nextBig3([], { lift: "BENCH", intensity: "HEAVY" })).toEqual({
      lift: "BENCH",
      intensity: "HEAVY",
    });
  });

  it("advances lift one step and flips intensity", () => {
    const h = [big3("DEADLIFT", "LIGHT", d(1))];
    expect(nextBig3(h)).toEqual({ lift: "BENCH", intensity: "HEAVY" });
  });

  it("reproduces the 6-session realignment cycle", () => {
    const expected: Array<[Lift, Intensity]> = [
      ["DEADLIFT", "LIGHT"],
      ["BENCH", "HEAVY"],
      ["ZERCHER", "LIGHT"],
      ["DEADLIFT", "HEAVY"],
      ["BENCH", "LIGHT"],
      ["ZERCHER", "HEAVY"],
      ["DEADLIFT", "LIGHT"], // realigns
    ];
    const history: EngineSession[] = [];
    for (let i = 0; i < expected.length; i++) {
      const next = nextBig3(history);
      expect([next.lift, next.intensity]).toEqual(expected[i]);
      history.push(big3(next.lift, next.intensity, d(i + 1)));
    }
  });

  it("ignores off-days and incomplete sessions", () => {
    const h = [
      big3("DEADLIFT", "LIGHT", d(1)),
      session({ category: "OFFDAY", mainLift: null, intensity: null, date: d(2) }),
      big3("BENCH", "HEAVY", d(3), { status: "ACTIVE", completedAt: null }),
    ];
    expect(nextBig3(h)).toEqual({ lift: "BENCH", intensity: "HEAVY" });
  });

  it("derives from the most recent completed Big-3 regardless of input order", () => {
    const h = [
      big3("DEADLIFT", "LIGHT", d(1)),
      big3("ZERCHER", "LIGHT", d(5)),
      big3("BENCH", "HEAVY", d(3)),
    ];
    expect(nextBig3(h)).toEqual({ lift: "DEADLIFT", intensity: "HEAVY" });
  });
});

describe("nextCalf", () => {
  it("defaults to Standing", () => {
    expect(nextCalf([])).toBe("STANDING");
  });

  it("flips from the most recent completed session of any type", () => {
    const h = [
      big3("DEADLIFT", "LIGHT", d(1), { calfType: "STANDING" }),
      session({
        category: "OFFDAY",
        mainLift: null,
        intensity: null,
        date: d(2),
        calfType: "SEATED",
      }),
    ];
    expect(nextCalf(h)).toBe("STANDING");
  });

  it("ignores planned/active sessions", () => {
    const h = [
      big3("DEADLIFT", "LIGHT", d(1), { calfType: "STANDING" }),
      big3("BENCH", "HEAVY", d(2), {
        calfType: "SEATED",
        status: "ACTIVE",
        completedAt: null,
      }),
    ];
    expect(nextCalf(h)).toBe("SEATED");
  });
});

describe("completedSessions ordering", () => {
  it("sorts newest-first by completedAt", () => {
    const a = big3("DEADLIFT", "LIGHT", d(1));
    const b = big3("BENCH", "HEAVY", d(3));
    const c = big3("ZERCHER", "LIGHT", d(2));
    const out = completedSessions([a, b, c]);
    expect(out.map((s) => s.mainLift)).toEqual(["BENCH", "ZERCHER", "DEADLIFT"]);
  });
});

// --- loads -------------------------------------------------------------------

describe("loads", () => {
  it("roundTo5 rounds to the nearest 5", () => {
    expect(roundTo5(172.2)).toBe(170);
    expect(roundTo5(206.64)).toBe(205);
    expect(roundTo5(247.5)).toBe(250);
  });

  it("computes the spec's example light deadlift range 60-70% → 172-201", () => {
    const r = loadRange(287, 60, 70);
    expect(r.lowLbs).toBe(172);
    expect(r.highLbs).toBe(201);
  });

  it("light prescription: 4 × 5-6 under RPE 7", () => {
    const p = mainLiftPrescription("DEADLIFT", "LIGHT", cfg, []);
    expect(p.sets).toBe(4);
    expect(p.repsRange).toBe("5-6");
    expect(p.rpeCap).toBe(7);
    expect(p.loadText).toBe("60-70% (172-201)");
    expect(p.defaultLoad).toBe(185); // plate-friendly midpoint
  });

  it("heavy prescription: 85-90%, 3-4 reps, low volume", () => {
    const p = mainLiftPrescription("BENCH", "HEAVY", cfg, []);
    expect(p.repsRange).toBe("3-4");
    expect(p.range).toMatchObject({ lowLbs: 157, highLbs: 167 });
  });

  it("applies a pct override from the fatigue protocol", () => {
    const p = mainLiftPrescription("DEADLIFT", "LIGHT", cfg, [], {
      low: 50,
      high: 60,
    });
    expect(p.loadText).toBe("50-60% (144-172)");
  });
});

describe("zercher ramp + cap", () => {
  const zsession = (day: number, load: number, rpe: number) =>
    big3("ZERCHER", "LIGHT", d(day), {
      movements: [
        mainLiftWith(
          [
            { setIndex: 0, setType: "WARMUP", load: 95, reps: 5 },
            { setIndex: 1, setType: "TOP", load, reps: 4, rpe },
          ],
          "Zercher Squat"
        ),
      ],
    });

  it("caps at zercherCapPct of DL 1RM (~205 at 72% of 287)", () => {
    expect(zercherCapLbs(cfg)).toBe(205);
  });

  it("first session ramps to 135", () => {
    const t = zercherTopSetTarget(cfg, []);
    expect(t.target).toBe(135);
  });

  it("holds after a single clean session", () => {
    const t = zercherTopSetTarget(cfg, [zsession(1, 145, 6.5)]);
    expect(t.target).toBe(145);
  });

  it("bumps +5 after two clean sessions at the same load (RPE < 7)", () => {
    const t = zercherTopSetTarget(cfg, [zsession(1, 145, 6.5), zsession(4, 145, 6.5)]);
    expect(t.target).toBe(150);
  });

  it("bumps +10 when both sessions were RPE ≤ 6", () => {
    const t = zercherTopSetTarget(cfg, [zsession(1, 145, 6), zsession(4, 145, 5.5)]);
    expect(t.target).toBe(155);
  });

  it("never exceeds the cap", () => {
    const t = zercherTopSetTarget(cfg, [zsession(1, 200, 6), zsession(4, 200, 6)]);
    expect(t.target).toBe(205);
    const over = zercherTopSetTarget(cfg, [zsession(1, 205, 6), zsession(4, 205, 6)]);
    expect(over.target).toBe(205);
  });

  it("eases ~5% after an RPE > 8 top set", () => {
    const t = zercherTopSetTarget(cfg, [zsession(1, 160, 8.5)]);
    expect(t.target).toBe(150); // 160 * 0.95 = 152 → round5 → 150
  });
});

// --- e1RM + max bump --------------------------------------------------------

describe("epley1RM", () => {
  it("matches Epley: load × (1 + reps/30)", () => {
    expect(epley1RM(260, 3)).toBeCloseTo(286, 0);
    expect(epley1RM(287, 1)).toBeCloseTo(296.57, 1);
    expect(epley1RM(300, 0)).toBe(300);
  });
});

describe("suggestMaxBump", () => {
  it("suggests when top-set e1RM beats the stored max", () => {
    const s = suggestMaxBump("DEADLIFT", { load: 275, reps: 3 }, cfg);
    expect(s).toMatchObject({ current: 287, suggested: 303 });
  });

  it("stays quiet when it doesn't", () => {
    expect(suggestMaxBump("DEADLIFT", { load: 260, reps: 3 }, cfg)).toBeNull();
    expect(suggestMaxBump("DEADLIFT", null, cfg)).toBeNull();
  });

  it("never suggests for Zercher (no stored max)", () => {
    expect(suggestMaxBump("ZERCHER", { load: 300, reps: 5 }, cfg)).toBeNull();
  });
});

// --- autoregulation ----------------------------------------------------------

describe("rpeDropPct", () => {
  it("drops 5% above RPE 8, 10% above RPE 9", () => {
    expect(rpeDropPct(8)).toBe(0);
    expect(rpeDropPct(8.5)).toBe(5);
    expect(rpeDropPct(9.5)).toBe(10);
  });
});

describe("detectDeload", () => {
  const painSession = (day: number) =>
    session({ date: d(day), flagsBorn: [{ type: "PAIN" }] });

  it("triggers on 2 pain sessions within 7 days", () => {
    const check = detectDeload([painSession(1), painSession(6)]);
    expect(check.deload).toBe(true);
  });

  it("does not trigger when the window is wider than 7 days", () => {
    const check = detectDeload([painSession(1), painSession(9)]);
    expect(check.deload).toBe(false);
  });

  it("counts extreme fatigue (RPE ≥ 9, VERY_HIGH CNS) and HIGH joint load", () => {
    const a = session({ date: d(2), sessionRPE: 9 });
    const b = session({ date: d(5), jointLoad: "HIGH" });
    expect(isStressSession(a)).toBe(true);
    expect(isStressSession(b)).toBe(true);
    expect(detectDeload([a, b]).deload).toBe(true);
  });

  it("a single stress session is not a deload", () => {
    expect(detectDeload([painSession(1)]).deload).toBe(false);
  });
});

describe("movementsNeedingRotation", () => {
  const withMoves = (day: number, names: string[]) =>
    session({
      date: d(day),
      movements: names.map((name, i) => ({
        block: 3,
        order: i,
        role: "INTEGRITY",
        name,
      })),
    });

  it("flags an accessory present in the last 3 consecutive sessions", () => {
    const h = [
      withMoves(1, ["Dead Bug", "Band Row"]),
      withMoves(3, ["Dead Bug"]),
      withMoves(5, ["Dead Bug", "Suitcase Carry"]),
    ];
    expect(movementsNeedingRotation(h)).toEqual(["Dead Bug"]);
  });

  it("a gap breaks the streak", () => {
    const h = [
      withMoves(1, ["Dead Bug"]),
      withMoves(3, ["Band Row"]),
      withMoves(5, ["Dead Bug"]),
    ];
    expect(movementsNeedingRotation(h)).toEqual([]);
  });

  it("never flags the main lift or calves", () => {
    const calfDay = (day: number) =>
      session({
        date: d(day),
        movements: [
          { block: 1, order: 0, role: "CALF", name: "Standing Calf Raise" },
          mainLiftWith([], "Deadlift"),
        ],
      });
    expect(movementsNeedingRotation([calfDay(1), calfDay(3), calfDay(5)])).toEqual([]);
  });
});

describe("planningAdjustment", () => {
  it("deload → 50-60% override plus a set cut", () => {
    const h = [
      session({ date: d(1), flagsBorn: [{ type: "PAIN" }] }),
      session({ date: d(5), flagsBorn: [{ type: "PAIN" }] }),
    ];
    const adj = planningAdjustment(h);
    expect(adj.pctOverride).toEqual({ low: 50, high: 60 });
    expect(adj.cutSets).toBe(1);
  });

  it("light day over RPE 8 → cut a set", () => {
    const h = [big3("DEADLIFT", "LIGHT", d(1), { sessionRPE: 8.5 })];
    const adj = planningAdjustment(h);
    expect(adj.cutSets).toBe(1);
    expect(adj.pctOverride).toBeUndefined();
  });

  it("off-day RPE > 6 → moderate CNS note, no cut", () => {
    const h = [
      session({
        category: "OFFDAY",
        mainLift: null,
        intensity: null,
        date: d(1),
        sessionRPE: 7,
      }),
    ];
    const adj = planningAdjustment(h);
    expect(adj.cutSets).toBe(0);
    expect(adj.notes[0]).toMatch(/moderate CNS/i);
  });

  it("clean history → no adjustment", () => {
    const adj = planningAdjustment([big3("DEADLIFT", "LIGHT", d(1), { sessionRPE: 6 })]);
    expect(adj).toEqual({ cutSets: 0, notes: [] });
  });
});

describe("offDayNudge", () => {
  it("nudges after 3 Big-3 sessions in 6 days", () => {
    const h = [
      big3("DEADLIFT", "LIGHT", d(10)),
      big3("BENCH", "HEAVY", d(12)),
      big3("ZERCHER", "LIGHT", d(14)),
    ];
    expect(offDayNudge(h, d(15))).toMatch(/3 Big-3 sessions in 6 days/);
  });

  it("stays quiet when sessions are spread out", () => {
    const h = [
      big3("DEADLIFT", "LIGHT", d(1)),
      big3("BENCH", "HEAVY", d(5)),
      big3("ZERCHER", "LIGHT", d(9)),
    ];
    expect(offDayNudge(h, d(10))).toBeNull();
  });

  it("two heavy sessions in 5 days → gentler nudge", () => {
    const h = [
      big3("DEADLIFT", "HEAVY", d(10)),
      big3("BENCH", "HEAVY", d(13)),
    ];
    expect(offDayNudge(h, d(14))).toMatch(/heavy sessions/i);
  });
});

// --- skeletons ----------------------------------------------------------------

describe("buildBig3Skeleton", () => {
  it("puts calves in Block 1 on deadlift day, Block 3 otherwise", () => {
    const dl = buildBig3Skeleton(
      { lift: "DEADLIFT", intensity: "LIGHT" },
      "STANDING",
      cfg,
      []
    );
    const calfDL = dl.movements.find((m) => m.role === "CALF")!;
    expect(calfDL.block).toBe(1);
    expect(calfDL.name).toBe("Standing Calf Raise");

    const bench = buildBig3Skeleton(
      { lift: "BENCH", intensity: "HEAVY" },
      "SEATED",
      cfg,
      []
    );
    const calfB = bench.movements.find((m) => m.role === "CALF")!;
    expect(calfB.block).toBe(3);
    expect(calfB.name).toBe("Seated Calf Raise");
  });

  it("prescribes Block 2 from the engine and tags the focus strings", () => {
    const s = buildBig3Skeleton(
      { lift: "DEADLIFT", intensity: "HEAVY" },
      "STANDING",
      cfg,
      []
    );
    const main = s.movements.find((m) => m.role === "MAIN_LIFT")!;
    expect(main.targetSets).toBe(4);
    expect(main.targetLoad).toBe("85-90% (244-258)");
    expect(s.activationFocus).toMatch(/hinge/);
    expect(s.integrityFocus).toMatch(/grip/);
  });

  it("cuts main-lift sets when the fatigue protocol says so", () => {
    const h = [big3("DEADLIFT", "LIGHT", d(1), { sessionRPE: 9, jointLoad: "HIGH" })];
    const s = buildBig3Skeleton(
      { lift: "BENCH", intensity: "HEAVY" },
      "SEATED",
      cfg,
      h
    );
    const main = s.movements.find((m) => m.role === "MAIN_LIFT")!;
    expect(main.targetSets).toBe(3);
  });

  it("planned working sets land in the 12-15 band with defaults", () => {
    const s = buildBig3Skeleton(
      { lift: "DEADLIFT", intensity: "LIGHT" },
      "STANDING",
      cfg,
      []
    );
    const planned = plannedWorkingSets(s.movements);
    expect(planned).toBeGreaterThanOrEqual(12);
    expect(planned).toBeLessThanOrEqual(15);
  });
});

describe("buildOffDaySkeleton", () => {
  it("RESET is mobility + low-load core, no main lift", () => {
    const s = buildOffDaySkeleton("RESET", "STANDING", "DEADLIFT", []);
    expect(s.movements.some((m) => m.role === "MAIN_LIFT")).toBe(false);
    expect(s.movements.filter((m) => m.role === "MOBILITY").length).toBeGreaterThanOrEqual(4);
  });

  it("TUNE primes the NEXT lift's pattern", () => {
    const s = buildOffDaySkeleton("TUNE", "STANDING", "BENCH", []);
    expect(s.description).toMatch(/Bench/);
    expect(s.movements.some((m) => m.name === "Scap Push-Up")).toBe(true);
  });

  it("BUILD continues the calf rotation", () => {
    const s = buildOffDaySkeleton("BUILD", "SEATED", "DEADLIFT", []);
    const calf = s.movements.find((m) => m.role === "CALF")!;
    expect(calf.name).toBe("Seated Calf Raise");
  });
});

// --- rollup -------------------------------------------------------------------

describe("topSetOf", () => {
  it("prefers TOP sets, falls back to heaviest non-warmup", () => {
    const s = session({
      movements: [
        mainLiftWith([
          { setIndex: 0, setType: "WARMUP", load: 135, reps: 5 },
          { setIndex: 1, setType: "WORKING", load: 245, reps: 3 },
          { setIndex: 2, setType: "TOP", load: 260, reps: 3, rpe: 8 },
          { setIndex: 3, setType: "BACKOFF", load: 225, reps: 5 },
        ]),
      ],
    });
    expect(topSetOf(s)).toMatchObject({ load: 260, reps: 3 });

    const noTop = session({
      movements: [
        mainLiftWith([
          { setIndex: 0, setType: "WARMUP", load: 135, reps: 5 },
          { setIndex: 1, setType: "WORKING", load: 245, reps: 3 },
          { setIndex: 2, setType: "WORKING", load: 245, reps: 5 },
        ]),
      ],
    });
    expect(topSetOf(noTop)).toMatchObject({ load: 245, reps: 5 });
  });
});

describe("rollupSummary", () => {
  it("computes the spec's summary: sets, main lift line, next target, e1RM", () => {
    const s = big3("DEADLIFT", "HEAVY", d(10), {
      calfType: "STANDING",
      movements: [
        // Block 1: 2 activation (2 sets actual each) + mobility (excluded) + calf 3
        { block: 1, order: 0, role: "ACTIVATION", name: "Glute Bridge", targetSets: 2, actualSets: 2 },
        { block: 1, order: 1, role: "ACTIVATION", name: "Banded Good Morning", targetSets: 2, actualSets: 2 },
        { block: 1, order: 2, role: "MOBILITY", name: "90/90 Hip Switch" },
        { block: 1, order: 3, role: "CALF", name: "Standing Calf Raise", targetSets: 3, actualSets: 3 },
        // Block 2: warmups excluded, 4 logged sets count
        mainLiftWith([
          { setIndex: 0, setType: "WARMUP", load: 135, reps: 5 },
          { setIndex: 1, setType: "WARMUP", load: 185, reps: 3 },
          { setIndex: 2, setType: "WORKING", load: 245, reps: 3, rpe: 7 },
          { setIndex: 3, setType: "TOP", load: 260, reps: 3, rpe: 8 },
          { setIndex: 4, setType: "BACKOFF", load: 225, reps: 5, rpe: 7 },
          { setIndex: 5, setType: "BACKOFF", load: 225, reps: 5, rpe: 7.5 },
        ]),
        // Block 3: 2 + 2, cardio excluded
        { block: 3, order: 0, role: "INTEGRITY", name: "Suitcase Carry", targetSets: 2, actualSets: 2 },
        { block: 3, order: 1, role: "INTEGRITY", name: "Band Pull-Apart", targetSets: 2, actualSets: 2 },
        { block: 3, order: 2, role: "CARDIO", name: "Easy Bike" },
      ],
    });

    const r = rollupSummary(s, [], cfg);
    expect(r.totalWorkingSets).toBe(2 + 2 + 3 + 4 + 2 + 2); // 15
    expect(r.mainLiftSummary).toBe("Deadlift – Heavy – Top Set: 260 × 3 @ RPE 8");
    expect(r.e1RM).toBe(286);
    expect(r.next).toEqual({ lift: "BENCH", intensity: "LIGHT" });
    expect(r.maxSuggestion).toBeNull(); // 286 < 287
  });

  it("falls back to targetSets when actuals were never logged", () => {
    const s = big3("BENCH", "LIGHT", d(11), {
      movements: [
        { block: 1, order: 0, role: "ACTIVATION", name: "Scap Push-Up", targetSets: 2 },
        mainLiftWith([{ setIndex: 0, setType: "WORKING", load: 120, reps: 6, rpe: 6 }], "Bench"),
        { block: 3, order: 0, role: "INTEGRITY", name: "Dead Bug", targetSets: 2, actualSets: 3 },
      ],
    });
    const r = rollupSummary(s, [], cfg);
    expect(r.totalWorkingSets).toBe(2 + 1 + 3);
  });

  it("surfaces a max-bump suggestion when the top set earns it", () => {
    const s = big3("BENCH", "HEAVY", d(12), {
      movements: [
        mainLiftWith([{ setIndex: 0, setType: "TOP", load: 185, reps: 4, rpe: 8.5 }], "Bench"),
      ],
    });
    const r = rollupSummary(s, [], cfg);
    expect(r.maxSuggestion).toMatchObject({ current: 185, suggested: 210 });
  });

  it("off-day rollup: counts sets, no main-lift line, rotation unaffected", () => {
    const prior = [big3("DEADLIFT", "LIGHT", d(1))];
    const s = session({
      category: "OFFDAY",
      offDayType: "RESET",
      mainLift: null,
      intensity: null,
      date: d(13),
      movements: [
        { block: 1, order: 0, role: "MOBILITY", name: "Cat-Cow" },
        { block: 3, order: 0, role: "INTEGRITY", name: "Bird Dog", targetSets: 2, actualSets: 2 },
      ],
    });
    const r = rollupSummary(s, prior, cfg);
    expect(r.totalWorkingSets).toBe(2);
    expect(r.mainLiftSummary).toBeNull();
    expect(r.next).toEqual({ lift: "BENCH", intensity: "HEAVY" });
  });
});

describe("lastPerformanceFor", () => {
  it("returns the most recent completed session + top set for the lift", () => {
    const h = [
      big3("DEADLIFT", "LIGHT", d(1), {
        movements: [mainLiftWith([{ setIndex: 0, setType: "TOP", load: 200, reps: 5, rpe: 6 }])],
      }),
      big3("DEADLIFT", "HEAVY", d(7), {
        movements: [mainLiftWith([{ setIndex: 0, setType: "TOP", load: 260, reps: 3, rpe: 8 }])],
      }),
      big3("BENCH", "LIGHT", d(9)),
    ];
    const last = lastPerformanceFor("DEADLIFT", h)!;
    expect(last.topSet).toMatchObject({ load: 260 });
    expect(lastPerformanceFor("ZERCHER", h)).toBeNull();
  });
});
