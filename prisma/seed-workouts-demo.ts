import { PrismaClient } from "@prisma/client";
import {
  buildBig3Skeleton,
  buildOffDaySkeleton,
  DEFAULT_PROGRAM_CONFIG,
  nextBig3,
  nextCalf,
  rollupSummary,
  type EngineSession,
  type OffDayType,
} from "../lib/workout-engine";
import { localDate } from "../lib/protocol";

// DEV/DEMO SEED — fabricated workout history for exercising the progress
// charts, history list, and audit against realistic data. Never run against
// data you care about: `--wipe` deletes ALL workout sessions + flags first.
//
//   npx tsx prisma/seed-workouts-demo.ts --wipe   # wipe + seed
//   npx tsx prisma/seed-workouts-demo.ts --clean  # wipe only (back to empty)

const db = new PrismaClient();
const cfg = DEFAULT_PROGRAM_CONFIG;

type Day = {
  date: Date;
  kind: "BIG3" | OffDayType;
  // main-lift working sets for big3 days
  sets?: { load: number; reps: number; rpe: number; type: "WORKING" | "TOP" | "BACKOFF" }[];
  warmup?: { load: number; reps: number };
  cns?: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  joint?: "LOW" | "MODERATE" | "HIGH";
  jointArea?: string;
  grade?: string;
  rpe?: number;
  feedback?: string;
  flag?: { issue: string; bodyArea: string; type: string; severity: string };
  resolveFlagIssue?: string;
};

