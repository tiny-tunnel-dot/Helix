import { PrismaClient } from "@prisma/client";
import {
  CYCLE_END,
  CYCLE_START,
  VIAL_RANGES,
  allScheduledDoses,
} from "../lib/protocol";

const db = new PrismaClient();

async function main() {
  await db.cycleConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      startDate: CYCLE_START,
      endDate: CYCLE_END,
    },
    update: { startDate: CYCLE_START, endDate: CYCLE_END },
  });

  const doses = allScheduledDoses();
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
        rangeStart: new Date(v.rangeStart),
        rangeEnd: new Date(v.rangeEnd),
        active: isFirstActive,
        mixedAt: isFirstActive ? new Date(v.rangeStart) : null,
      },
      update: {
        rangeStart: new Date(v.rangeStart),
        rangeEnd: new Date(v.rangeEnd),
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
