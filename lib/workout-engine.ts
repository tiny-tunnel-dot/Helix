import { differenceInCalendarDays } from "date-fns";

// Milo workout module — deterministic rules engine.
//
// The workout analog of lib/protocol.ts: pure functions, fixed math, no LLM.
// Rotation, %1RM loads, Zercher ramp + cap, autoregulation triggers, deload
// detection, movement-rotation checks, and the session-summary rollup all live
// here and are unit-tested. The LLM (lib/milo.ts) reads this engine's output;
// it never recomputes it.
//
// Allowed values for the String columns in prisma/schema.prisma are the
// exported union types below, mirroring how lib/protocol.ts documents the
// peptide models.

// ---------------------------------------------------------------------------
// Allowed values (DB string columns) + labels
// ---------------------------------------------------------------------------

export type Lift = "DEADLIFT" | "BENCH" | "ZERCHER";
export type Intensity = "LIGHT" | "HEAVY";
export type CalfType = "STANDING" | "SEATED";
export type SessionCategory = "BIG3" | "OFFDAY";
export type OffDayType = "RESET" | "TUNE" | "BUILD";
export type SessionStatus = "PLANNED" | "ACTIVE" | "COMPLETED";
export type MovementRole =
  | "ACTIVATION"
  | "MOBILITY"
  | "CALF"
  | "MAIN_LIFT"
  | "COMPLEMENTARY"
  | "INTEGRITY"
  | "CARDIO";
export type SetType = "WARMUP" | "WORKING" | "TOP" | "BACKOFF";
export type FlagType =
  | "PAIN"
  | "FATIGUE"
  | "TIGHTNESS"
  | "REGRESSION"
  | "DELOAD"
  | "OTHER";
export type FlagStatus = "ACTIVE" | "RESOLVED";
export type FlagSeverity = "LOW" | "MED" | "HIGH";
export type CnsLoad = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
export type JointLoad = "LOW" | "MODERATE" | "HIGH";

export const LIFT_ORDER: readonly Lift[] = ["DEADLIFT", "BENCH", "ZERCHER"];

export const LIFT_LABEL: Record<Lift, string> = {
  DEADLIFT: "Deadlift",
  BENCH: "Bench",
  ZERCHER: "Zercher Squat",
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  LIGHT: "Light",
  HEAVY: "Heavy",
};

export const CALF_LABEL: Record<CalfType, string> = {
  STANDING: "Standing",
  SEATED: "Seated",
};

export const CALF_MOVEMENT_NAME: Record<CalfType, string> = {
  STANDING: "Standing Calf Raise",
  SEATED: "Seated Calf Raise",
};

export const OFFDAY_LABEL: Record<OffDayType, string> = {
  RESET: "Reset + Restore",
  TUNE: "Tune the Engine",
  BUILD: "Build Without Burnout",
};

export const CNS_LOAD_VALUES: readonly CnsLoad[] = [
  "LOW",
  "MODERATE",
  "HIGH",
  "VERY_HIGH",
];
export const JOINT_LOAD_VALUES: readonly JointLoad[] = [
  "LOW",
  "MODERATE",
  "HIGH",
];
export const FLAG_TYPE_VALUES: readonly FlagType[] = [
  "PAIN",
  "FATIGUE",
  "TIGHTNESS",
  "REGRESSION",
  "DELOAD",
  "OTHER",
];
export const GRADE_VALUES: readonly string[] = [
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "D",
];

// Block 1 / Block 3 must match the day's lift (spec §3.4). The engine emits
// Block 1/3 slots tagged with these focus strings; the LLM swaps in concrete
// movements that serve them.
export const ACTIVATION_FOCUS: Record<Lift, string> = {
  DEADLIFT: "glutes, hamstrings, hinge drills, spinal priming",
  BENCH: "scapular mobility, triceps pre-fatigue, chest openers",
  ZERCHER: "core bracing, front-rack/posture drills, squat priming",
};

export const INTEGRITY_FOCUS: Record<Lift, string> = {
  DEADLIFT: "grip, anti-flexion core, upper back",
  BENCH: "rear delts, rotator cuff, anti-extension core",
  ZERCHER: "mid-back, adductors, anti-rotation, postural core",
};

// ---------------------------------------------------------------------------
// Engine input shapes
//
// Structural subsets of the Prisma rows (WorkoutSession + movements + sets +
// flagsBorn) so query results pass straight in and tests build plain objects.
// `date` must be a local-midnight Date (run Prisma @db.Date values through
// fromPrismaDate first).
// ---------------------------------------------------------------------------

export type EngineSet = {
  setIndex: number;
  setType: string; // SetType
  load: number;
  reps: number;
  rpe?: number | null;
};