// Four weeks (May 11 – Jun 6 2026): two full 6-session Big-3 cycles with
// off-days between, mild upward e1RM trend per lift, one tightness flag
// born and later resolved.
const PLAN: Day[] = [
  { date: localDate(2026, 5, 11), kind: "BIG3", warmup: { load: 135, reps: 5 }, sets: [ { load: 180, reps: 5, rpe: 6, type: "WORKING" }, { load: 185, reps: 5, rpe: 6.5, type: "WORKING" }, { load: 190, reps: 5, rpe: 6.5, type: "TOP" }, { load: 185, reps: 5, rpe: 6.5, type: "BACKOFF" } ], cns: "MODERATE", joint: "LOW", grade: "B+", rpe: 6.5, feedback: "Bar moved fine. Felt rusty off the floor." },
  { date: localDate(2026, 5, 12), kind: "RESET", cns: "LOW", joint: "LOW", grade: "B", rpe: 4, feedback: "Hips opened up." },
  { date: localDate(2026, 5, 14), kind: "BIG3", warmup: { load: 95, reps: 8 }, sets: [ { load: 155, reps: 4, rpe: 7.5, type: "WORKING" }, { load: 160, reps: 3, rpe: 8, type: "TOP" }, { load: 155, reps: 4, rpe: 8, type: "WORKING" }, { load: 150, reps: 4, rpe: 7.5, type: "BACKOFF" } ], cns: "HIGH", joint: "LOW", grade: "B+", rpe: 7.5, feedback: "Heavy bench felt heavy. Lockout solid." },
  { date: localDate(2026, 5, 16), kind: "BIG3", warmup: { load: 95, reps: 5 }, sets: [ { load: 115, reps: 5, rpe: 5.5, type: "WORKING" }, { load: 125, reps: 5, rpe: 6, type: "WORKING" }, { load: 135, reps: 4, rpe: 6.5, type: "TOP" } ], cns: "LOW", joint: "LOW", grade: "A-", rpe: 5.5, feedback: "Zercher groove improving. Rack position comfortable." },
  { date: localDate(2026, 5, 18), kind: "BUILD", cns: "LOW", joint: "LOW", grade: "B+", rpe: 5, feedback: "Grip work. Easy." },
  { date: localDate(2026, 5, 19), kind: "BIG3", warmup: { load: 165, reps: 4 }, sets: [ { load: 245, reps: 3, rpe: 7.5, type: "WORKING" }, { load: 255, reps: 3, rpe: 8, type: "TOP" }, { load: 245, reps: 3, rpe: 8, type: "WORKING" }, { load: 235, reps: 3, rpe: 7.5, type: "BACKOFF" } ], cns: "HIGH", joint: "MODERATE", jointArea: "Low back", grade: "B", rpe: 8, feedback: "Heavy pulls. Back pumped but clean." },
  { date: localDate(2026, 5, 21), kind: "TUNE", cns: "LOW", joint: "LOW", grade: "A-", rpe: 4.5, feedback: "Primed for bench. Shoulders loose." },
  { date: localDate(2026, 5, 22), kind: "BIG3", warmup: { load: 75, reps: 10 }, sets: [ { load: 115, reps: 6, rpe: 6, type: "WORKING" }, { load: 120, reps: 6, rpe: 6.5, type: "WORKING" }, { load: 120, reps: 6, rpe: 6.5, type: "TOP" }, { load: 115, reps: 6, rpe: 6, type: "BACKOFF" } ], cns: "MODERATE", joint: "LOW", grade: "A-", rpe: 6, feedback: "Light bench crisp, bar speed good." },
  { date: localDate(2026, 5, 24), kind: "BIG3", warmup: { load: 95, reps: 5 }, sets: [ { load: 120, reps: 5, rpe: 6, type: "WORKING" }, { load: 130, reps: 5, rpe: 6.5, type: "WORKING" }, { load: 140, reps: 4, rpe: 7, type: "TOP" } ], cns: "MODERATE", joint: "MODERATE", jointArea: "Left knee", grade: "B", rpe: 6.5, feedback: "Knee a touch cranky in the hole.", flag: { issue: "Knee pinch at bottom of Zercher", bodyArea: "Left knee", type: "TIGHTNESS", severity: "LOW" } },
  { date: localDate(2026, 5, 25), kind: "RESET", cns: "LOW", joint: "LOW", grade: "B+", rpe: 3.5, feedback: "Easy spin + couch stretch. Knee fine after." },
  { date: localDate(2026, 5, 27), kind: "BIG3", warmup: { load: 135, reps: 5 }, sets: [ { load: 185, reps: 5, rpe: 6, type: "WORKING" }, { load: 190, reps: 5, rpe: 6, type: "WORKING" }, { load: 195, reps: 5, rpe: 6.5, type: "TOP" }, { load: 190, reps: 5, rpe: 6.5, type: "BACKOFF" } ], cns: "MODERATE", joint: "LOW", grade: "A-", rpe: 6, feedback: "Speed pulls felt springy.", resolveFlagIssue: "Knee pinch at bottom of Zercher" },
  { date: localDate(2026, 5, 29), kind: "BIG3", warmup: { load: 95, reps: 8 }, sets: [ { load: 160, reps: 3, rpe: 7.5, type: "WORKING" }, { load: 165, reps: 3, rpe: 8, type: "TOP" }, { load: 160, reps: 3, rpe: 8, type: "WORKING" }, { load: 155, reps: 4, rpe: 8, type: "BACKOFF" } ], cns: "HIGH", joint: "LOW", grade: "A-", rpe: 7.5, feedback: "165 triple moved better than 160 did two weeks ago." },
  { date: localDate(2026, 5, 31), kind: "BUILD", cns: "LOW", joint: "LOW", grade: "B+", rpe: 5.5, feedback: "Carries + calves. RPE crept a bit." },
  { date: localDate(2026, 6, 1), kind: "BIG3", warmup: { load: 95, reps: 5 }, sets: [ { load: 125, reps: 5, rpe: 5.5, type: "WORKING" }, { load: 135, reps: 5, rpe: 6, type: "WORKING" }, { load: 140, reps: 5, rpe: 6.5, type: "TOP" } ], cns: "LOW", joint: "LOW", grade: "A", rpe: 5.5, feedback: "Zercher 140×5 clean. Cap is far away; patience." },
  { date: localDate(2026, 6, 3), kind: "BIG3", warmup: { load: 185, reps: 3 }, sets: [ { load: 250, reps: 3, rpe: 7.5, type: "WORKING" }, { load: 260, reps: 3, rpe: 8, type: "TOP" }, { load: 250, reps: 3, rpe: 8, type: "WORKING" }, { load: 240, reps: 4, rpe: 8, type: "BACKOFF" } ], cns: "HIGH", joint: "LOW", grade: "A-", rpe: 8, feedback: "260 triple — matched May's best at lower RPE." },
  { date: localDate(2026, 6, 5), kind: "TUNE", cns: "LOW", joint: "LOW", grade: "B+", rpe: 4, feedback: "Bench prep. Cuff happy." },
  { date: localDate(2026, 6, 6), kind: "BIG3", warmup: { load: 75, reps: 10 }, sets: [ { load: 120, reps: 6, rpe: 5.5, type: "WORKING" }, { load: 125, reps: 6, rpe: 6, type: "WORKING" }, { load: 125, reps: 6, rpe: 6, type: "TOP" }, { load: 120, reps: 6, rpe: 6, type: "BACKOFF" } ], cns: "MODERATE", joint: "LOW", grade: "A-", rpe: 6, feedback: "Light bench. Every rep crisp." },
];

