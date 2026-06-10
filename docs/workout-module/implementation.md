# Helix — Workout Module ("Milo") · Implementation Spec

**Status:** Draft for build · **Date:** 2026-06-09
**Repo:** `~/Developer/Helix` · branch off `main`, ship via PR (never push to main).
**How to use this doc:** build this in a fresh Claude Code thread, working inside
the repo. This document is the spec. Read it top to bottom before writing code.

---

## 0. The one hard rule

The three prompts in [`./milo-reference/`](./milo-reference/) are **REFERENCE, NOT
SPEC.** They capture the training philosophy and how the old ChatGPT "Milo"
worked. We are not reproducing them line for line. Where they and this doc
disagree, **this doc wins.** Their job is to inform Milo's coaching philosophy
and system prompt, nothing more.

---

## 1. What we're building

Helix today is a personal **peptide-protocol tracker** (Next.js 16 App Router,
Prisma 6, Neon Postgres, Vercel, single-password auth, dark card-grid UI). We are
turning it into a multifaceted personal health app for one user (Tony).

**Peptides was module one. This is module two: a strength system called Milo.**
It is built on the same foundation and the same spine, so future modules (sleep,
bloodwork, nutrition, cardio) snap onto the same frame later.

Milo is a minimalist **Big-3 strength system** (Deadlift, Bench, Zercher Squat)
that runs on a self-perpetuating rotation, wraps every lift in a 3-block session,
autoregulates off how beat-up Tony is that day, and is coached **live, mid-workout**
by an LLM.

---

## 2. Core architecture thesis (read this twice)

Five load-bearing ideas. Everything below is downstream of these.

1. **Milo is two machines; pull them apart.**
   - **A rules engine (deterministic).** Rotation, intensity, calf, %1RM loads,
     Zercher ramp + cap, volume caps, "movement repeated 3× → rotate," deload
     triggers, summary rollup. No LLM. Pure functions. This is structural
     engineering: fixed math, no hallucination.
   - **A judgment layer (the LLM).** Reads readiness, RPE, flags; fills the
     accessory slots; calls live audibles; drafts flags; writes the Session
     Focus; generates off-day options; grades the session. This is the foreman
     reading the site and changing today's plan.

2. **The workout calendar is a rolling queue, not a fixed dated calendar.**
   Unlike peptides (56 pre-seeded dated slots), the next workout is always
   *known* (next lift + intensity + calf) but *undated*. Tony pulls a session
   when he trains; off-days fill the gaps by choice. **`next session = f(completed
   history)`** — derived, not stored. No pre-seeding.

3. **Two session types, one shared spine.** Big-3 and Off-Day write the same log,
   the same flag stream, and the same calf rotation. The tell: calves keep
   alternating Standing/Seated across both types. They are one state machine.

4. **The Session Summary is half computed, half captured.** That line is the
   deterministic/judgment split made literal in the data:
   - **Computed by engine** (never typed): Total Working Sets, Main Lift
     Performed, Calf Rotation, Next Lift Target.
   - **Captured from user/LLM** (real judgment): CNS Load, Joint Load,
     Performance Grade, Feedback + RPE, Flags.

5. **Flags are first-class objects, not text.** `{issue, bodyArea, type, status,
   bornSession}`. Structured flags are what let the *engine* deterministically
   trip "joint pain in 2 sessions inside 7 days → deload" and "carry forward
   until resolved." Freeform text can't drive rules.

Plus the seam: **the Apple Watch block is where the bigger health app plugs in.**
Build the columns now; wire HealthKit later (HRV, sleep, bloodwork land here too).

---

## 3. The training system (engine rules)

All of this lives in `lib/workout-engine.ts` as pure, tested functions. It is the
workout analog of the existing `lib/protocol.ts`.

### 3.1 Rotation (three dials, each flips every Big-3 session)
- **Lift:** Deadlift → Bench → Zercher → (repeat).
- **Intensity:** Light ↔ Heavy (flips each Big-3 session).
- **Calf:** Standing ↔ Seated (flips each session, **both** types).
- Lift + Intensity realign every 6 sessions:

  ```
  1 DL Light   2 Bench Heavy  3 Zercher Light
  4 DL Heavy   5 Bench Light  6 Zercher Heavy  → repeat
  ```

