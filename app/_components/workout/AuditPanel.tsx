"use client";

import { useState } from "react";

// The periodic audit, surfaced as a button instead of the old "Request
// Audit: Yes" ritual (spec §5). Streams Opus's trend analysis; transient by
// design — history and charts stay the durable record.
export function AuditPanel({ enabled }: { enabled: boolean }) {
  const [running, setRunning] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/milo/audit", { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "The audit didn't run — try again.");
        setText(null);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }
      setText(full + decoder.decode());
    } catch {
      setError("Connection dropped mid-audit — run it again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">Milo audit</div>
          <div className="text-xs text-zinc-500">
            Deep read of the full history — trends, persistent weaknesses,
            program adjustments. Runs on Opus.
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={!enabled || running}
          className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {running ? "Auditing…" : "Run audit"}
        </button>
      </div>

      {!enabled && (
        <p className="mt-3 text-xs text-zinc-600">
          Needs ANTHROPIC_API_KEY — the audit comes online with the coach.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-amber-400/90">{error}</p>}
      {text !== null && (
        <div className="mt-4 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-950/60 p-4 text-sm leading-relaxed text-zinc-200">
          {text === "" ? "Milo is reading the whole log…" : text}
        </div>
      )}
    </div>
  );
}
