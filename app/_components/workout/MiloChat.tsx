"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ChatMessageView = {
  id: string;
  role: string; // "USER" | "MILO"
  content: string;
};

// Live chat with Milo. The DB transcript (server props) is the source of
// truth; this component holds only the in-flight turn. Tool calls mutate the
// session server-side, so when a stream finishes we refresh the route and the
// logger cards above pick up amendments instantly.
export function MiloChat({
  sessionId,
  messages,
  enabled,
  offlineNote,
}: {
  sessionId: string;
  messages: ChatMessageView[];
  enabled: boolean;
  offlineNote: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [echo, setEcho] = useState<ChatMessageView[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Local echoes vanish at render time once the server transcript catches up
  // (after router.refresh() lands the persisted turn).
  const visibleEcho = echo.filter(
    (e) => !messages.some((m) => m.role === e.role && m.content === e.content)
  );
  const thread = [...messages, ...visibleEcho];

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming !== null) return;
    setInput("");
    setError(null);
    setEcho((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "USER", content: text },
    ]);
    setStreaming("");

    try {
      const res = await fetch("/api/milo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Milo didn't answer — try again.");
        setStreaming(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreaming(full);
      }
      full += decoder.decode();

      setEcho((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-m`,
          role: "MILO",
          content: full.trim() || "(plan updated)",
        },
      ]);
      setStreaming(null);
      // Pull amended cards, new flags, focus, and the persisted transcript.
      router.refresh();
    } catch {
      setError("Connection dropped mid-answer — the log is unaffected.");
      setStreaming(null);
    }
  }

  return (
    <section id="milo-chat">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Milo
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card)]">
        <div
          ref={threadRef}
          className="flex max-h-96 min-h-24 flex-col gap-3 overflow-y-auto p-4"
        >
          {thread.length === 0 && streaming === null && (
            <p className="text-sm text-zinc-600">
              {enabled
                ? "Tell Milo how it feels — he sees every set you log."
                : offlineNote}
            </p>
          )}
          {thread.map((m) => (
            <div
              key={m.id}
              className={m.role === "USER" ? "self-end" : "self-start"}
            >
              <div className="mb-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
                {m.role === "USER" ? "You" : "Milo"}
              </div>
              <div
                className={`max-w-[85vw] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-md ${
                  m.role === "USER"
                    ? "rounded-br-sm bg-emerald-500/15 text-emerald-100"
                    : "rounded-bl-sm bg-zinc-800/90 text-zinc-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {streaming !== null && (
            <div className="self-start">
              <div className="mb-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
                Milo
              </div>
              <div className="max-w-[85vw] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-zinc-800/90 px-3.5 py-2 text-sm leading-relaxed text-zinc-100 sm:max-w-md">
                {streaming === "" ? (
                  <span className="inline-flex gap-1 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:300ms]" />
                  </span>
                ) : (
                  streaming
                )}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-amber-400/90">{error}</p>}
        </div>

        <div className="flex items-end gap-2 border-t border-zinc-800 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={
              enabled ? "Tell Milo how it feels…" : "Milo is offline"
            }
            disabled={!enabled || streaming !== null}
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={!enabled || streaming !== null || input.trim() === ""}
            className="h-10 shrink-0 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
      {!enabled && thread.length > 0 && (
        <p className="mt-1.5 text-[11px] text-zinc-600">{offlineNote}</p>
      )}
    </section>
  );
}
