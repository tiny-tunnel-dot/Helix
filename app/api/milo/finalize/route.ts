import { z } from "zod";
import { draftSessionSummary } from "@/lib/milo-generate";

// Milo drafts the captured summary fields for the finish screen. Returns
// drafted=false when the key is missing or the session isn't active — the
// confirm form simply starts blank.

export const maxDuration = 30;

export async function POST(request: Request) {
  const parsed = z
    .object({ sessionId: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const draft = await draftSessionSummary(parsed.data.sessionId);
  return Response.json({ drafted: draft !== null, draft });
}
