import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { createFlag, resolveFlag, setSessionFocus } from "@/app/actions/workouts";

// Milo's function-calling surface (spec §5). Each tool wraps the same
// mutations the UI uses, so an audible in chat and a tap on a card hit
// identical code paths. All tools close over the active session id.

export const movementSchema = z.object({
  role: z.enum(["ACTIVATION", "MOBILITY", "INTEGRITY", "CARDIO"]),
  name: z.string().min(1).max(120),
  targetSets: z.number().int().min(1).max(10).nullish(),
  targetReps: z.string().max(40).nullish().describe('e.g. "8-12", "30-45 sec", "40m/side"'),
  targetRPE: z.number().min(1).max(10).nullish(),
  targetLoad: z.string().max(60).nullish().describe('e.g. "BW", "Band", "50-60"'),
  cue: z.string().max(200).nullish(),
  duration: z.string().max(60).nullish().describe("mobility/cardio only"),
});

export type MovementPick = z.infer<typeof movementSchema>;

// Replace the not-yet-logged accessories in Blocks 1/3 with Milo's picks.
// Logged movements, the main lift, and the calf slot are never touched.
// Shared by the fillBlocks chat tool and Big-3 session generation.
export async function applyBlockFill(
  sessionId: string,
  block1: MovementPick[],
  block3: MovementPick[]
): Promise<{ ok: boolean; replaced?: number; error?: string }> {
  const session = await db.workoutSession.findUnique({
    where: { id: sessionId },
    include: { movements: { include: { sets: true } } },
  });
  if (!session || session.status === "COMPLETED") {
    return { ok: false, error: "Session is not active." };
  }

  let replaced = 0;
  for (const [block, picks] of [
    [1, block1],
    [3, block3],
  ] as const) {
    const existing = session.movements.filter((m) => m.block === block);
    const untouched = existing.filter(
      (m) =>
        m.role === "CALF" ||
        m.role === "MAIN_LIFT" ||
        m.sets.length > 0 ||
        m.actualSets != null ||
        m.actualLoad != null
    );
    const replaceable = existing.filter((m) => !untouched.includes(m));
    await db.sessionMovement.deleteMany({
      where: { id: { in: replaceable.map((m) => m.id) } },
    });
    // Keep calf placement stable: untouched first, then picks.
    let order = 0;
    for (const m of untouched) {
      await db.sessionMovement.update({
        where: { id: m.id },
        data: { order: order++ },
      });
    }
    for (const p of picks) {
      await db.sessionMovement.create({
        data: {
          sessionId,
          block,
          order: order++,
          role: p.role,
          name: p.name,
          targetSets: p.targetSets ?? null,
          targetReps: p.targetReps ?? null,
          targetRPE: p.targetRPE ?? null,
          targetLoad: p.targetLoad ?? null,
          cue: p.cue ?? null,
          duration: p.duration ?? null,
        },
      });
      replaced++;
    }
  }
  return { ok: true, replaced };
}

export type AmendChanges = {
  name?: string;
  targetSets?: number;
  targetReps?: string;
  targetRPE?: number;
  targetLoad?: string;
  cue?: string;
  duration?: string;
};

// Mid-session audible, pure DB form: rewrite an upcoming card with an audit
// trail. The session check stops Milo from amending another session's card.
export async function applyAmendMovement(
  sessionId: string,
  movementId: string,
  changes: AmendChanges,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const movement = await db.sessionMovement.findUnique({
    where: { id: movementId },
    include: { session: { select: { id: true, status: true } } },
  });
  if (!movement || movement.session.id !== sessionId) {
    return { ok: false, error: "Unknown movement id for this session." };
  }
  if (movement.session.status === "COMPLETED") {
    return { ok: false, error: "Session is completed." };
  }
  await db.sessionMovement.update({
    where: { id: movementId },
    data: { ...changes, amended: true, amendReason: reason },
  });
  return { ok: true };
}

export type SummaryDraft = {
  cnsLoad: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  jointLoad: "LOW" | "MODERATE" | "HIGH";
  jointLoadArea?: string | null;
  performanceGrade: string;
  feedback?: string | null;
  sessionRPE?: number | null;
};

