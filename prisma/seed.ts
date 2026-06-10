import { PrismaClient } from "@prisma/client";
import {
  CYCLE_END,
  CYCLE_START,
  VIAL_RANGES,
  allScheduledDoses,
  fromPrismaDate,
  parseLocalDate,
  type CjcRule,
} from "../lib/protocol";

const db = new PrismaClient();

async function main() {
  // Workout module: ensure the ProgramConfig singleton exists. Maxes are
  // edited in Settings afterwards; only create, never clobber.
  const existingProgram = await db.programConfig.findUnique({
    where: { id: "singleton" },
  });
  if (!existingProgram) {
    await db.programConfig.create({
      data: { id: "singleton", deadlift1RM: 287, bench1RM: 185 },
    });
  }

  await db.cycleConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      startDate: CYCLE_START,
      endDate: CYCLE_END,
    },
    update: { startDate: CYCLE_START, endDate: CYCLE_END },
  });

  // Wipe unlogged scheduled doses so protocol changes (e.g. shifting on/off
  // days) don't leave orphaned rows. Logged history is preserved.
  await db.injection.deleteMany({ where: { loggedAt: null } });

  const ruleRows = await db.cjcDaysOffRule.findMany({
    orderBy: { effectiveFrom: "asc" },
  });
  const rules: CjcRule[] = ruleRows.map((r) => ({
    effectiveFrom: fromPrismaDate(r.effectiveFrom),
    daysOff: r.daysOff
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
  }));

  const doses = allScheduledDoses(rules);
  for (const d of doses) {
    await db.injection.upsert({
      where: {
        scheduledDate_slot: {
          scheduledDate: d.date,
          slot: d.slot,
        },
      },
      create: {
        scheduledDate: d.date,
        slot: d.slot,
        peptide: d.peptide,
        doseUnits: d.doseUnits,
      },
      update: {
        peptide: d.peptide,
        doseUnits: d.doseUnits,
      },
    });
  }

  for (const v of VIAL_RANGES) {
    const isFirstActive = v.vialNumber === 1;
    await db.vial.upsert({
      where: {
        peptideType_vialNumber: {
          peptideType: v.peptideType,
          vialNumber: v.vialNumber,
        },
      },
      create: {
        peptideType: v.peptideType,
        vialNumber: v.vialNumber,
        rangeStart: parseLocalDate(v.rangeStart),
        rangeEnd: parseLocalDate(v.rangeEnd),
        active: isFirstActive,
        mixedAt: isFirstActive ? parseLocalDate(v.rangeStart) : null,
      },
      update: {
        rangeStart: parseLocalDate(v.rangeStart),
        rangeEnd: parseLocalDate(v.rangeEnd),
      },
    });
  }

  const totalInjections = await db.injection.count();
  const totalVials = await db.vial.count();
  console.log(
    `Seeded: ${totalInjections} scheduled injections, ${totalVials} vials.`
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
