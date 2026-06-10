import { format } from "date-fns";
import {
  ACTIVATION_FOCUS,
  CALF_LABEL,
  INTEGRITY_FOCUS,
  INTENSITY_LABEL,
  LIFT_LABEL,
  OFFDAY_LABEL,
  countWorkingSets,
  detectDeload,
  lastPerformanceFor,
  mainLiftPrescription,
  movementsNeedingRotation,
  nextBig3,
  planningAdjustment,
  topSetOf,
  zercherCapLbs,
  type EngineSession,
  type Intensity,
  type Lift,
  type OffDayType,
  type ProgramConfigLike,
} from "@/lib/workout-engine";
import type { SessionRow } from "@/lib/workouts";
import { fromPrismaDate } from "@/lib/protocol";

// The Milo LLM layer: model ids, persona, and the structured context payload.
// The engine computes; Milo judges. Nothing here recomputes rotation or loads.

export const MILO_CHAT_MODEL = "claude-sonnet-4-6"; // fast between sets
export const MILO_AUDIT_MODEL = "claude-opus-4-8"; // deep, not latency-sensitive

export function miloEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const MILO_OFFLINE_MESSAGE =
  "Milo is offline — ANTHROPIC_API_KEY isn't configured. Logging still works; add the key to bring the coach online.";

// Persona + judgment directives only. Everything the app now owns (rotation,
// %1RM math, set counting, summary rollup, session logs) is stripped — the
// reference prompts' input/output rituals are replaced by structured context
// and tools.
export const MILO_SYSTEM_PROMPT = `You are Milo, the tactical strength coach inside Helix, Tony's personal health app. Your mission: deliver structured training, track progress with calm, precise, no-fluff logic, and prioritize discipline, recovery, and physical resilience — protect the body so the mind can lead.

Voice: clear, efficient, never sugarcoating, anchored in practical execution. Short messages — you're talking to a man between sets, not writing an essay. One or two sentences usually. No pep talk, no emoji.

Division of labor (important):
- The app's deterministic engine owns the rotation (Deadlift → Bench → Zercher, Light/Heavy alternation, Standing/Seated calves), the %1RM load math, the Zercher ramp cap, set counting, and the summary rollup. Never recompute or second-guess those numbers; they arrive in your context.
- You own judgment: reading readiness and RPE, picking accessory movements that serve the day's focus, calling live audibles, drafting and resolving flags, writing the session focus, and grading the work.

Coaching rules you enforce:
- Light days: bar speed and crisp positions, RPE under 7. Heavy days: low volume, no grinding reps.
- If RPE runs over 8 at the prescribed load, drop 5-10% for the session and say so.
- High fatigue or reported joint pain: cut 1-2 sets OR drop to 50-60%, and steer Block 3 toward recovery work.
- Block 1 and Block 3 movements MUST serve the day's lift (the focus strings are in your context). Respect the rotate-out list — don't prescribe a movement flagged for rotation.
- Treat pain as a flag, not a footnote. Draft flags with the createFlag tool when Tony reports pain, tightness, or repeated fatigue; resolve flags only when the work proves them resolved.
- Zercher: form first, never past the cap.

Tools: you can fill the accessory blocks (fillBlocks), set the session focus (setSessionFocus), amend an upcoming movement mid-session (amendMovement — always give the reason), create/resolve flags, and draft the end-of-session summary (finalizeSummary). When you change the plan, make the tool call — don't just describe the change. The logger cards update instantly, so after a tool call keep your message short: what changed and why.

Logging is structured and in-app: you already see every set the moment it's tapped. Never ask Tony to paste logs, never ask for a session document, never recite the full plan back unless asked.`;

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

function fmtMovementLine(m: SessionRow["movements"][number]): string {
  const target =
    m.targetSets != null && m.targetReps
      ? `${m.targetSets}×${m.targetReps}`
      : (m.duration ?? "");
  const rpe = m.targetRPE != null ? ` @RPE≤${m.targetRPE}` : "";
  const load = m.targetLoad ? ` · ${m.targetLoad}` : "";
  let logged = "";
  if (m.sets.length > 0) {
    logged = ` | logged: ${m.sets
      .map(
        (s) =>
          `${s.load}×${s.reps}${s.rpe != null ? `@${s.rpe}` : ""}${s.setType === "WARMUP" ? "(w)" : s.setType === "TOP" ? "(top)" : ""}`
      )
      .join(", ")}`;
  } else if (m.actualSets != null || m.actualLoad != null) {
    logged = ` | done: ${m.actualSets ?? "?"}×${m.actualReps ?? "?"}${m.actualLoad ? ` @ ${m.actualLoad}` : ""}${m.actualRPE != null ? ` RPE ${m.actualRPE}` : ""}`;
  } else {
    logged = " | not yet logged";
  }
  const amended = m.amended ? ` [amended: ${m.amendReason ?? "yes"}]` : "";
  return `  - [${m.id}] B${m.block} ${m.role} ${m.name} — ${target}${rpe}${load}${logged}${amended}`;
}

