"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { todayLocal } from "@/lib/protocol";
import {
  buildBig3Skeleton,
  buildOffDaySkeleton,
  nextBig3,
  nextCalf,
  rollupSummary,
  type OffDayType,
  type SkeletonMovement,
} from "@/lib/workout-engine";
import { fillBig3Blocks } from "@/lib/milo-generate";
import {
  getProgramConfig,
  getSession,
  loadEngineHistory,
  toEngineSession,
} from "@/lib/workouts";

// Server actions for the workout module. The Milo tool layer (Phase 3) calls
// the same mutations, so every rule lives exactly once.

function revalidateWorkouts(sessionId?: string) {
  revalidatePath("/workouts");
  revalidatePath("/");
  if (sessionId) revalidatePath(`/workouts/session/${sessionId}`);
}

function toMovementRows(movements: SkeletonMovement[]) {
  return movements.map((m) => ({
    block: m.block,
    order: m.order,
    role: m.role,
    name: m.name,
    targetSets: m.targetSets ?? null,
    targetReps: m.targetReps ?? null,
    targetRPE: m.targetRPE ?? null,
    targetLoad: m.targetLoad ?? null,
    cue: m.cue ?? null,
    duration: m.duration ?? null,
  }));
}

// "Start Big-3": engine computes the next target + calf, builds the skeleton,
// session goes straight to ACTIVE (pulling a session = training now).
export async function startBig3Session(): Promise<void> {
  const existing = await db.workoutSession.findFirst({
    where: { status: "ACTIVE" },
  });
  if (existing) redirect(`/workouts/session/${existing.id}`);

  const [cfg, history] = await Promise.all([
    getProgramConfig(),
    loadEngineHistory(),
  ]);
  const target = nextBig3(history);
  const calf = nextCalf(history);
  const skeleton = buildBig3Skeleton(target, calf, cfg, history);

  const session = await db.workoutSession.create({
    data: {
      date: todayLocal(),
      category: "BIG3",
      mainLift: skeleton.lift,
      intensity: skeleton.intensity,
      calfType: skeleton.calf,
      status: "ACTIVE",
      movements: { create: toMovementRows(skeleton.movements) },
    },
  });

  // Milo swaps the default accessories for judgment picks and writes the
  // focus + opening message. No-ops without an API key — defaults stand.
  await fillBig3Blocks(session.id);

  revalidateWorkouts(session.id);
  redirect(`/workouts/session/${session.id}`);
}

const offDayTypeSchema = z.enum(["RESET", "TUNE", "BUILD"]);

export async function startOffDaySession(formData: FormData): Promise<void> {
  const type = offDayTypeSchema.parse(formData.get("type")) as OffDayType;
  // Milo's tailored pitch for the chosen option (when it was generated)
  // becomes the session focus and the opening chat message.
  const pitch = z
    .string()
    .max(400)
    .nullish()
    .parse(formData.get("description") || null);

  const existing = await db.workoutSession.findFirst({
    where: { status: "ACTIVE" },
  });
  if (existing) redirect(`/workouts/session/${existing.id}`);

  const history = await loadEngineHistory();
  const calf = nextCalf(history);
  const next = nextBig3(history);
  const skeleton = buildOffDaySkeleton(type, calf, next.lift, history);

  const session = await db.workoutSession.create({
    data: {
      date: todayLocal(),
      category: "OFFDAY",
      offDayType: type,
      calfType: calf,
      focus: pitch || skeleton.description,
      status: "ACTIVE",
      movements: { create: toMovementRows(skeleton.movements) },
    },
  });

  if (pitch) {
    await db.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "MILO",
        content: `${skeleton.title}: ${pitch} Log as you go — tell me how it feels.`,
      },
    });
  }

  revalidateWorkouts(session.id);
  redirect(`/workouts/session/${session.id}`);
}

