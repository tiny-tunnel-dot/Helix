import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, streamText, type ModelMessage } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  buildMiloContext,
  MILO_CHAT_MODEL,
  MILO_OFFLINE_MESSAGE,
  MILO_SYSTEM_PROMPT,
  miloEnabled,
} from "@/lib/milo";
import { buildMiloTools } from "@/lib/milo-tools";
import {
  getActiveFlags,
  getProgramConfig,
  getSession,
  loadHistory,
  toEngineSession,
} from "@/lib/workouts";

// Live in-session chat with Milo (spec §5 entry point 1). The transcript
// lives in ChatMessage; tools mutate session state server-side and the client
// refreshes its cards when the stream ends. Auth: proxy.ts gates this route.

export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  if (!miloEnabled()) {
    return Response.json({ error: MILO_OFFLINE_MESSAGE }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { sessionId, message } = parsed.data;

  const row = await getSession(sessionId);
  if (!row) return Response.json({ error: "Unknown session." }, { status: 404 });
  if (row.status === "COMPLETED") {
    return Response.json(
      { error: "Session is completed — the transcript is read-only." },
      { status: 409 }
    );
  }

  // Persist the user turn first; the transcript is the source of truth.
  await db.chatMessage.create({
    data: { sessionId, role: "USER", content: message },
  });

  const [cfg, rows, flags, transcript] = await Promise.all([
    getProgramConfig(),
    loadHistory(),
    getActiveFlags(),
    db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 60,
    }),
  ]);
  const priorRows = rows.filter((r) => r.id !== sessionId);

  const context = buildMiloContext({
    session: row,
    cfg,
    history: priorRows.map(toEngineSession),
    recentRows: priorRows.filter((r) => r.status === "COMPLETED"),
    activeFlags: flags,
  });

  const messages: ModelMessage[] = transcript.map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  const result = streamText({
    model: anthropic(MILO_CHAT_MODEL),
    system: `${MILO_SYSTEM_PROMPT}\n\n--- CURRENT SESSION CONTEXT (computed by the app; trust these numbers) ---\n\n${context}`,
    messages,
    tools: buildMiloTools(sessionId),
    stopWhen: stepCountIs(5),
    maxOutputTokens: 1200,
    onFinish: async ({ text }) => {
      const content = text.trim();
      await db.chatMessage.create({
        data: {
          sessionId,
          role: "MILO",
          content: content || "(plan updated)",
        },
      });
    },
    onError: ({ error }) => {
      console.error("milo chat stream error:", error);
    },
  });

  return result.toTextStreamResponse();
}
