import Link from "next/link";
import { Card } from "@/app/_components/Card";
import { HeaderMenu } from "@/app/_components/HeaderMenu";

export const dynamic = "force-dynamic";

// Phase 4 fills this with per-lift e1RM charts, volume, PRs, adherence, and
// the Opus audit button.
export default async function WorkoutProgressPage() {
  return (
    <main className="mx-auto max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-4 sm:py-8">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <HeaderMenu />
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          Progress
        </h1>
        <Link
          href="/workouts"
          className="ml-auto text-xs text-zinc-400 hover:text-zinc-200"
        >
          ← Today
        </Link>
      </header>
      <Card>
        <p className="text-sm text-zinc-400">
          Charts land in Phase 4 — e1RM trends, volume, PRs, adherence.
        </p>
      </Card>
    </main>
  );
}