export type EngineMovement = {
  block: number;
  order: number;
  role: string; // MovementRole
  name: string;
  targetSets?: number | null;
  actualSets?: number | null;
  sets?: EngineSet[];
};

export type EngineFlag = {
  type: string; // FlagType
  severity?: string | null;
  status?: string;
};

export type EngineSession = {
  date: Date;
  category: string; // SessionCategory
  mainLift?: string | null;
  intensity?: string | null;
  offDayType?: string | null;
  calfType: string; // CalfType
  status: string; // SessionStatus
  sessionRPE?: number | null;
  cnsLoad?: string | null;
  jointLoad?: string | null;
  completedAt?: Date | null;
  movements?: EngineMovement[];
  flagsBorn?: EngineFlag[];
};

export type ProgramConfigLike = {
  deadlift1RM: number;
  bench1RM: number;
  zercherCapPct: number;
  lightPctLow: number;
  lightPctHigh: number;
  heavyPctLow: number;
  heavyPctHigh: number;
};

export const DEFAULT_PROGRAM_CONFIG: ProgramConfigLike = {
  deadlift1RM: 287,
  bench1RM: 185,
  zercherCapPct: 72,
  lightPctLow: 60,
  lightPctHigh: 70,
  heavyPctLow: 85,
  heavyPctHigh: 90,
};

// Newest-first completed sessions. completedAt is the tiebreaker within a
// calendar date (two sessions on the same day stay in completion order).
export function completedSessions(history: EngineSession[]): EngineSession[] {
  return history
    .filter((s) => s.status === "COMPLETED")
    .sort((a, b) => {
      const ta = (a.completedAt ?? a.date).getTime();
      const tb = (b.completedAt ?? b.date).getTime();
      return tb - ta;
    });
}

// ---------------------------------------------------------------------------
// Rotation — three dials (spec §3.1)
// ---------------------------------------------------------------------------

export type Big3Target = { lift: Lift; intensity: Intensity };

const FIRST_SESSION_DEFAULT: Big3Target = {
  lift: "DEADLIFT",
  intensity: "LIGHT",
};

// Next Big-3 = advance lift one step and flip intensity, derived from the most
// recent COMPLETED Big-3 session. Off-days never move this dial.
export function nextBig3(
  history: EngineSession[],
  firstSession: Big3Target = FIRST_SESSION_DEFAULT
): Big3Target {
  const last = completedSessions(history).find(
    (s) => s.category === "BIG3" && s.mainLift && s.intensity
  );
  if (!last) return firstSession;

  const idx = LIFT_ORDER.indexOf(last.mainLift as Lift);
  const lift = LIFT_ORDER[(idx + 1) % LIFT_ORDER.length];
  const intensity: Intensity = last.intensity === "LIGHT" ? "HEAVY" : "LIGHT";
  return { lift, intensity };
}

// Calf dial flips on EVERY completed session, both categories (spec §3.1).
export function nextCalf(history: EngineSession[]): CalfType {
  const last = completedSessions(history)[0];
  if (!last) return "STANDING";
  return last.calfType === "STANDING" ? "SEATED" : "STANDING";
}

// ---------------------------------------------------------------------------
// Loads (spec §3.2)
// ---------------------------------------------------------------------------

export function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function oneRMFor(lift: Lift, cfg: ProgramConfigLike): number | null {
  if (lift === "DEADLIFT") return cfg.deadlift1RM;
  if (lift === "BENCH") return cfg.bench1RM;
  return null; // Zercher runs on ramp + cap, not a stored 1RM
}

export type LoadRange = {
  pctLow: number;
  pctHigh: number;
  lowLbs: number; // exact lbs (rounded to 1)
  highLbs: number;
};

export function loadRange(
  oneRM: number,
  pctLow: number,
  pctHigh: number
): LoadRange {
  return {
    pctLow,
    pctHigh,
    lowLbs: Math.round((oneRM * pctLow) / 100),
    highLbs: Math.round((oneRM * pctHigh) / 100),
  };
}

export function zercherCapLbs(cfg: ProgramConfigLike): number {
  return roundTo5((cfg.deadlift1RM * cfg.zercherCapPct) / 100);
}

// Top set of a session's main lift: heaviest non-warmup set, preferring an
// explicitly TOP-typed set; ties go to more reps.
export function topSetOf(session: EngineSession): EngineSet | null {
  const main = session.movements?.find((m) => m.role === "MAIN_LIFT");
  const sets = (main?.sets ?? []).filter((s) => s.setType !== "WARMUP");
  if (sets.length === 0) return null;
  const pick = (list: EngineSet[]) =>
    [...list].sort((a, b) => b.load - a.load || b.reps - a.reps)[0];
  const tops = sets.filter((s) => s.setType === "TOP");
  return pick(tops.length > 0 ? tops : sets);
}

