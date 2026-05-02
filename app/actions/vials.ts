"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function markVialMixed(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const vial = await db.vial.findUnique({ where: { id } });
  if (!vial) return;

  await db.$transaction([
    db.vial.updateMany({
      where: { peptideType: vial.peptideType, active: true },
      data: { active: false },
    }),
    db.vial.update({
      where: { id },
      data: { active: true, mixedAt: new Date() },
    }),
  ]);

  revalidatePath("/");
}
