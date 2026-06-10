import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fromPrismaDate } from "@/lib/protocol";
import {
  DEFAULT_PROGRAM_CONFIG,
  type EngineSession,
} from "@/lib/workout-engine";

// Server-side data helpers for the workout module. Pages and actions load
// sessions through these so engine input is always date-normalized
// (@db.Date columns come back as UTC midnight; the engine wants local).

export const SESSION_INCLUDE = {
  movements: {
    include: { sets: { orderBy: { setIndex: "asc" as const } } },
    orderBy: [{ block: "asc" as const }, { order: "asc" as const }],
  },
  flagsBorn: true,
} satisfies Prisma.WorkoutSessionInclude;

export type SessionRow = Prisma.WorkoutSessionGetPayload<{
  include: typeof SESSION_INCLUDE;
}>;

export async function getProgramConfig() {
  const existing = await db.programConfig.findUnique({
    where: { id: "singleton" },
  });
  if (existing) return existing;
  return db.programConfig.create({
    data: { id: "singleton", ...DEFAULT_PROGRAM_CONFIG },
  });
}

// Recent sessions, newest-first, with everything the engine reads.
export async function loadHistory(take = 60): Promise<SessionRow[]> {
  return db.workoutSession.findMany({
    include: SESSION_INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export function toEngineSession(row: SessionRow): EngineSession {
  return { ...row, date: fromPrismaDate(row.date) };
}

export async function loadEngineHistory(take = 60): Promise<EngineSession[]> {
  const rows = await loadHistory(take);
  return rows.map(toEngineSession);
}

export async function getActiveSession(): Promise<SessionRow | null> {
  return db.workoutSession.findFirst({
    where: { status: "ACTIVE" },
    include: SESSION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getSession(id: string): Promise<SessionRow | null> {
  return db.workoutSession.findUnique({
    where: { id },
    include: SESSION_INCLUDE,
  });
}

export async function getActiveFlags() {
  return db.flag.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: { bornSession: { select: { date: true, category: true } } },
  });
}