// Abandon an ACTIVE session that was started by mistake. Cascade removes
// movements/sets/messages; flags born here are deliberately kept only if
// resolved elsewhere — born flags block deletion, so resolve or keep going.
export async function discardSession(formData: FormData): Promise<void> {
  const id = z.string().min(1).parse(formData.get("sessionId"));
  const session = await db.workoutSession.findUnique({
    where: { id },
    include: { flagsBorn: { select: { id: true } } },
  });
  if (!session || session.status === "COMPLETED") return;
  if (session.flagsBorn.length > 0) {
    await db.flag.deleteMany({ where: { bornSessionId: id } });
  }
  await db.workoutSession.delete({ where: { id } });
  revalidateWorkouts();
  redirect("/workouts");
}

const logSetSchema = z.object({
  movementId: z.string().min(1),
  setType: z.enum(["WARMUP", "WORKING", "TOP", "BACKOFF"]),
  load: z.number().int().min(0).max(1500),
  reps: z.number().int().min(1).max(100),
  rpe: z.number().min(1).max(10).nullable(),
});

export async function logSet(
  input: z.infer<typeof logSetSchema>
): Promise<void> {
  const { movementId, setType, load, reps, rpe } = logSetSchema.parse(input);
  const movement = await db.sessionMovement.findUnique({
    where: { id: movementId },
    include: { sets: true, session: { select: { id: true, status: true } } },
  });
  if (!movement || movement.session.status === "COMPLETED") return;

  await db.setLog.create({
    data: {
      movementId,
      setIndex: movement.sets.length,
      setType,
      load,
      reps,
      rpe,
    },
  });
  revalidateWorkouts(movement.session.id);
}

export async function deleteSet(setId: string): Promise<void> {
  const set = await db.setLog.findUnique({
    where: { id: setId },
    include: {
      movement: { select: { id: true, session: { select: { id: true, status: true } } } },
    },
  });
  if (!set || set.movement.session.status === "COMPLETED") return;
  await db.setLog.delete({ where: { id: setId } });
  // Keep setIndex dense so "Set N" labels stay truthful.
  const remaining = await db.setLog.findMany({
    where: { movementId: set.movement.id },
    orderBy: { setIndex: "asc" },
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].setIndex !== i) {
      await db.setLog.update({
        where: { id: remaining[i].id },
        data: { setIndex: i },
      });
    }
  }
  revalidateWorkouts(set.movement.session.id);
}

const actualsSchema = z.object({
  movementId: z.string().min(1),
  actualSets: z.number().int().min(0).max(20).nullable(),
  actualReps: z.string().max(40).nullable(),
  actualRPE: z.number().min(1).max(10).nullable(),
  actualLoad: z.string().max(40).nullable(),
});

// Coarse logging for accessories/mobility/cardio — the "done as planned" tap
// passes the targets straight through.
export async function logMovementActuals(
  input: z.infer<typeof actualsSchema>
): Promise<void> {
  const { movementId, ...actuals } = actualsSchema.parse(input);
  const movement = await db.sessionMovement.findUnique({
    where: { id: movementId },
    include: { session: { select: { id: true, status: true } } },
  });
  if (!movement || movement.session.status === "COMPLETED") return;
  await db.sessionMovement.update({ where: { id: movementId }, data: actuals });
  revalidateWorkouts(movement.session.id);
}

const amendSchema = z.object({
  movementId: z.string().min(1),
  reason: z.string().min(1).max(500),
  changes: z.object({
    name: z.string().min(1).max(120).optional(),
    targetSets: z.number().int().min(0).max(20).optional(),
    targetReps: z.string().max(40).optional(),
    targetRPE: z.number().min(1).max(10).optional(),
    targetLoad: z.string().max(60).optional(),
    cue: z.string().max(300).optional(),
    duration: z.string().max(60).optional(),
  }),
});

// Mid-session audible: rewrite an upcoming card, keep the audit trail.
// Delegates to the same pure mutation Milo's amendMovement tool uses.
export async function amendMovement(
  input: z.infer<typeof amendSchema>
): Promise<void> {
  const { movementId, reason, changes } = amendSchema.parse(input);
  const movement = await db.sessionMovement.findUnique({
    where: { id: movementId },
    select: { sessionId: true },
  });
  if (!movement) return;
  const { applyAmendMovement } = await import("@/lib/milo-tools");
  await applyAmendMovement(movement.sessionId, movementId, changes, reason);
  revalidateWorkouts(movement.sessionId);
}