// Most recent completed Big-3 session for a given lift, with its top set —
// pre-fills logger cards and anchors LLM context.
export function lastPerformanceFor(
  lift: Lift,
  history: EngineSession[]
): { session: EngineSession; topSet: EngineSet | null } | null {
  const last = completedSessions(history).find(
    (s) => s.category === "BIG3" && s.mainLift === lift
  );
  if (!last) return null;
  return { session: last, topSet: topSetOf(last) };
}

export type MainLiftPrescription = {
  lift: Lift;
  intensity: Intensity;
  sets: number;
  repsRange: string;
  rpeCap: number;
  range: LoadRange | null; // null for Zercher
  defaultLoad: number; // plate-friendly pre-fill for the logger
  capLbs: number | null; // Zercher only
  loadText: string;
  notes: string[];
};

// Zercher ramp: hold the last top-set load; after 2 consecutive sessions at
// the same load with top RPE < 7, suggest +5 (or +10 when both were ≤ 6).
// A top RPE > 8 walks the target back ~5%. Always clamped to the cap
// (zercherCapPct of DL 1RM, ~200 lb). First session ramps to 135 (the top of
// the reference's 95-135 form-focus band).
export function zercherTopSetTarget(
  cfg: ProgramConfigLike,
  history: EngineSession[]
): { target: number; cap: number; note: string } {
  const cap = zercherCapLbs(cfg);
  const zSessions = completedSessions(history).filter(
    (s) => s.category === "BIG3" && s.mainLift === "ZERCHER"
  );
  const tops = zSessions
    .map((s) => topSetOf(s))
    .filter((t): t is EngineSet => t !== null);

  if (tops.length === 0) {
    return {
      target: Math.min(135, cap),
      cap,
      note: "First Zercher session — ramp to a top set of 3-5, form focus.",
    };
  }

  const last = tops[0];
  if (last.rpe != null && last.rpe > 8) {
    const reduced = Math.min(roundTo5(last.load * 0.95), cap);
    return {
      target: reduced,
      cap,
      note: `Last top set ran RPE ${last.rpe} — easing the target ~5% to ${reduced}.`,
    };
  }

  const prev = tops[1];
  const twoCleanAtSameLoad =
    prev != null &&
    prev.load === last.load &&
    last.rpe != null &&
    prev.rpe != null &&
    last.rpe < 7 &&
    prev.rpe < 7;

  if (twoCleanAtSameLoad) {
    const bump = last.rpe! <= 6 && prev.rpe! <= 6 ? 10 : 5;
    const target = Math.min(last.load + bump, cap);
    const capped = last.load + bump > cap;
    return {
      target,
      cap,
      note: capped
        ? `Progression earned, but the ${cap} lb cap (${cfg.zercherCapPct}% of DL 1RM) holds the top set at ${target}.`
        : `Two clean sessions at ${last.load} (RPE < 7) — progress the top set to ${target}.`,
    };
  }

  return {
    target: Math.min(last.load, cap),
    cap,
    note: `Hold the top set at ${Math.min(last.load, cap)}; earn the bump with a second clean session (RPE < 7).`,
  };
}

// Block 2 prescription (spec §3.2). `pctOverride` comes from autoregulation
// (e.g. fatigue protocol's 50-60% arm).
export function mainLiftPrescription(
  lift: Lift,
  intensity: Intensity,
  cfg: ProgramConfigLike,
  history: EngineSession[],
  pctOverride?: { low: number; high: number }
): MainLiftPrescription {
  if (lift === "ZERCHER") {
    const { target, cap, note } = zercherTopSetTarget(cfg, history);
    return {
      lift,
      intensity,
      sets: 4,
      repsRange: "3-5",
      rpeCap: 7,
      range: null,
      defaultLoad: target,
      capLbs: cap,
      loadText: `Ramp to a top set of 3-5 @ ~${target} (cap ${cap})`,
      notes: [note],
    };
  }

  const oneRM = oneRMFor(lift, cfg)!;
  const light = intensity === "LIGHT";
  const pctLow = pctOverride?.low ?? (light ? cfg.lightPctLow : cfg.heavyPctLow);
  const pctHigh =
    pctOverride?.high ?? (light ? cfg.lightPctHigh : cfg.heavyPctHigh);
  const range = loadRange(oneRM, pctLow, pctHigh);
  const notes: string[] = [];
  if (pctOverride) {
    notes.push(
      `Loads pulled to ${pctLow}-${pctHigh}% by the fatigue protocol.`
    );
  } else {
    notes.push(
      light
        ? "Bar-speed focus; every rep crisp, RPE under 7."
        : "Keep heavy-day volume low; stop sets shy of grinding."
    );
  }

  return {
    lift,
    intensity,
    sets: 4,
    repsRange: light ? "5-6" : "3-4",
    rpeCap: light ? 7 : 9,
    range,
    defaultLoad: roundTo5((range.lowLbs + range.highLbs) / 2),
    capLbs: null,
    loadText: `${pctLow}-${pctHigh}% (${range.lowLbs}-${range.highLbs})`,
    notes,
  };
}