async function wipe() {
  await db.chatMessage.deleteMany({});
  await db.flag.deleteMany({});
  await db.workoutSession.deleteMany({});
  console.log("Wiped all workout sessions, flags, and chat messages.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--clean")) {
    await wipe();
    return;
  }
  if (args.includes("--wipe")) await wipe();

  const history: EngineSession[] = [];

  for (const day of PLAN) {
    const completedAt = new Date(
      day.date.getFullYear(),
      day.date.getMonth(),
      day.date.getDate(),
      10,
      0,
      0
    );

    const target = nextBig3(history);
    const calf = nextCalf(history);

    const skeleton =
      day.kind === "BIG3"
        ? buildBig3Skeleton(target, calf, cfg, history)
        : buildOffDaySkeleton(day.kind, calf, target.lift, history);

    const movements = skeleton.movements.map((m) => ({
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
      // accessories done as planned
      actualSets: m.role === "MOBILITY" || m.role === "CARDIO" ? null : (m.targetSets ?? null),
      actualReps: m.targetReps ?? null,
      actualRPE: m.targetRPE ?? null,
      actualLoad: m.targetLoad ?? null,
    }));

    const session = await db.workoutSession.create({
      data: {
        date: day.date,
        category: day.kind === "BIG3" ? "BIG3" : "OFFDAY",
        mainLift: day.kind === "BIG3" ? target.lift : null,
        intensity: day.kind === "BIG3" ? target.intensity : null,
        offDayType: day.kind === "BIG3" ? null : day.kind,
        calfType: calf,
        focus:
          day.kind === "BIG3"
            ? `${target.lift === "ZERCHER" ? "Form-first" : target.intensity === "LIGHT" ? "Bar speed" : "Top-end strength"} — ${target.lift.toLowerCase()} day.`
            : skeleton && "description" in skeleton
              ? skeleton.description
              : null,
        status: "COMPLETED",
        completedAt,
        movements: { create: movements },
      },
      include: { movements: true },
    });

    // Granular main-lift sets
    if (day.kind === "BIG3" && day.sets) {
      const main = session.movements.find((m) => m.role === "MAIN_LIFT")!;
      let idx = 0;
      if (day.warmup) {
        await db.setLog.create({
          data: { movementId: main.id, setIndex: idx++, setType: "WARMUP", load: day.warmup.load, reps: day.warmup.reps },
        });
      }
      for (const s of day.sets) {
        await db.setLog.create({
          data: { movementId: main.id, setIndex: idx++, setType: s.type, load: s.load, reps: s.reps, rpe: s.rpe },
        });
      }
    }

    if (day.flag) {
      await db.flag.create({
        data: { ...day.flag, bornSessionId: session.id, createdAt: completedAt },
      });
    }
    if (day.resolveFlagIssue) {
      await db.flag.updateMany({
        where: { issue: day.resolveFlagIssue, status: "ACTIVE" },
        data: { status: "RESOLVED", resolvedAt: completedAt, resolvedSessionId: session.id },
      });
    }

    // Faithful computed summary: run the real rollup over what we just wrote.
    const full = await db.workoutSession.findUnique({
      where: { id: session.id },
      include: { movements: { include: { sets: true } }, flagsBorn: true },
    });
    const engineRow: EngineSession = { ...full!, date: day.date };
    const rollup = rollupSummary(engineRow, history, cfg);

    await db.workoutSession.update({
      where: { id: session.id },
      data: {
        cnsLoad: day.cns ?? null,
        jointLoad: day.joint ?? null,
        jointLoadArea: day.jointArea ?? null,
        performanceGrade: day.grade ?? null,
        sessionRPE: day.rpe ?? null,
        userFeedback: day.feedback ?? null,
        totalWorkingSets: rollup.totalWorkingSets,
        nextMainLift: rollup.next.lift,
        nextIntensity: rollup.next.intensity,
      },
    });

    history.unshift({ ...engineRow, status: "COMPLETED", completedAt });
    console.log(
      `${day.date.toISOString().slice(0, 10)}  ${day.kind === "BIG3" ? `${target.lift} ${target.intensity}` : day.kind}  (calf ${calf}, ${rollup.totalWorkingSets} sets)`
    );
  }

  const count = await db.workoutSession.count();
  console.log(`Seeded. ${count} workout sessions in DB.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
