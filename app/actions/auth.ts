"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, sessionCookieName, signSession } from "@/lib/auth";

export async function login(prevState: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");

  if (!checkPassword(password)) {
    return { error: "Wrong password." };
  }

  const token = await signSession(`u:1:${Date.now()}`);
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });

  redirect(from.startsWith("/") ? from : "/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(sessionCookieName());
  redirect("/login");
}
