import { db } from "./db";
import { fromPrismaDate, type CjcRule } from "./protocol";

function parseDaysOff(csv: string): number[] {
  const out: number[] = [];
  for (const part of csv.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 0 && n <= 6) out.push(n);
  }
  return out;
}

export function serializeDaysOff(days: number[]): string {
  return Array.from(new Set(days))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b)
    .join(",");
}

export async function loadCjcRules(): Promise<CjcRule[]> {
  const rows = await db.cjcDaysOffRule.findMany({
    orderBy: { effectiveFrom: "asc" },
  });
  return rows.map((r) => ({
    effectiveFrom: fromPrismaDate(r.effectiveFrom),
    daysOff: parseDaysOff(r.daysOff),
  }));
}