// ---------------------------------------------------------------------------
// e1RM + max-bump suggestions (spec §3.7 + open decision: suggest, never
// auto-overwrite)
// ---------------------------------------------------------------------------

// Epley. reps = 1 returns the load itself.
export function epley1RM(load: number, reps: number): number {
  return load * (1 + reps / 30);
}

export type MaxSuggestion = {
  lift: Lift;
  current: number;
  suggested: number;
  fromSet: { load: number; reps: number };
};

// When a top set's e1RM beats the stored 1RM, suggest the bump (Tony confirms
// with a tap in the UI; the engine never writes maxes).
export function suggestMaxBump(
  lift: Lift,
  topSet: { load: number; reps: number } | null,
  cfg: ProgramConfigLike
): MaxSuggestion | null {
  if (!topSet) return null;
  const current = oneRMFor(lift, cfg);
  if (current == null) return null;
  const suggested = Math.round(epley1RM(topSet.load, topSet.reps));
  if (suggested <= current) return null;
  return { lift, current, suggested, fromSet: topSet };
}

// ---------------------------------------------------------------------------
// Autoregulation (spec §3.3)
// ---------------------------------------------------------------------------

// Mid-session rule: RPE > 8 at the prescribed % → drop 5-10% for the session.
// Severity scales the drop. Returns whole percentage points of 1RM.
export function rpeDropPct(reportedRPE: number): number {
  if (reportedRPE > 9) return 10;
  if (reportedRPE > 8) return 5;
  return 0;
}

// A session that adds to the deload evidence pile: born PAIN flag, HIGH joint
// load, or extreme fatigue (session RPE ≥ 9 / VERY_HIGH CNS load).
export function isStressSession(s: EngineSession): boolean {
  const pain = (s.flagsBorn ?? []).some((f) => f.type === "PAIN");
  const joint = s.jointLoad === "HIGH";
  const fatigue =
    (s.sessionRPE != null && s.sessionRPE >= 9) || s.cnsLoad === "VERY_HIGH";
  return pain || joint || fatigue;
}

export type DeloadCheck = {
  deload: boolean;
  reasons: string[];
};

