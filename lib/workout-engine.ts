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
// empty slots tagged with these focus strings; the LLM fills them with
// concrete movements.
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
