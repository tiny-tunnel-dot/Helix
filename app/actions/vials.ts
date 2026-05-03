"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseLocalDate, suggestVialEnd, type Peptide } from "@/lib/protocol";

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
  revalidatePath("/vials");
}

export async function createVial(formData: FormData) {
  const peptideType = String(formData.get("peptideType") ?? "") as Peptide;
  const vialNumber = parseInt(String(formData.get("vialNumber") ?? "0"), 10);
  const startStr = String(formData.get("startDate") ?? "");
  const endStr = String(formData.get("endDate") ?? "");

  if (!peptideType || !["BPC_TB", "CJC_IPA"].includes(peptideType)) return;
  if (!Number.isInteger(vialNumber) || vialNumber < 1) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) return;

  const rangeStart = parseLocalDate(startStr);
  const rangeEnd = /^\d{4}-\d{2}-\d{2}$/.test(endStr)
    ? parseLocalDate(endStr)
    : suggestVialEnd(peptideType, rangeStart);
  const mixedAt = new Date();

  await db.$transaction([
    db.vial.updateMany({
      where: { peptideType, active: true },
      data: { active: false },
    }),
    db.vial.upsert({
      where: { peptideType_vialNumber: { peptideType, vialNumber } },
      create: {
        peptideType,
        vialNumber,
        rangeStart,
        rangeEnd,
        mixedAt,
        active: true,
      },
      update: { rangeStart, rangeEnd, mixedAt, active: true },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/vials");
}

export async function deleteVial(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.vial.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/vials");
}