// Deload trigger: 2+ stress sessions inside any 7-day window (spec §3.3).
// "Within 7 days" = calendar dates ≤ 6 days apart.
export function detectDeload(history: EngineSession[]): DeloadCheck {
  const stress = completedSessions(history).filter(isStressSession);
  for (let i = 0; i < stress.length; i++) {
    for (let j = i + 1; j < stress.length; j++) {
      const gap = Math.abs(
        differenceInCalendarDays(stress[i].date, stress[j].date)
      );
      if (gap <= 6) {
        return {
          deload: true,
          reasons: [
            `Joint pain or extreme fatigue in 2 sessions within 7 days ` +
              `(${fmtDate(stress[j].date)} and ${fmtDate(stress[i].date)}).`,
            "Recommend a deload and a movement-pattern audit.",
          ],
        };
      }
    }
  }
  return { deload: false, reasons: [] };
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Accessory prescribed in each of the last 3 consecutive completed sessions →
// flag it so the NEXT plan substitutes (keeps any movement from running past
// 3 sessions, spec §3.3). Main lift and calves rotate by their own dials;
// cardio modality may repeat.
const ROTATION_ROLES: ReadonlySet<string> = new Set([
  "ACTIVATION",
  "MOBILITY",
  "COMPLEMENTARY",
  "INTEGRITY",
]);

export function movementsNeedingRotation(history: EngineSession[]): string[] {
  const recent = completedSessions(history);
  if (recent.length < 3) return [];
  const namesIn = (s: EngineSession) =>
    new Set(
      (s.movements ?? [])
        .filter((m) => ROTATION_ROLES.has(m.role))
        .map((m) => m.name.trim().toLowerCase())
    );
  const [a, b, c] = [namesIn(recent[0]), namesIn(recent[1]), namesIn(recent[2])];
  const flagged: string[] = [];
  for (const name of a) {
    if (b.has(name) && c.has(name)) {
      // Report the display-cased name from the most recent session.
      const display = (recent[0].movements ?? []).find(
        (m) => m.name.trim().toLowerCase() === name
      );
      flagged.push(display?.name ?? name);
    }
  }
  return flagged.sort();
}

export type PlanningAdjustment = {
  cutSets: number;
  pctOverride?: { low: number; high: number };
  notes: string[];
};

// Planning-time autoregulation, from the immediately preceding completed
// session + the deload check (spec §3.3, §3.6):
// - deload active → drop to 50-60% AND cut a set
// - high fatigue last session (RPE > 8 on a light day, or pain/HIGH joint
//   load) → cut 1 set, prioritize recovery accessories in Block 3
// - last completed session an off-day with RPE > 6 → moderate CNS load note
export function planningAdjustment(
  history: EngineSession[]
): PlanningAdjustment {
  const deload = detectDeload(history);
  if (deload.deload) {
    return {
      cutSets: 1,
      pctOverride: { low: 50, high: 60 },
      notes: [...deload.reasons, "Loads dropped to 50-60% for this session."],
    };
  }

  const prev = completedSessions(history)[0];
  if (!prev) return { cutSets: 0, notes: [] };

  const prevPain =
    (prev.flagsBorn ?? []).some((f) => f.type === "PAIN") ||
    prev.jointLoad === "HIGH";
  const prevLightOverworked =
    prev.category === "BIG3" &&
    prev.intensity === "LIGHT" &&
    prev.sessionRPE != null &&
    prev.sessionRPE > 8;

  if (prevPain || prevLightOverworked) {
    return {
      cutSets: 1,
      notes: [
        prevPain
          ? "Joint stress reported last session — volume cut by 1 set; Block 3 leans recovery."
          : "Last light day ran over RPE 8 — volume cut by 1 set; Block 3 leans recovery.",
      ],
    };
  }

  if (
    prev.category === "OFFDAY" &&
    prev.sessionRPE != null &&
    prev.sessionRPE > 6
  ) {
    return {
      cutSets: 0,
      notes: [
        `Last off-day ran RPE ${prev.sessionRPE} — treat as moderate CNS load; keep Block 1/3 tight.`,
      ],
    };
  }

  return { cutSets: 0, notes: [] };
}

// Gentle Today-screen nudge when load is piling up. No hard scheduling — the
// category is always Tony's tap (spec §3.1 + open decision).
export function offDayNudge(
  history: EngineSession[],
  today: Date
): string | null {
  const recent = completedSessions(history);
  if (detectDeload(history).deload) {
    return "Deload signals are up — an off-day (Reset + Restore) is the smart pull today.";
  }
  const within = (s: EngineSession, days: number) => {
    const gap = differenceInCalendarDays(today, s.date);
    return gap >= 0 && gap < days;
  };
  const big3Last6 = recent.filter(
    (s) => s.category === "BIG3" && within(s, 6)
  ).length;
  if (big3Last6 >= 3) {
    return `You've done ${big3Last6} Big-3 sessions in 6 days — load is piling up. An off-day would land well.`;
  }
  const heavyLast5 = recent.filter(
    (s) => s.category === "BIG3" && s.intensity === "HEAVY" && within(s, 5)
  ).length;
  if (heavyLast5 >= 2) {
    return "Two heavy sessions inside 5 days — consider an off-day before the next pull.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session skeletons (spec §3.4-§3.6)
// ---------------------------------------------------------------------------

export type SkeletonMovement = {
  block: 1 | 2 | 3;
  order: number;
  role: MovementRole;
  name: string;
  targetSets?: number;
  targetReps?: string;
  targetRPE?: number;
  targetLoad?: string;
  cue?: string;
  duration?: string;
};

// Deterministic default accessories per lift, drawn from the reference
// material. They make the session fully usable with zero LLM (Phase 2 / no
// API key); when Milo is live, fillBlocks() swaps them for judgment-picked
// movements honoring flags + recent rotation.
const DEFAULT_ACTIVATION: Record<Lift, SkeletonMovement[]> = {
  DEADLIFT: [
    {
      block: 1,
      order: 0,
      role: "ACTIVATION",
      name: "Glute Bridge",
      targetSets: 2,
      targetReps: "10-12",
      targetRPE: 4,
      targetLoad: "BW",
      cue: "2-3s lower, squeeze at top",
    },
    {
      block: 1,
      order: 1,
      role: "ACTIVATION",
      name: "Banded Good Morning",
      targetSets: 2,
      targetReps: "10-12",
      targetRPE: 4,
      targetLoad: "Band",
      cue: "hinge, long spine",
    },
    {
      block: 1,
      order: 2,
      role: "MOBILITY",
      name: "90/90 Hip Switch",
      duration: "45-60 sec",
      cue: "slow transitions",
    },
  ],
  BENCH: [
    {
      block: 1,
      order: 0,
      role: "ACTIVATION",
      name: "Scap Push-Up",
      targetSets: 2,
      targetReps: "10-12",
      targetRPE: 4,
      targetLoad: "BW",
      cue: "shoulder blades do the work",
    },
    {
      block: 1,
      order: 1,
      role: "ACTIVATION",
      name: "Band Pull-Apart",
      targetSets: 2,
      targetReps: "12-15",
      targetRPE: 4,
      targetLoad: "Band",
      cue: "control the return",
    },
    {
      block: 1,
      order: 2,
      role: "MOBILITY",
      name: "Doorway Pec Stretch",
      duration: "30-60 sec/side",
      cue: "open the chest, easy breath",
    },
  ],
  ZERCHER: [
    {
      block: 1,
      order: 0,
      role: "ACTIVATION",
      name: "Goblet Squat",
      targetSets: 2,
      targetReps: "8-10",
      targetRPE: 4,
      targetLoad: "25-35",
      cue: "tall brace, slow descent",
    },
    {
      block: 1,
      order: 1,
      role: "ACTIVATION",
      name: "Front Plank",
      targetSets: 2,
      targetReps: "30-40 sec",
      targetRPE: 4,
      targetLoad: "BW",
      cue: "ribs down, brace like the rack",
    },
    {
      block: 1,
      order: 2,
      role: "MOBILITY",
      name: "Ankle Rocks",
      duration: "45-60 sec/side",
      cue: "knee over toe, heel down",
    },
  ],
};

const DEFAULT_INTEGRITY: Record<Lift, SkeletonMovement[]> = {
  DEADLIFT: [
    {
      block: 3,
      order: 0,
      role: "INTEGRITY",
      name: "Suitcase Carry",
      targetSets: 2,
      targetReps: "40m/side",
      targetRPE: 5,
      targetLoad: "50-60",
      cue: "grip + tall posture",
    },
    {
      block: 3,
      order: 1,
      role: "INTEGRITY",
      name: "Band Pull-Apart",
      targetSets: 2,
      targetReps: "15",
      targetRPE: 5,
      targetLoad: "Band",
      cue: "upper back, no shrug",
    },
  ],
  BENCH: [
    {
      block: 3,
      order: 0,
      role: "INTEGRITY",
      name: "Rear Delt Fly",
      targetSets: 2,
      targetReps: "12-15",
      targetRPE: 5,
      targetLoad: "10-15",
      cue: "lead with the elbows",
    },
    {
      block: 3,
      order: 1,
      role: "INTEGRITY",
      name: "Dead Bug",
      targetSets: 2,
      targetReps: "8-10/side",
      targetRPE: 5,
      targetLoad: "BW",
      cue: "low back glued down",
    },
  ],
  ZERCHER: [
    {
      block: 3,
      order: 0,
      role: "INTEGRITY",
      name: "Band Row",
      targetSets: 2,
      targetReps: "12-15",
      targetRPE: 5,
      targetLoad: "Band",
      cue: "squeeze mid-back",
    },
    {
      block: 3,
      order: 1,
      role: "INTEGRITY",
      name: "Copenhagen Plank (knee)",
      targetSets: 2,
      targetReps: "15-20 sec/side",
      targetRPE: 5,
      targetLoad: "BW",
      cue: "adductors, level hips",
    },
  ],
};

function calfMovement(
  calf: CalfType,
  block: 1 | 3,
  order: number,
  onDeadliftDay: boolean
): SkeletonMovement {
  return {
    block,
    order,
    role: "CALF",
    name: CALF_MOVEMENT_NAME[calf],
    targetSets: 3,
    targetReps: "10-12",
    targetRPE: 6,
    cue: onDeadliftDay
      ? "Block 1 on deadlift day — pre-activate the lower leg"
      : "full stretch at the bottom, pause at the top",
  };
}

// Planned working sets = Block 1 + 3 movements (excluding mobility/cardio) +
// main-lift working sets. Drives the complementary-slot rule.
export function plannedWorkingSets(movements: SkeletonMovement[]): number {
  return movements.reduce((sum, m) => {
    if (m.role === "MOBILITY" || m.role === "CARDIO") return sum;
    return sum + (m.targetSets ?? 0);
  }, 0);
}

export type Big3Skeleton = {
  lift: Lift;
  intensity: Intensity;
  calf: CalfType;
  prescription: MainLiftPrescription;
  movements: SkeletonMovement[];
  adjustment: PlanningAdjustment;
  activationFocus: string;
  integrityFocus: string;
  rotateOut: string[];
};

// The full Big-3 session skeleton: Block 2 fully prescribed by the engine,
// Block 1/3 filled with deterministic defaults (LLM swaps them per focus +
// flags). Calves land in Block 1 on deadlift day, Block 3 otherwise.
export function buildBig3Skeleton(
  target: Big3Target,
  calf: CalfType,
  cfg: ProgramConfigLike,
  history: EngineSession[]
): Big3Skeleton {
  const adjustment = planningAdjustment(history);
  const prescription = mainLiftPrescription(
    target.lift,
    target.intensity,
    cfg,
    history,
    adjustment.pctOverride
  );
  const sets = Math.max(2, prescription.sets - adjustment.cutSets);
  if (adjustment.cutSets > 0) prescription.notes.push(...adjustment.notes);

  const onDL = target.lift === "DEADLIFT";
  const movements: SkeletonMovement[] = [];

  const activation = DEFAULT_ACTIVATION[target.lift].map((m) => ({ ...m }));
  movements.push(...activation);
  if (onDL) {
    movements.push(calfMovement(calf, 1, activation.length, true));
  }

  movements.push({
    block: 2,
    order: 0,
    role: "MAIN_LIFT",
    name: LIFT_LABEL[target.lift],
    targetSets: sets,
    targetReps: prescription.repsRange,
    targetRPE: prescription.rpeCap,
    targetLoad: prescription.loadText,
    cue: prescription.notes[0],
  });

  const integrity = DEFAULT_INTEGRITY[target.lift].map((m) => ({ ...m }));
  movements.push(...integrity);
  if (!onDL) {
    movements.push(calfMovement(calf, 3, integrity.length, false));
  }

  // Complementary movement: light days only, and only when planned working
  // sets leave room under the 12-15 band (spec §3.5). The engine leaves the
  // slot to the LLM/user; it only reports eligibility via plannedWorkingSets.

  return {
    lift: target.lift,
    intensity: target.intensity,
    calf,
    prescription: { ...prescription, sets },
    movements,
    adjustment,
    activationFocus: ACTIVATION_FOCUS[target.lift],
    integrityFocus: INTEGRITY_FOCUS[target.lift],
    rotateOut: movementsNeedingRotation(history),
  };
}

export type OffDaySkeleton = {
  type: OffDayType;
  calf: CalfType;
  title: string;
  description: string;
  movements: SkeletonMovement[];
};

// Deterministic off-day defaults per archetype (spec §3.6). The LLM tailors
// these (and writes the pitch) when available; without it they stand alone.
export function buildOffDaySkeleton(
  type: OffDayType,
  calf: CalfType,
  nextLift: Lift,
  history: EngineSession[]
): OffDaySkeleton {
  void history;
  if (type === "RESET") {
    return {
      type,
      calf,
      title: OFFDAY_LABEL.RESET,
      description:
        "Full mobility reset for hips, spine, and shoulders, a low-load core finisher, and optional Zone 2.",
      movements: [
        { block: 1, order: 0, role: "MOBILITY", name: "Cat-Cow", duration: "10 cycles" },
        { block: 1, order: 1, role: "MOBILITY", name: "90/90 Hip Switch", duration: "60 sec" },
        { block: 1, order: 2, role: "MOBILITY", name: "Thoracic Rotation", duration: "45 sec/side" },
        { block: 1, order: 3, role: "MOBILITY", name: "Couch Stretch", duration: "45 sec/side" },
        {
          block: 3,
          order: 0,
          role: "INTEGRITY",
          name: "Bird Dog",
          targetSets: 2,
          targetReps: "8-10/side",
          targetRPE: 3,
          targetLoad: "BW",
          cue: "slow, square hips",
        },
        {
          block: 3,
          order: 1,
          role: "INTEGRITY",
          name: "Dead Bug",
          targetSets: 2,
          targetReps: "8-10/side",
          targetRPE: 3,
          targetLoad: "BW",
          cue: "exhale hard, ribs down",
        },
        {
          block: 3,
          order: 2,
          role: "CARDIO",
          name: "Zone 2 Walk",
          duration: "20-30 min",
          cue: "easy nasal-breathing pace",
        },
      ],
    };
  }

  if (type === "TUNE") {
    const prep = DEFAULT_ACTIVATION[nextLift].map((m, i) => ({
      ...m,
      order: i,
    }));
    return {
      type,
      calf,
      title: OFFDAY_LABEL.TUNE,
      description: `Movement-quality session priming ${LIFT_LABEL[nextLift]} — pattern activation, light positional work, optional short cardio.`,
      movements: [
        ...prep,
        {
          block: 2,
          order: 0,
          role: "ACTIVATION",
          name:
            nextLift === "BENCH"
              ? "Tempo Push-Up"
              : nextLift === "ZERCHER"
                ? "Tempo Goblet Squat"
                : "Kettlebell RDL (tempo)",
          targetSets: 2,
          targetReps: "6-8",
          targetRPE: 5,
          targetLoad: nextLift === "BENCH" ? "BW" : "25-45",
          cue: "3s eccentric, perfect positions",
        },
        {
          block: 3,
          order: 0,
          role: "CARDIO",
          name: "Zone 2 (bike or walk)",
          duration: "10-15 min",
          cue: "optional finisher",
        },
      ],
    };
  }

  return {
    type,
    calf,
    title: OFFDAY_LABEL.BUILD,
    description:
      "Light capacity work — grip, core, and calves at RPE ≤ 6, loaded carries, optional easy finisher. No CNS hit.",
    movements: [
      {
        block: 1,
        order: 0,
        role: "ACTIVATION",
        name: "Hanging Hold",
        targetSets: 3,
        targetReps: "20-30 sec",
        targetRPE: 6,
        targetLoad: "BW",
        cue: "grip + long spine",
      },
      {
        block: 1,
        order: 1,
        role: "ACTIVATION",
        name: "Suitcase Carry",
        targetSets: 3,
        targetReps: "40m/side",
        targetRPE: 6,
        targetLoad: "50-60",
        cue: "don't lean, breathe",
      },
      calfMovement(calf, 3, 0, false),
      {
        block: 3,
        order: 1,
        role: "INTEGRITY",
        name: "Dead Bug",
        targetSets: 2,
        targetReps: "10/side",
        targetRPE: 5,
        targetLoad: "BW",
        cue: "postural core, unhurried",
      },
      {
        block: 3,
        order: 2,
        role: "CARDIO",
        name: "Easy Bike",
        duration: "10 min",
        cue: "optional finisher",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Summary rollup (spec §3.7)
// ---------------------------------------------------------------------------

export type Rollup = {
  totalWorkingSets: number;
  mainLiftSummary: string | null;
  topSet: EngineSet | null;
  e1RM: number | null;
  next: Big3Target;
  maxSuggestion: MaxSuggestion | null;
};

// Computed half of the Session Summary. Never typed by the user:
// - Total Working Sets = Block 1 (excluding pure mobility) + Block 2 working
//   sets (excluding ramp-up) + Block 3. Cardio never counts.
// - Main Lift Performed = lift – intensity – top set.
// - Next Lift Target = nextBig3 including this session.
export function rollupSummary(
  session: EngineSession,
  priorHistory: EngineSession[],
  cfg: ProgramConfigLike
): Rollup {
  let total = 0;
  for (const m of session.movements ?? []) {
    if (m.role === "MOBILITY" || m.role === "CARDIO") continue;
    if (m.role === "MAIN_LIFT") {
      const logged = (m.sets ?? []).filter((s) => s.setType !== "WARMUP");
      total += logged.length > 0 ? logged.length : (m.actualSets ?? 0);
      continue;
    }
    total += m.actualSets ?? m.targetSets ?? 0;
  }

  const top = topSetOf(session);
  const lift = session.mainLift as Lift | null;
  let mainLiftSummary: string | null = null;
  let e1RM: number | null = null;
  let maxSuggestion: MaxSuggestion | null = null;

  if (session.category === "BIG3" && lift && session.intensity) {
    if (top) {
      const rpePart = top.rpe != null ? ` @ RPE ${top.rpe}` : "";
      mainLiftSummary = `${LIFT_LABEL[lift]} – ${INTENSITY_LABEL[session.intensity as Intensity]} – Top Set: ${top.load} × ${top.reps}${rpePart}`;
      e1RM = Math.round(epley1RM(top.load, top.reps) * 10) / 10;
      maxSuggestion = suggestMaxBump(lift, top, cfg);
    } else {
      mainLiftSummary = `${LIFT_LABEL[lift]} – ${INTENSITY_LABEL[session.intensity as Intensity]}`;
    }
  }

  const completedSession: EngineSession = {
    ...session,
    status: "COMPLETED",
    completedAt: session.completedAt ?? new Date(session.date),
  };

  return {
    totalWorkingSets: total,
    mainLiftSummary,
    topSet: top,
    e1RM,
    next: nextBig3([completedSession, ...priorHistory]),
    maxSuggestion,
  };
}