- `nextBig3(history)`: from the most recent **completed** Big-3 session, advance
  lift one step and flip intensity. First-ever session defaults to **DL · Light**
  (overridable in settings).
- `nextCalf(history)`: flip the calf of the most recent **completed** session of
  **any** type. Default **Standing**.
- **Category (Big-3 vs Off-Day) is Tony's choice each day, not derived.** The
  engine derives the *parameters* of the next Big-3; whether today is Big-3 or an
  off-day is a tap.

### 3.2 Main-lift loads (Block 2)
- **Light:** 60–70% 1RM, 4 × 5–6, RPE < 7, bar-speed focus.
- **Heavy:** 85–90% 1RM, 4–5 × 3–4, keep volume low.
- **Deadlift & Bench:** %1RM math off `ProgramConfig` maxes (DL 287, Bench ~185).
- **Zercher:** ramp to a top set of 3–5 reps, form focus. Progress top set
  +5–10 lb every 2–3 sessions if form is excellent and RPE < 7. **Hard cap at
  ~70–75% of DL 1RM (~200 lb).**

### 3.3 Autoregulation (applies at planning AND live, mid-session)
- **RPE adjust:** if RPE > 8 at the prescribed %, drop 5–10% for the session, note it.
- **Fatigue protocol:** high fatigue (RPE > 8 on a light day, or reported joint
  pain) → cut 1–2 sets OR drop to 50–60% 1RM, and prioritize recovery accessories
  in Block 3.
- **Deload trigger:** joint pain or extreme fatigue in **2 sessions within a
  7-day window** → raise deload, recommend movement audit. (Engine-detected from
  structured flags + RPE history.)
- **Movement rotation:** any movement prescribed > 3 consecutive sessions → engine
  flags it, LLM picks the substitute.

### 3.4 Block structure (every Big-3 session)
- **Block 1 — Activation:** 2–3 movements, 1–2 × 8–12, RPE 3–5, controlled tempo;
  ≥1 mobility drill; **today's calf** (place in Block 1 on Deadlift day to
  pre-activate the lower leg, else Block 3).
- **Block 2 — Main Event:** the lift per 3.2 + optional complementary movement
  (see 3.5).
- **Block 3 — Integrity:** 2–3 movements, 2–3 × 8–15, RPE 4–6; reinforces weak
  links + active flags.
- **Pairing rule:** Block 1 and Block 3 MUST match the day's lift. Encode as data:

  ```
  ACTIVATION_FOCUS = {
    DEADLIFT: "glutes, hamstrings, hinge drills, spinal priming",
    BENCH:    "scapular mobility, triceps pre-fatigue, chest openers",
    ZERCHER:  "core bracing, front-rack/posture drills, squat priming",
  }
  INTEGRITY_FOCUS = {
    DEADLIFT: "grip, anti-flexion core, upper back",
    BENCH:    "rear delts, rotator cuff, anti-extension core",
    ZERCHER:  "mid-back, adductors, anti-rotation, postural core",
  }
  ```
  The engine emits empty Block 1/3 *slots* tagged with the focus string; the LLM
  fills them with concrete movements.

### 3.5 Complementary movement (Block 2, conditional)
- **Light days only**, and only if total working sets < 12–15. 2–3 × 8–12 @ RPE ≤6.
  Supports the lift, minimal eccentric, doesn't tax the main movers.
- **Heavy days:** only if main volume was cut or returning from layoff; only
  low-intensity support (grip/core/mobility), RPE ≤6, never to failure.

### 3.6 Off-days (LLM proposes 3, Tony picks by feel)
- **Reset + Restore** — high fatigue/soreness/deload → mobility circuit (4–6),
  optional Zone 2, low-load core finisher.
- **Tune the Engine** — recovered + heavy lift coming → activation tied to the
  **next** lift, light positional work, optional short cardio.
- **Build Without Burnout** — high recovery, wants work → core/grip/calf clusters
  RPE ≤6, carries/tempo, optional finisher. (If calves chosen, continue rotation.)
- Off-day **RPE > 6 → treat as moderate CNS load** → adjusts next Big-3 Block 1/3
  and volume.