// Write Milo's draft of the captured summary fields onto the ACTIVE session.
// Tony reviews and confirms on the finish screen; completion stays his tap.
export async function applySummaryDraft(
  sessionId: string,
  draft: SummaryDraft
): Promise<{ ok: boolean; error?: string }> {
  const session = await db.workoutSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });
  if (!session || session.status === "COMPLETED") {
    return { ok: false, error: "Session is not active." };
  }
  await db.workoutSession.update({
    where: { id: sessionId },
    data: {
      cnsLoad: draft.cnsLoad,
      jointLoad: draft.jointLoad,
      jointLoadArea: draft.jointLoadArea ?? null,
      performanceGrade: draft.performanceGrade,
      userFeedback: draft.feedback ?? null,
      sessionRPE: draft.sessionRPE ?? null,
    },
  });
  return { ok: true };
}

export function buildMiloTools(sessionId: string) {
  return {
    fillBlocks: tool({
      description:
        "Replace the not-yet-logged accessory movements in Block 1 (activation/mobility) and Block 3 (integrity) with your picks. Movements already logged, the main lift, and the calf slot are never touched. Pass the complete desired list per block.",
      inputSchema: z.object({
        block1: z.array(movementSchema).max(5),
        block3: z.array(movementSchema).max(5),
      }),
      execute: async ({ block1, block3 }) =>
        applyBlockFill(sessionId, block1, block3),
    }),

    setSessionFocus: tool({
      description:
        "Write the 1-2 line Session Focus shown at the top of the session screen.",
      inputSchema: z.object({ text: z.string().min(1).max(400) }),
      execute: async ({ text }) => {
        await setSessionFocus(sessionId, text);
        return { ok: true };
      },
    }),

    amendMovement: tool({
      description:
        "Mid-session audible: rewrite an upcoming movement card (swap the movement, change sets/reps/RPE/load/cue). Use the movement id from the live plan. Always include the reason — it's shown on the card and kept as an audit trail.",
      inputSchema: z.object({
        movementId: z.string().min(1),
        reason: z.string().min(1).max(300),
        changes: z.object({
          name: z.string().min(1).max(120).optional(),
          targetSets: z.number().int().min(0).max(20).optional(),
          targetReps: z.string().max(40).optional(),
          targetRPE: z.number().min(1).max(10).optional(),
          targetLoad: z.string().max(60).optional(),
          cue: z.string().max(300).optional(),
          duration: z.string().max(60).optional(),
        }),
      }),
      execute: async ({ movementId, reason, changes }) =>
        applyAmendMovement(sessionId, movementId, changes, reason),
    }),

    createFlag: tool({
      description:
        "Draft a structured flag for an issue Tony reports or you observe (pain, tightness, fatigue, regression, deload). Flags carry forward until resolved and drive the engine's deload trigger.",
      inputSchema: z.object({
        issue: z.string().min(1).max(200),
        bodyArea: z.string().max(80).nullish(),
        type: z.enum(["PAIN", "FATIGUE", "TIGHTNESS", "REGRESSION", "DELOAD", "OTHER"]),
        severity: z.enum(["LOW", "MED", "HIGH"]).nullish(),
      }),
      execute: async ({ issue, bodyArea, type, severity }) => {
        await createFlag({
          sessionId,
          issue,
          bodyArea: bodyArea ?? null,
          type,
          severity: severity ?? null,
        });
        return { ok: true };
      },
    }),

    resolveFlag: tool({
      description:
        "Mark an active flag resolved (use the flag id from ACTIVE FLAGS). Only when the work shows it's actually resolved.",
      inputSchema: z.object({ flagId: z.string().min(1) }),
      execute: async ({ flagId }) => {
        await resolveFlag(flagId, sessionId);
        return { ok: true };
      },
    }),

    finalizeSummary: tool({
      description:
        "Draft the captured (judgment) half of the session summary at the end: CNS load, joint load, grade, feedback, session RPE. Tony reviews and confirms on the finish screen — this never completes the session by itself.",
      inputSchema: z.object({
        cnsLoad: z.enum(["LOW", "MODERATE", "HIGH", "VERY_HIGH"]),
        jointLoad: z.enum(["LOW", "MODERATE", "HIGH"]),
        jointLoadArea: z.string().max(80).nullish(),
        performanceGrade: z.enum(["A", "A-", "B+", "B", "B-", "C+", "C", "D"]),
        feedback: z.string().max(1000).nullish(),
        sessionRPE: z.number().min(1).max(10).nullish(),
      }),
      execute: async (draft) => applySummaryDraft(sessionId, draft),
    }),
  };
}
