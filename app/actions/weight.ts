"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { todayLocal } from "@/lib/protocol";

export async function recordWeight(formData: FormData) {
  const raw = formData.get("weight");
  const weight = Number(raw);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) return;

  const date = todayLocal();
  await db.weightEntry.upsert({
    where: { date },
    create: { date, weight },
    update: { weight },
  });

  revalidatePath("/");
}