### 3.7 Rollup (`rollupSummary(session)`)
- **Total Working Sets** = count of Block 1 (excluding pure mobility) + Block 2
  working sets (excluding ramp-up) + Block 3.
- **Main Lift Performed** = `lift – intensity – topSet (load × reps @ RPE)`.
- **Next Lift Target** = `nextBig3(history)` snapshot.
- **estimated 1RM** (for charts) = Epley: `load × (1 + reps/30)` off the top set.
  Default Epley; swappable. Powers progress charts and "bump your max?" nudges.

---

## 4. Data model (Prisma)

Add to `prisma/schema.prisma`. Match the existing convention: **`String` fields
with documented allowed values**, not Prisma enums (the peptide models do this).
All loads in **lbs**. Run `npm run db:push` after.

```prisma
// ============ WORKOUT MODULE ============

model ProgramConfig {            // singleton, like CycleConfig
  id            String   @id @default("singleton")
  deadlift1RM   Int                      // 287
  bench1RM      Int                      // ~185
  zercherCapPct Int      @default(72)    // cap = pct of DL 1RM (~70-75%)
  lightPctLow   Int      @default(60)
  lightPctHigh  Int      @default(70)
  heavyPctLow   Int      @default(85)
  heavyPctHigh  Int      @default(90)
  updatedAt     DateTime @updatedAt
}

model WorkoutSession {
  id          String   @id @default(cuid())
  date        DateTime @db.Date
  category    String                       // "BIG3" | "OFFDAY"
  mainLift    String?                      // "DEADLIFT" | "BENCH" | "ZERCHER"
  intensity   String?                      // "LIGHT" | "HEAVY"
  offDayType  String?                      // "RESET" | "TUNE" | "BUILD"
  calfType    String                       // "STANDING" | "SEATED"  (required, both types)
  focus       String?                      // LLM-written, 1-2 lines
  status      String   @default("PLANNED") // "PLANNED" | "ACTIVE" | "COMPLETED"

  // captured summary (judgment / user input)
  cnsLoad          String?   // "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH"
  jointLoad        String?   // "LOW" | "MODERATE" | "HIGH"
  jointLoadArea    String?   // "Left Knee"
  performanceGrade String?   // "A" | "B+" | "C" ...
  userFeedback     String?
  sessionRPE       Float?    // overall / off-day RPE

  // computed summary (cached snapshot for historical fidelity)
  totalWorkingSets Int?
  nextMainLift     String?
  nextIntensity    String?

  // Apple Watch snapshot (optional, attach later — the health-app seam)
  activeCalories   Int?
  workoutMinutes   Int?
  avgHR            Int?
  peakHR           Int?
  watchWorkoutType String?
  watchNotes       String?

  createdAt   DateTime  @default(now())
  completedAt DateTime?

  movements     SessionMovement[]
  messages      ChatMessage[]
  flagsBorn     Flag[] @relation("FlagBorn")
  flagsResolved Flag[] @relation("FlagResolved")

  @@index([date])
  @@index([category])
}

model SessionMovement {
  id          String  @id @default(cuid())
  sessionId   String
  session     WorkoutSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  block       Int                 // 1 | 2 | 3
  order       Int
  role        String              // ACTIVATION | MOBILITY | CALF | MAIN_LIFT | COMPLEMENTARY | INTEGRITY | CARDIO
  name        String

  // prescription (engine/LLM planned). reps/load are STRINGS (ranges, %, BW, time).
  targetSets  Int?
  targetReps  String?             // "8-12", "3"
  targetRPE   Float?
  targetLoad  String?             // "BW", "260", "60-70% (172-201)"
  cue         String?
  duration    String?             // mobility "30-60 sec" / cardio "20 min Zone 2"

  // coarse actuals (accessories/mobility/cardio log at this grain)
  actualSets  Int?
  actualReps  String?
  actualRPE   Float?
  actualLoad  String?

  // mid-session audible audit trail
  amended     Boolean @default(false)
  amendReason String?

  sets        SetLog[]            // granular per-set, mainly MAIN_LIFT

  @@index([sessionId, block, order])
}

model SetLog {                    // granular sets — where volume + e1RM live
  id         String @id @default(cuid())
  movementId String
  movement   SessionMovement @relation(fields: [movementId], references: [id], onDelete: Cascade)
  setIndex   Int
  setType    String              // WARMUP | WORKING | TOP | BACKOFF
  load       Int
  reps       Int
  rpe        Float?
  @@index([movementId, setIndex])
}

model Flag {                      // "Milo Flags" as objects
  id                String  @id @default(cuid())
  issue             String
  bodyArea          String?
  type              String              // PAIN | FATIGUE | TIGHTNESS | REGRESSION | DELOAD | OTHER
  status            String  @default("ACTIVE")   // ACTIVE | RESOLVED
  severity          String?             // LOW | MED | HIGH
  bornSessionId     String
  bornSession       WorkoutSession  @relation("FlagBorn", fields: [bornSessionId], references: [id])
  resolvedSessionId String?
  resolvedSession   WorkoutSession? @relation("FlagResolved", fields: [resolvedSessionId], references: [id])
  createdAt         DateTime @default(now())
  resolvedAt        DateTime?
  @@index([status])
}

model ChatMessage {              // the live in-session transcript
  id        String   @id @default(cuid())
  sessionId String
  session   WorkoutSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String              // "USER" | "MILO"
  content   String
  createdAt DateTime @default(now())
  @@index([sessionId, createdAt])
}
```

