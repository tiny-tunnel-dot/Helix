"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";

export async function recordWeight(formData: FormData) {
  const raw = formData.get("weight");
  const weight = Number(raw);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) return;

  const date = startOfDay(new Date());
  await db.weightEntry.upsert({
    where: { date },
    create: { date, weight },
    update: { weight },
  });

  revalidatePath("/");
}