const createFlagSchema = z.object({
  sessionId: z.string().min(1),
  issue: z.string().min(1).max(200),
  bodyArea: z.string().max(80).nullable(),
  type: z.enum(["PAIN", "FATIGUE", "TIGHTNESS", "REGRESSION", "DELOAD", "OTHER"]),
  severity: z.enum(["LOW", "MED", "HIGH"]).nullable(),
});

export async function createFlag(
  input: z.infer<typeof createFlagSchema>
): Promise<void> {
  const { sessionId, ...data } = createFlagSchema.parse(input);
  await db.flag.create({ data: { ...data, bornSessionId: sessionId } });
  revalidateWorkouts(sessionId);
}

export async function resolveFlag(
  flagId: string,
  sessionId?: string
): Promise<void> {
  await db.flag.update({
    where: { id: flagId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedSessionId: sessionId ?? null,
    },
  });
  revalidateWorkouts(sessionId);
}

const completeSchema = z.object({
  sessionId: z.string().min(1),
  cnsLoad: z.enum(["LOW", "MODERATE", "HIGH", "VERY_HIGH"]),
  jointLoad: z.enum(["LOW", "MODERATE", "HIGH"]),
  jointLoadArea: z.string().max(80).nullable(),
  performanceGrade: z.string().max(4).nullable(),
  userFeedback: z.string().max(2000).nullable(),
  sessionRPE: z.number().min(1).max(10).nullable(),
});

export type CompleteSessionInput = z.infer<typeof completeSchema>;

// Save = captured fields from the confirm screen + engine-computed summary
// snapshot. Rotation advances implicitly (next = f(history)).
export async function completeSession(
  input: CompleteSessionInput
): Promise<void> {
  const { sessionId, ...captured } = completeSchema.parse(input);
  const row = await getSession(sessionId);
  if (!row || row.status === "COMPLETED") return;

  const [cfg, history] = await Promise.all([
    getProgramConfig(),
    loadEngineHistory(),
  ]);
  const prior = history.filter((s) => (s as { id?: string }).id !== sessionId);
  const rollup = rollupSummary(toEngineSession(row), prior, cfg);

  await db.workoutSession.update({
    where: { id: sessionId },
    data: {
      ...captured,
      status: "COMPLETED",
      completedAt: new Date(),
      totalWorkingSets: rollup.totalWorkingSets,
      nextMainLift: rollup.next.lift,
      nextIntensity: rollup.next.intensity,
    },
  });

  revalidateWorkouts(sessionId);
}

export async function setSessionFocus(
  sessionId: string,
  focus: string
): Promise<void> {
  const text = z.string().max(400).parse(focus);
  await db.workoutSession.update({
    where: { id: sessionId },
    data: { focus: text || null },
  });
  revalidateWorkouts(sessionId);
}

const maxesSchema = z.object({
  deadlift1RM: z.number().int().min(45).max(1000),
  bench1RM: z.number().int().min(45).max(1000),
});

export async function updateMaxes(formData: FormData): Promise<void> {
  const parsed = maxesSchema.parse({
    deadlift1RM: Number(formData.get("deadlift1RM")),
    bench1RM: Number(formData.get("bench1RM")),
  });
  await db.programConfig.update({ where: { id: "singleton" }, data: parsed });
  revalidatePath("/settings");
  revalidateWorkouts();
}

// The confirm-with-a-tap path for engine-suggested max bumps. Never called
// automatically.
export async function applyMaxSuggestion(
  lift: "DEADLIFT" | "BENCH",
  suggested: number
): Promise<void> {
  const value = z.number().int().min(45).max(1000).parse(suggested);
  await db.programConfig.update({
    where: { id: "singleton" },
    data: lift === "DEADLIFT" ? { deadlift1RM: value } : { bench1RM: value },
  });
  revalidateWorkouts();
}
