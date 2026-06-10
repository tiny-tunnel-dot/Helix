import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  buildMiloContext,
  MILO_CHAT_MODEL,
  MILO_SYSTEM_PROMPT,
  miloEnabled,
  sessionSummaryText,
} from "@/lib/milo";
import {
  applyBlockFill,
  applySummaryDraft,
  movementSchema,
  type SummaryDraft,
} from "@/lib/milo-tools";
import {
  countWorkingSets,
  detectDeload,
  LIFT_LABEL,
  movementsNeedingRotation,
  nextBig3,
  OFFDAY_LABEL,
  topSetOf,
  type EngineSession,
} from "@/lib/workout-engine";
import {
  getActiveFlags,
  getProgramConfig,
  getSession,
  loadHistory,
  toEngineSession,
} from "@/lib/workouts";

// One-shot Milo generations (no chat): Big-3 block fill, off-day options,
// end-of-session summary draft. Every entry point degrades gracefully when
// ANTHROPIC_API_KEY is absent — the engine defaults simply stand.

async function loadContext(sessionId: string) {
  const row = await getSession(sessionId);
  if (!row) return null;
  const [cfg, rows, flags] = await Promise.all([
    getProgramConfig(),
    loadHistory(),
    getActiveFlags(),
  ]);
  const priorRows = rows.filter((r) => r.id !== sessionId);
  const completedRows = priorRows.filter((r) => r.status === "COMPLETED");
  return {
    row,
    cfg,
    history: priorRows.map(toEngineSession),
    recentRows: completedRows,
    flags,
  };
}

// Big-3 session generation (spec §5 entry point 2): the engine has already
// built the skeleton with default accessories; one LLM call swaps Block 1/3
// for judgment-picked movements, writes the Focus, and opens the chat.
export async function fillBig3Blocks(sessionId: string): Promise<void> {
  if (!miloEnabled()) return;
  const ctx = await loadContext(sessionId);
  if (!ctx || ctx.row.category !== "BIG3") return;

  try {
    const result = await generateText({
      model: anthropic(MILO_CHAT_MODEL),
      system: MILO_SYSTEM_PROMPT,
      output: Output.object({
        schema: z.object({
          focus: z
            .string()
            .max(300)
            .describe("1-2 line Session Focus for today"),
          block1: z
            .array(movementSchema)
            .min(2)
            .max(4)
            .describe(
              "Activation: 2-3 movements at 1-2×8-12 RPE 3-5 incl. ≥1 mobility drill, serving the Block 1 focus. Do NOT include calves — the calf slot already exists."
            ),
          block3: z
            .array(movementSchema)
            .min(2)
            .max(4)
            .describe(
              "Integrity: 2-3 movements at 2-3×8-15 RPE 4-6 serving the Block 3 focus and any active flags. Do NOT include calves."
            ),
          opening: z
            .string()
            .max(400)
            .describe(
              "Your opening chat message: the focus in one line plus the first concrete cue for Block 1. No greeting fluff."
            ),
        }),
      }),
      prompt: `Plan today's accessory blocks.\n\n${buildMiloContext({
        session: ctx.row,
        cfg: ctx.cfg,
        history: ctx.history,
        recentRows: ctx.recentRows,
        activeFlags: ctx.flags,
      })}\n\nReplace the engine's default Block 1 and Block 3 picks with movements chosen for today's focus strings, the active flags, and the rotate-out list. Keep the structure rules (counts, reps, RPE bands).`,
      maxOutputTokens: 2000,
    });

    const out = result.output;
    if (!out) return;
    await applyBlockFill(sessionId, out.block1, out.block3);
    await db.workoutSession.update({
      where: { id: sessionId },
      data: { focus: out.focus },
    });
    await db.chatMessage.create({
      data: { sessionId, role: "MILO", content: out.opening },
    });
  } catch (err) {
    // The engine defaults are a complete session — never block on the LLM.
    console.error("fillBig3Blocks failed; engine defaults stand:", err);
  }
}

export type OffDayOption = {
  type: "RESET" | "TUNE" | "BUILD";
  title: string;
  description: string;
};

export const DEFAULT_OFFDAY_OPTIONS: OffDayOption[] = [
  {
    type: "RESET",
    title: OFFDAY_LABEL.RESET,
    description:
      "Mobility circuit, low-load core, optional Zone 2. For heavy joints, stiffness, or a deload.",
  },
  {
    type: "TUNE",
    title: OFFDAY_LABEL.TUNE,
    description:
      "Primes the next lift's pattern — activation, light positional work, optional short cardio.",
  },
  {
    type: "BUILD",
    title: OFFDAY_LABEL.BUILD,
    description:
      "Grip, core, and calf capacity at RPE ≤ 6, carries, easy finisher. Feeling good, no CNS hit.",
  },
];

