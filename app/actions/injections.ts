"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Site } from "@/lib/protocol";

export async function logInjection(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const site = String(formData.get("site") ?? "") as Site;
  if (!id) return;

  await db.injection.update({
    where: { id },
    data: { loggedAt: new Date(), site },
  });

  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function unlogInjection(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.injection.update({
    where: { id },
    data: { loggedAt: null, site: null },
  });

  revalidatePath("/");
  revalidatePath("/calendar");
}
