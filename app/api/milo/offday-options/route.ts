import { generateOffDayOptions } from "@/lib/milo-generate";

// Three tailored off-day pitches (LLM) or the engine archetypes (fallback).
// Fetched on demand when Tony opens the off-day picker.

export const maxDuration = 30;

export async function GET() {
  const payload = await generateOffDayOptions();
  return Response.json(payload);
}
