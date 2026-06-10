import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { format } from "date-fns";
import {
  MILO_AUDIT_MODEL,
  MILO_OFFLINE_MESSAGE,
  MILO_SYSTEM_PROMPT,
  miloEnabled,
  sessionSummaryText,
} from "@/lib/milo";
import { fromPrismaDate } from "@/lib/protocol";
import {
  epley1RM,
  LIFT_LABEL,
  topSetOf,
  zercherCapLbs,
  type Lift,
} from "@/lib/workout-engine";
import {
  getActiveFlags,
  getProgramConfig,
  loadHistory,
  toEngineSession,
} from "@/lib/workouts";

// Periodic audit (spec §5 entry point 3): Opus reads the full history and
// returns trend analysis — per-lift trends, weaknesses persisting across ≥3
// sessions, targeted Block 1/3 prescriptions, program adjustments. Surfaced
// as a button on the Progress page; output is transient.

export const maxDuration = 120;

export async function POST() {
  if (!miloEnabled()) {
    return Response.json({ error: MILO_OFFLINE_MESSAGE }, { status: 503 });
  }

  const [cfg, rows, flags] = await Promise.all([
    getProgramConfig(),
    loadHistory(200),
    getActiveFlags(),
  ]);
  const completed = rows
    .filter((r) => r.status === "COMPLETED")
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (completed.length < 3) {
    return Response.json(
      { error: "Not enough history yet — log a few more sessions first." },
      { status: 422 }
    );
  }

  const liftSeries = (["DEADLIFT", "BENCH", "ZERCHER"] as Lift[])
    .map((lift) => {
      const points = completed
        .filter((r) => r.category === "BIG3" && r.mainLift === lift)
        .map((r) => {
          const top = topSetOf(toEngineSession(r));
          if (!top) return null;
          return `${format(fromPrismaDate(r.date), "MMM d")} ${r.intensity}: top ${top.load}×${top.reps}${top.rpe != null ? `@${top.rpe}` : ""} (e1RM ${Math.round(epley1RM(top.load, top.reps))})`;
        })
        .filter(Boolean);
      return `${LIFT_LABEL[lift]}:\n  ${points.join("\n  ") || "no sessions"}`;
    })
    .join("\n");

  const summaries = completed.map(sessionSummaryText).join("\n");

  const result = streamText({
    model: anthropic(MILO_AUDIT_MODEL),
    system: MILO_SYSTEM_PROMPT,
    prompt: `Run a full training audit. Tony asked for it from the progress screen (no need to offer it — deliver it).

PROGRAM: DL 1RM ${cfg.deadlift1RM} · Bench 1RM ${cfg.bench1RM} · Zercher cap ${zercherCapLbs(cfg)}

PER-LIFT TOP-SET SERIES (chronological):
${liftSeries}

ACTIVE FLAGS: ${flags.length > 0 ? flags.map((f) => `${f.issue}${f.bodyArea ? ` (${f.bodyArea})` : ""} · ${f.type}`).join("; ") : "none"}

ALL SESSION SUMMARIES (chronological):
${summaries}

Deliver, in this order, with short plain-text headers:
1. Main lift performance trends — per lift: load/volume/RPE direction; call each one rising, flat, or sliding, with the numbers that show it.
2. Persistent weaknesses — anything appearing in 3+ sessions (technical limits, recurring fatigue/tightness, stalled progressions).
3. Targeted work — for each weakness, one concrete Block 1 (activation) or Block 3 (integrity) movement to run, with sets×reps and the why.
4. Program adjustments — volume, intensity progression, accessory selection, or recovery strategy changes, each justified from the data. If a max bump or deload is warranted, say so plainly.

Keep it tight — this is a foreman's report, not a journal article.`,
    maxOutputTokens: 3000,
    onError: ({ error }) => console.error("milo audit error:", error),
  });

  return result.toTextStreamResponse();
}