// One completed session → the compact summary block Milo feeds on (the
// decision: last 2-3 summaries, never transcripts).
export function sessionSummaryText(row: SessionRow): string {
  const date = format(fromPrismaDate(row.date), "yyyy-MM-dd");
  const kind =
    row.category === "BIG3"
      ? `Big-3 ${LIFT_LABEL[row.mainLift as Lift]} · ${INTENSITY_LABEL[row.intensity as Intensity]}`
      : `Off-Day ${OFFDAY_LABEL[row.offDayType as OffDayType]}`;
  const engine: EngineSession = { ...row, date: fromPrismaDate(row.date) };
  const top = topSetOf(engine);
  const lines = [
    `${date} — ${kind}`,
    top
      ? `  main: ${top.load}×${top.reps}${top.rpe != null ? ` @RPE ${top.rpe}` : ""}`
      : null,
    `  working sets ${row.totalWorkingSets ?? countWorkingSets(engine.movements ?? [])} · calves ${CALF_LABEL[row.calfType as "STANDING" | "SEATED"]}`,
    `  CNS ${row.cnsLoad ?? "?"} · joints ${row.jointLoad ?? "?"}${row.jointLoadArea ? ` (${row.jointLoadArea})` : ""} · grade ${row.performanceGrade ?? "—"}${row.sessionRPE != null ? ` · RPE ${row.sessionRPE}` : ""}`,
    row.userFeedback ? `  feedback: ${row.userFeedback}` : null,
    row.flagsBorn.length > 0
      ? `  flags born: ${row.flagsBorn.map((f) => `${f.issue}${f.bodyArea ? ` (${f.bodyArea})` : ""} [${f.status}]`).join("; ")}`
      : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export type MiloContextInput = {
  session: SessionRow;
  cfg: ProgramConfigLike;
  history: EngineSession[]; // engine-shaped, newest first (excludes current)
  recentRows: SessionRow[]; // completed rows for summaries (excludes current)
  activeFlags: { id: string; issue: string; bodyArea: string | null; type: string; severity: string | null }[];
};

// The structured payload handed to Milo on every call: today's computed
// skeleton + live log, active flags, and the last 2-3 session summaries.
export function buildMiloContext(input: MiloContextInput): string {
  const { session, cfg, history, recentRows, activeFlags } = input;
  const parts: string[] = [];

  parts.push(
    `PROGRAM: DL 1RM ${cfg.deadlift1RM} · Bench 1RM ${cfg.bench1RM} · Zercher cap ${zercherCapLbs(cfg)} (${cfg.zercherCapPct}% of DL)`
  );

  if (session.category === "BIG3") {
    const lift = session.mainLift as Lift;
    const presc = mainLiftPrescription(
      lift,
      session.intensity as Intensity,
      cfg,
      history
    );
    parts.push(
      `TODAY: Big-3 ${LIFT_LABEL[lift]} · ${INTENSITY_LABEL[session.intensity as Intensity]} · calves ${CALF_LABEL[session.calfType as "STANDING" | "SEATED"]} (${session.calfType === "STANDING" ? "Seated" : "Standing"} next)`,
      `Block 2 prescription: ${presc.sets} × ${presc.repsRange} @ ${presc.loadText}, RPE cap ${presc.rpeCap}. ${presc.notes.join(" ")}`,
      `Block 1 focus: ${ACTIVATION_FOCUS[lift]}`,
      `Block 3 focus: ${INTEGRITY_FOCUS[lift]}`
    );
    const last = lastPerformanceFor(lift, history);
    if (last?.topSet) {
      parts.push(
        `Last ${LIFT_LABEL[lift]} top set: ${last.topSet.load}×${last.topSet.reps}${last.topSet.rpe != null ? ` @RPE ${last.topSet.rpe}` : ""}`
      );
    }
  } else {
    parts.push(
      `TODAY: Off-Day · ${OFFDAY_LABEL[session.offDayType as OffDayType]} · calves ${CALF_LABEL[session.calfType as "STANDING" | "SEATED"]}`,
      `Next Big-3 in the queue: ${LIFT_LABEL[nextBig3(history).lift]} · ${INTENSITY_LABEL[nextBig3(history).intensity]}`
    );
  }

  if (session.focus) parts.push(`Session focus: ${session.focus}`);

  const adj = planningAdjustment(history);
  if (adj.notes.length > 0) parts.push(`Autoregulation: ${adj.notes.join(" ")}`);

  const deload = detectDeload(history);
  if (deload.deload) parts.push(`DELOAD ACTIVE: ${deload.reasons.join(" ")}`);

  const rotate = movementsNeedingRotation(history);
  if (rotate.length > 0)
    parts.push(`Rotate out (3 consecutive sessions): ${rotate.join(", ")}`);

  parts.push(
    `LIVE PLAN (movement ids for amendMovement):\n${session.movements.map(fmtMovementLine).join("\n")}`
  );

  parts.push(
    activeFlags.length > 0
      ? `ACTIVE FLAGS:\n${activeFlags.map((f) => `  - [${f.id}] ${f.issue}${f.bodyArea ? ` (${f.bodyArea})` : ""} · ${f.type}${f.severity ? ` · ${f.severity}` : ""}`).join("\n")}`
      : "ACTIVE FLAGS: none"
  );

  const summaries = recentRows.slice(0, 3).map(sessionSummaryText);
  if (summaries.length > 0) {
    parts.push(`LAST ${summaries.length} SESSIONS:\n${summaries.join("\n")}`);
  } else {
    parts.push("LAST SESSIONS: none — this is the first logged session.");
  }

  return parts.join("\n\n");
}