// Off-day generation (spec §3.6 / §5): three tailored pitches off the last
// 2-3 summaries. Falls back to the engine archetypes without a key.
export async function generateOffDayOptions(): Promise<{
  options: OffDayOption[];
  source: "milo" | "default";
}> {
  if (!miloEnabled()) {
    return { options: DEFAULT_OFFDAY_OPTIONS, source: "default" };
  }

  try {
    const [rows, flags] = await Promise.all([loadHistory(), getActiveFlags()]);
    const completed = rows.filter((r) => r.status === "COMPLETED");
    const history = completed.map(toEngineSession);
    const next = nextBig3(history);
    const deload = detectDeload(history);
    const rotate = movementsNeedingRotation(history);

    const contextParts = [
      `Next Big-3 in the queue: ${LIFT_LABEL[next.lift]} · ${next.intensity}`,
      deload.deload ? `DELOAD ACTIVE: ${deload.reasons.join(" ")}` : null,
      rotate.length > 0 ? `Rotate out: ${rotate.join(", ")}` : null,
      flags.length > 0
        ? `Active flags: ${flags.map((f) => `${f.issue}${f.bodyArea ? ` (${f.bodyArea})` : ""}`).join("; ")}`
        : "Active flags: none",
      completed.length > 0
        ? `Last sessions:\n${completed.slice(0, 3).map(sessionSummaryText).join("\n")}`
        : "No sessions logged yet.",
    ].filter(Boolean);

    const result = await generateText({
      model: anthropic(MILO_CHAT_MODEL),
      system: MILO_SYSTEM_PROMPT,
      output: Output.object({
        schema: z.object({
          options: z
            .array(
              z.object({
                type: z.enum(["RESET", "TUNE", "BUILD"]),
                title: z.string().max(60),
                description: z
                  .string()
                  .max(280)
                  .describe(
                    "Tailored 1-2 sentence pitch: what this session does for Tony TODAY, given the recent load, flags, and the next lift."
                  ),
              })
            )
            .length(3),
        }),
      }),
      prompt: `Tony is taking an off-day and picks by feel. Pitch the three archetypes — RESET (Reset + Restore), TUNE (Tune the Engine, primes the NEXT lift), BUILD (Build Without Burnout) — tailored to his current state. If a deload is active, say plainly that RESET is the smart pull.\n\n${contextParts.join("\n\n")}`,
      maxOutputTokens: 800,
    });

    const out = result.output;
    if (!out) return { options: DEFAULT_OFFDAY_OPTIONS, source: "default" };
    // Keep canonical order and titles stable.
    const byType = new Map(out.options.map((o) => [o.type, o]));
    const options = DEFAULT_OFFDAY_OPTIONS.map((d) => ({
      type: d.type,
      title: d.title,
      description: byType.get(d.type)?.description ?? d.description,
    }));
    return { options, source: "milo" };
  } catch (err) {
    console.error("generateOffDayOptions failed; defaults stand:", err);
    return { options: DEFAULT_OFFDAY_OPTIONS, source: "default" };
  }
}

// End-of-session auto-summary (spec §6 step 5): draft the captured fields for
// the one-screen confirm. Returns the draft (also persisted on the session)
// so the finish screen can fill its fields directly.
export async function draftSessionSummary(
  sessionId: string
): Promise<SummaryDraft | null> {
  if (!miloEnabled()) return null;
  const ctx = await loadContext(sessionId);
  if (!ctx || ctx.row.status === "COMPLETED") return null;

  try {
    const engine: EngineSession = toEngineSession(ctx.row);
    const top = topSetOf(engine);
    const transcript = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    const result = await generateText({
      model: anthropic(MILO_CHAT_MODEL),
      system: MILO_SYSTEM_PROMPT,
      output: Output.object({
        schema: z.object({
          cnsLoad: z.enum(["LOW", "MODERATE", "HIGH", "VERY_HIGH"]),
          jointLoad: z.enum(["LOW", "MODERATE", "HIGH"]),
          jointLoadArea: z.string().max(80).nullish(),
          performanceGrade: z.enum(["A", "A-", "B+", "B", "B-", "C+", "C", "D"]),
          feedback: z
            .string()
            .max(600)
            .describe(
              "Notable observations in Tony's log voice: how the work moved, issues, anything the next session should weigh."
            ),
          sessionRPE: z.number().min(1).max(10),
        }),
      }),
      prompt: `The session is wrapping up. Draft the captured summary fields (Tony confirms them on the finish screen).\n\n${buildMiloContext(
        {
          session: ctx.row,
          cfg: ctx.cfg,
          history: ctx.history,
          recentRows: ctx.recentRows,
          activeFlags: ctx.flags,
        }
      )}\n\nWorking sets completed: ${countWorkingSets(engine.movements ?? [])}${top ? `\nTop set: ${top.load}×${top.reps}${top.rpe != null ? ` @RPE ${top.rpe}` : ""}` : ""}${
        transcript.length > 0
          ? `\n\nIn-session chat (for feel/issues):\n${transcript.map((m) => `${m.role}: ${m.content}`).join("\n")}`
          : ""
      }`,
      maxOutputTokens: 600,
    });

    const out = result.output;
    if (!out) return null;
    const applied = await applySummaryDraft(sessionId, out);
    return applied.ok ? out : null;
  } catch (err) {
    console.error("draftSessionSummary failed; manual entry stands:", err);
    return null;
  }
}
