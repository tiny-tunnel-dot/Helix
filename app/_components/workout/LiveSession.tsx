"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  discardSession,
  setSessionFocus,
} from "@/app/actions/workouts";
import { SetLogger } from "./SetLogger";
import { MovementCard } from "./MovementCard";
import { CompletePanel } from "./CompletePanel";
import { MiloChat, type ChatMessageView } from "./MiloChat";
import { AddFlagForm, ResolveFlagButton } from "./FlagControls";
import type { FlagView, LastPerformance, SessionView } from "./types";

const BIG3_BLOCK_TITLES: Record<number, string> = {
  1: "Block 1 · Activation",
  2: "Block 2 · Main Event",
  3: "Block 3 · Integrity",
};
const OFFDAY_BLOCK_TITLES: Record<number, string> = {
  1: "Prep & Mobility",
  2: "Primary Work",
  3: "Finisher",
};

function titleFor(session: SessionView): string {
  if (session.category === "BIG3") {
    const lift =
      session.mainLift === "DEADLIFT"
        ? "Deadlift"
        : session.mainLift === "BENCH"
          ? "Bench"
          : "Zercher Squat";
    return `${lift} · ${session.intensity === "LIGHT" ? "Light" : "Heavy"}`;
  }
  return session.offDayType === "RESET"
    ? "Reset + Restore"
    : session.offDayType === "TUNE"
      ? "Tune the Engine"
      : "Build Without Burnout";
}

// The live-session screen (Phase 2 shape): structured logger cards grouped by
// block, flags, focus, and the completion flow. Phase 3 docks the Milo chat
// into this same screen; logging stays structured so Milo always knows the
// state without being told.
export function LiveSession({
  session,
  lastPerformance,
  projectedNext,
  flags,
  chatMessages,
  miloEnabled,
  miloOfflineNote,
}: {
  session: SessionView;
  lastPerformance: LastPerformance;
  projectedNext: string;
  flags: FlagView[];
  chatMessages: ChatMessageView[];
  miloEnabled: boolean;
  miloOfflineNote: string;
}) {
  const main = session.movements.find((m) => m.role === "MAIN_LIFT");
  const mainLogged = main
    ? main.sets.filter((s) => s.setType !== "WARMUP").length
    : 0;
  const [discardPending, startDiscard] = useTransition();

  return (
    <main className="mx-auto max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),6rem)] pt-3 sm:px-4">
      <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-zinc-800/80 bg-[var(--color-background)]/95 px-3 py-2.5 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/workouts"
            aria-label="Back to Today"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            ◀
          </Link>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">
              {titleFor(session)}
            </div>
            <div className="text-[11px] text-zinc-500">
              {session.dateISO} · {session.calfType === "STANDING" ? "Standing" : "Seated"} calves
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {main && main.targetSets ? (
              <div className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                Set {Math.min(mainLogged + 1, main.targetSets)}/
                {main.targetSets}
              </div>
            ) : null}
            <a
              href="#milo-chat"
              aria-label="Jump to Milo chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-sm hover:bg-zinc-900"
            >
              💬
            </a>
          </div>
        </div>
      </header>

      <FocusLine sessionId={session.id} focus={session.focus} />

      <div className="mt-3 flex flex-col gap-5">
        {[1, 2, 3].map((block) => {
          const moves = session.movements
            .filter((m) => m.block === block)
            .sort((a, b) => a.order - b.order);
          if (moves.length === 0) return null;
          const titles =
            session.category === "BIG3" ? BIG3_BLOCK_TITLES : OFFDAY_BLOCK_TITLES;
          return (
            <section key={block}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                {titles[block]}
              </h2>
              <div className="flex flex-col gap-2.5">
                {moves.map((m) =>
                  m.role === "MAIN_LIFT" ? (
                    <SetLogger
                      key={m.id}
                      movement={m}
                      lastPerformance={lastPerformance}
                    />
                  ) : (
                    <MovementCard key={m.id} movement={m} />
                  )
                )}
              </div>
            </section>
          );
        })}

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Flags
          </h2>
          <div className="flex flex-col gap-2">
            {flags.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-zinc-300">
                  {f.issue}
                  {f.bodyArea ? (
                    <span className="text-zinc-500"> · {f.bodyArea}</span>
                  ) : null}
                  <span className="ml-2 text-[11px] uppercase text-zinc-500">
                    {f.type}
                  </span>
                </span>
                <ResolveFlagButton flagId={f.id} sessionId={session.id} />
              </div>
            ))}
            <AddFlagForm sessionId={session.id} />
          </div>
        </section>

        <MiloChat
          sessionId={session.id}
          messages={chatMessages}
          enabled={miloEnabled}
          offlineNote={miloOfflineNote}
        />

        <CompletePanel
          session={session}
          projectedNext={projectedNext}
          miloEnabled={miloEnabled}
        />

        <button
          type="button"
          disabled={discardPending}
          onClick={() => {
            if (window.confirm("Discard this session? Logged sets will be lost.")) {
              const fd = new FormData();
              fd.set("sessionId", session.id);
              startDiscard(() => discardSession(fd));
            }
          }}
          className="mx-auto mb-2 text-xs text-zinc-600 underline-offset-2 hover:text-red-400 hover:underline"
        >
          {discardPending ? "Discarding…" : "Discard session"}
        </button>
      </div>
    </main>
  );
}

function FocusLine({
  sessionId,
  focus,
}: {
  sessionId: string;
  focus: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(focus ?? "");
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5 text-left"
      >
        <span className="text-[11px] uppercase tracking-wider text-emerald-400/80">
          Session focus
        </span>
        <p className="mt-0.5 text-sm leading-snug text-zinc-200">
          {focus || "Tap to set a focus for this session…"}
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        autoFocus
        placeholder="e.g. Heavy pull day — top-end strength, brace hard under load."
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setSessionFocus(sessionId, text.trim());
              setEditing(false);
            })
          }
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save focus"}
        </button>
        <button
          type="button"
          onClick={() => {
            setText(focus ?? "");
            setEditing(false);
          }}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