**Hybrid granularity (decision):** the main lift logs per-set in `SetLog`
(`245×3, 260×3, 260×3 @ RPE 8`) because that is where progression math lives.
Accessories/mobility/cardio log coarsely on `SessionMovement` actual* fields.
Don't force per-set logging on band pull-aparts. This mirrors how the reference
log already treats the two differently.

---

## 5. The Milo LLM layer

Use the **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`). The repo is already on
Vercel.

> **Before coding the LLM layer, invoke the `claude-api` and `vercel:ai-sdk`
> skills to confirm current model IDs and the SDK API.** Model IDs drift.
> As of this writing: live chat → **Sonnet 4.6** (`claude-sonnet-4-6`, fast
> between sets); periodic audit → **Opus 4.8** (`claude-opus-4-8`, deep
> reasoning, not latency-sensitive). Add `ANTHROPIC_API_KEY` to env + Vercel.

**System prompt** = the Milo persona (calm, precise, no-fluff, safety-first:
"protect the body so the mind can lead") + **only the judgment directives**.
Strip everything the app now owns: recomputing rotation from pasted logs, "paste
your last 2–3 sessions," "Request Audit: Yes/No." The app feeds those as
structured context. Distill the persona/judgment from `./milo-reference/`.

**Structured context payload** the app hands Milo each call: today's computed
skeleton (lift, intensity, calf, prescribed Block 2 sets, empty Block 1/3 slots +
focus strings), active flags, the last 2–3 session summaries (pulled
automatically), and the live log + transcript so far.

**Tools (function calling)** — how chat audibles mutate session state live:
- `fillBlocks(block1[], block3[])` — populate the accessory slots.
- `setSessionFocus(text)`.
- `amendMovement(movementId, changes, reason)` — drop/raise a set, swap a movement
  (sets `amended=true`, writes `amendReason`; rewrites the next logger card).
- `createFlag(issue, bodyArea, type, severity)` / `resolveFlag(flagId)`.
- `finalizeSummary({cnsLoad, jointLoad, jointLoadArea, grade, feedback})` — drafts
  the captured fields at session end.

**Three entry points:**
1. **Live chat** — `app/api/milo/chat/route.ts`, AI SDK `streamText` with tools.
   Streams to the session screen.
2. **Session generation** — Big-3: engine builds skeleton → one LLM call fills
   Block 1/3 + focus. Off-Day: `generateObject` returns the 3 tailored options.
3. **Audit** — `app/api/milo/audit/route.ts`, Opus, reads full history, returns
   trend analysis (per-lift trends, persistent weaknesses ≥3 sessions, targeted
   prescriptions, program-adjustment recommendations). Surfaced as a button, not
   a "Request Audit: Yes" negotiation.

---

## 6. The live-session screen (the heart of the app)

Two channels at once: **structured logging** (dropdowns: weight/reps/RPE) and
**live chat with Milo**. They share state — because logging is structured and
in-app, Milo already knows what was done the instant it's tapped, so the chat is
freed for feel and audibles. **No end-of-workout document upload; the app writes
the summary itself.**

Recommended layout: a chat thread with the structured set-logger rendered
**inline** as interactive cards. (Alternative considered: a `Log | Milo` tab
toggle. We prefer inline; it matches how Tony actually worked — chatting and
logging in one stream — just upgraded from typed text to tappable fields.)

```
┌──────────────────────────────┐
│ ◀ Deadlift · Heavy    Set 2/4│  header: today's lift + progress
├──────────────────────────────┤
│  MILO                        │
│  Top set next. 260 for 3.    │
│  Brace hard off the floor.   │
│                              │
│  ┌────────────────────────┐  │  structured logger, INLINE in the thread
│  │ Set 2 · Deadlift       │  │
│  │ Weight [ 260 ▾ ] lbs   │  │  dropdowns PRE-FILLED with the engine target
│  │ Reps   [  3  ▾ ]       │  │  + last session's number for this set
│  │ RPE    [  8  ▾ ]       │  │
│  │       [  Log set ✓ ]   │  │  one tap when you hit target
│  └────────────────────────┘  │
│                              │
│  YOU                         │
│  knee felt off on that pull  │  talk back anytime
│                              │
│  MILO                        │
│  Noted. Drop to 245, hold 3. │  audible → amendMovement() rewrites next
│  Flagging the knee.          │  card + createFlag() drafts a flag
├──────────────────────────────┤
│ 💬  Tell Milo how it feels…  │  chat input always at the bottom
└──────────────────────────────┘
```

**Interaction flow:**
1. Open Workouts → "Today." Engine computes next Big-3 (lift + intensity + calf).
   Show: "Next up: Deadlift · Heavy" with two buttons: **Start Big-3** or **Take
   an Off-Day**.
2. **Big-3:** engine builds the skeleton (Block 2 fully prescribed; Block 1/3
   slots). One LLM call fills Block 1/3 + writes Focus (respecting active flags +
   focus maps). Session `status=ACTIVE`. Go to session screen.
3. **Off-Day:** LLM generates 3 options; Tony picks; that becomes the skeleton;
   `status=ACTIVE`.
4. Session screen: inline logger cards pre-filled with targets (and last
   session's numbers via `lastPerformanceFor(lift)`). Milo opens with the Focus +
   first cue. Tony logs sets (writes `SetLog`/actuals); types to Milo anytime;
   Milo streams back and may call tools to amend upcoming cards or draft flags.
5. Last movement done → app rolls up computed fields; Milo drafts captured fields
   via `finalizeSummary`; one-screen confirm; Tony tweaks + confirms.
6. Save: `status=COMPLETED`, `completedAt` set, flags created/resolved. Rotation
   advances implicitly (next = f(history)).

---

## 7. App structure (routes + components)

```
app/
  workouts/
    page.tsx                 # "Today": pull next Big-3 OR choose off-day
    session/[id]/page.tsx    # the LIVE SESSION screen
    history/page.tsx         # past sessions list
    progress/page.tsx        # charts: per-lift e1RM, volume, PRs, adherence
  actions/
    workouts.ts              # server actions: createSession, logSet, amendMovement,
                             #   completeSession, resolveFlag, updateMaxes ...
  api/
    milo/
      chat/route.ts          # streaming chat w/ tools
      audit/route.ts         # periodic audit (Opus)
  _components/workout/
    TodayCard.tsx            # dashboard card: today's session / next lift / streak
    LiveSession.tsx          # composes chat + inline loggers
    MiloChat.tsx             # thread + streaming + input
    SetLogger.tsx            # the inline structured logger card
    OffDayOptions.tsx        # 3-option picker
    ProgressCharts.tsx       # recharts (reuse WeightChart pattern)
