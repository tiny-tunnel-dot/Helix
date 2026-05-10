"use server";

import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import {
  CYCLE_END,
  CYCLE_START,
  scheduledDosesFor,
  todayLocal,
  type CjcRule,
  type Slot,
} from "@/lib/protocol";
import { loadCjcRules, serializeDaysOff } from "@/lib/cjcRules";

export async function setCjcDaysOff(formData: FormData) {
  const raw = String(formData.get("daysOff") ?? "");
  const days = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const unique = Array.from(new Set(days));
  if (unique.length !== 2) return;

  const effectiveFrom = todayLocal();
  if (effectiveFrom > CYCLE_END) return;

  await db.cjcDaysOffRule.create({
    data: {
      effectiveFrom,
      daysOff: serializeDaysOff(unique),
    },
  });

  // Resync the Injection table forward from today. Rules already includes the
  // row we just inserted because we reload after the create.
  const rules: CjcRule[] = await loadCjcRules();

  const start = effectiveFrom < CYCLE_START ? CYCLE_START : effectiveFrom;
  for (
    let d = start;
    d <= CYCLE_END;
    d = addDays(d, 1)
  ) {
    const desired = scheduledDosesFor(d, rules);
    const desiredSlots = new Set<Slot>(desired.map((x) => x.slot));

    const existing = await db.injection.findMany({
      where: { scheduledDate: d },
    });

    // Drop unlogged rows whose slot is no longer scheduled. Logged rows are
    // preserved even if the new rule wouldn't have scheduled them — keeping
    // history intact is the whole point of forward-only.
    const toDeleteIds = existing
      .filter((row) => row.loggedAt === null && !desiredSlots.has(row.slot as Slot))
      .map((row) => row.id);
    if (toDeleteIds.length > 0) {
      await db.injection.deleteMany({ where: { id: { in: toDeleteIds } } });
    }

    for (const dose of desired) {
      await db.injection.upsert({
        where: {
          scheduledDate_slot: {
            scheduledDate: dose.date,
            slot: dose.slot,
          },
        },
        create: {
          scheduledDate: dose.date,
          slot: dose.slot,
          peptide: dose.peptide,
          doseUnits: dose.doseUnits,
        },
        update: {
          peptide: dose.peptide,
          doseUnits: dose.doseUnits,
        },
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/vials");
  revalidatePath("/calendar");
}