lib/
  workout-engine.ts          # pure rules (the analog of protocol.ts)
  milo.ts                    # system prompt, context builder, tool defs
```

Add workout cards to the existing home card-grid (`app/page.tsx`), reusing
`_components/Card.tsx`. Add a maxes editor to `app/settings/`.

---

## 8. Reuse from existing Helix (don't reinvent)
- **Auth:** `lib/auth.ts` single-password cookie. The module just lives behind it.
  No new auth.
- **DB client:** `lib/db.ts` (Prisma singleton).
- **Engine precedent:** `lib/protocol.ts` is the pattern for `workout-engine.ts`.
- **UI:** `_components/Card.tsx`, dark theme, Tailwind 4, `recharts` (see
  `WeightChart.tsx`), `date-fns`, `zod` for action validation.
- **Body weight** already exists (`WeightEntry`) — surface it alongside lift
  progress; later correlate with peptide cycle phases.

> **Next.js 16 gotcha (from repo `AGENTS.md`):** this is a modified Next.js with
> breaking changes. **Read `node_modules/next/dist/docs/` before writing routes,
> server actions, or API handlers.** Do not assume training-data conventions.

---

## 9. Build phases (rough-in before finish work)

Build the deterministic structure first and verify it before the probabilistic
layer lands on top. Each phase is independently demoable.

- **Phase 0 — Permits & footings.** Read the Next.js 16 docs in `node_modules`.
  Add the Prisma models; `npm run db:push`. Seed `ProgramConfig` (DL 287, Bench
  185). Add `ANTHROPIC_API_KEY` to env + Vercel. Constants/allowed-value maps.
- **Phase 1 — The engine (structure).** `lib/workout-engine.ts` pure functions +
  unit tests: rotation, loads, Zercher ramp/cap, deload detection, movement-rotation
  check, rollup, e1RM. No UI, no LLM. **Verify this is correct first.**
- **Phase 2 — Logging without the coach (rough-in).** Create a session from the
  engine skeleton; the live-session screen with inline loggers (dropdowns →
  `SetLog`/actuals); complete → rollup → save. Manual focus/flags for now. Proves
  the whole log loop with zero LLM.
- **Phase 3 — Milo (finish work).** AI SDK chat route + tools; `MiloChat`;
  Big-3 block-fill + off-day option generation; end-of-session auto-summary. The
  judgment layer lands on the working structure.
- **Phase 4 — Progress + audit (punch list).** Progress charts (e1RM, volume,
  PRs, adherence), history view, periodic audit (Opus), dashboard cards.
- **Phase 5 — Apple Watch seam (left capped).** Columns exist; HealthKit wiring
  deferred to a later module.

---

## 10. v1 scope / non-goals
- **Single user.** Reuse single-password auth. No multi-tenant.
- **HealthKit live sync deferred.** Apple Watch columns are manual/empty in v1.
- **Other health modules deferred** (sleep, nutrition, bloodwork) — they ride the
  same seam later.
- **Audit can slip to v1.1** if Phase 4 runs long; the live loop (Phases 0–3) is
  the must-ship.

---

## 11. Open decisions for the build thread
- **e1RM formula:** Epley default; confirm vs Brzycki preference.
- **Auto-bumping maxes:** suggest a max increase when top-set e1RM beats
  `ProgramConfig`, or leave maxes a manual settings edit? (Lean: suggest, confirm.)
- **Long-term Milo memory:** feed-forward the last 2–3 *summaries* (cheap, on
  brand) vs full transcripts (expensive). Lean: summaries; keep transcripts for
  history only.
- **Off-day cadence nudging:** purely Tony's call each day, or a gentle "you've
  done 3 heavy sessions in 6 days" nudge on the Today screen? (Lean: gentle nudge,
  no hard scheduling.)
- **Real-data validation:** a comprehensive training-history export was discussed
  but not yet provided. Pressure-test the logging grain and progress views against
  Tony's real logs once available; not a blocker for Phases 0–3.

---

## 12. Reference material
- [`./milo-reference/big3-planner.md`](./milo-reference/big3-planner.md)
- [`./milo-reference/off-day-planner.md`](./milo-reference/off-day-planner.md)
- [`./milo-reference/session-log-format-v4.1.md`](./milo-reference/session-log-format-v4.1.md)

Reference, not spec. They inform Milo's philosophy and system prompt. This doc wins.
