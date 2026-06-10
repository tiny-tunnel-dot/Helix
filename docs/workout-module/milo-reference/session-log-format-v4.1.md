> **REFERENCE, NOT SPEC.** This is the original ChatGPT "Milo" Session Log
> Format v4.1, the text template Tony pasted back after each workout. It is the
> source for the app's data model, but the app **replaces** this freeform
> template with structured records + auto-rollup. See `../implementation.md`
> (section "Data model") for the schema this maps to. Where they disagree, the
> implementation doc wins.

---

# Session Log Format v4.1 – Integrated Prompt Backbone
# LLM-Optimized Version

## General Instructions for LLM:
* This log format facilitates auto-integration with both Big 3 and Off-Day prompt systems.
* Ensure all fields are filled with precision.
* The `Next Lift Target` field is crucial as it dictates the structure of the subsequent session.
* The `Milo Flags` field is essential for managing deload, warm-up, and accessory exercise logic.
* The `Calf Rotation` field is mandatory for maintaining the progression cycle.
* The `Notable Feedback` field must include the Off-Day RPE (Rate of Perceived Exertion) when applicable.

---
## SESSION LOG — YYYY-MM-DD
**Session ID:** `[YYYYMMDD-B3 / YYYYMMDD-OFF]`

**Session Type:** `[Choose ONE: Big 3 – Deadlift / Big 3 – Bench / Big 3 – Zercher Squat / Off-Day – Reset + Restore / Off-Day – Tune the Engine / Off-Day – Build Without Burnout]`

**Session Focus:** `[Provide a 1–2 line statement detailing the primary purpose and priorities of the session.]`
---
## Block 1 – Activation / Prep Work
* **Inclusion:** Always include this block on Big 3 training days.
* **Off-Day Inclusion:** For Off-Days, only use this block if movement preparation is a specific focus of the chosen Off-Day type (e.g., "Tune the Engine" or specific "Reset + Restore" drills).

1.  **Movement 1:** Name / Load or BW / Sets × Reps / Purpose-Cue
2.  **Movement 2:** Name / Load or BW / Sets × Reps / Purpose-Cue
3.  **Mobility Drill (if used):** Name / Duration or Reps
4.  **Calves:** Type [Standing / Seated] / Load / Sets × Reps / Placement Rationale (if non-obvious, e.g., "Placed in Block 1 for Deadlift day to pre-activate lower leg")
---
## Block 2 – Primary Work

**A. For Big 3 Days:**
1.  **Main Lift:** [Deadlift / Bench Press / Zercher Squat]
2.  **Intensity:** [Light / Heavy]
3.  **Warm-up/Ramp-up Sets (optional):** Load × Reps, ... (e.g., 135 × 5, 185 × 3, 225 × 3)
4.  **Working Sets / Load Progression:** Load × Reps, ... (e.g., 245 × 3, 260 × 3, 260 × 3)
5.  **Top Set:** Load × Reps @ RPE X (e.g., 260 × 3 @ RPE 8)
6.  **Back-off / Volume Sets (if applicable):** Load × Reps @ RPE X (e.g., 225 × 5 @ RPE 7)
7.  **Complementary Movement (if applicable):** Name / Load / Sets × Reps / Purpose-Benefit

**B. For Off-Days (if applicable, depending on session type):**
1.  **Drill 1:** Name / Load or BW / Sets × Reps or Time / Target Cue-Purpose
2.  **Drill 2:** Name / Load or BW / Sets × Reps or Time / Target Cue-Purpose
---
## Block 3 – Integrity / Capacity / Finisher
* **Applicability:** Big 3 Days and Off-Days, content varying by session focus.
* **Guidance by Off-Day Type:**
    * **Reset + Restore:** e.g., Bird Dog — BW, 2 × 10/side; Dead Bug — BW, 2 × 10/side; Light Band Pull-Aparts — 2 × 20
    * **Tune the Engine:** e.g., Plank — BW, 3 × 30-45 sec; Wall Slides — BW, 2 × 12
    * **Build Without Burnout:** e.g., Farmer's Carry — 50 lbs/hand, 3 × 40 meters; Hanging Knee Tucks — BW, 3 × 10-15
* **For Big 3 Days:** List movements with Load/BW, Sets × Reps/Time, Purpose/Target.

**Optional Cardio/Finisher:** Type — Duration/Mode/Intensity (e.g., Incline Walk — 20 min Zone 2; Easy Bike — 15 min; 500m Row @ easy pace). Enter "N/A" if not performed.

**Calves (if not completed in Block 1):** Type [Standing / Seated] / Load / Sets × Reps
---
### Apple Watch Data Snapshot
(Include if Apple Watch was worn; data may be uploaded later)
* Active Calories Burned: ____ kcal
* Total Workout Time: __ min
* Average Heart Rate: __ bpm
* Peak Heart Rate (if notable): __ bpm
* Workout Type (as logged by Apple Watch): [e.g., Traditional Strength / Functional Strength / HIIT / Core / Other]
* Apple Watch Sync Notes (Optional): [e.g., "HR stayed elevated above 145 bpm despite light load," or "Quick HR recovery noted—felt very fresh."]

## Session Summary
* **Main Lift Performed:** Lift Name – Intensity – Top Set: Load × Reps @ RPE X. ("N/A" for most Off-Days.)
* **Total Working Sets:** Numeric count. From Block 1 (excluding pure mobility drills), Block 2 (excluding main lift ramp-up sets), and Block 3. (e.g., 14)
* **Calf Rotation:** [Standing / Seated] (required for both Big 3 and Off-Day sessions.)
* **CNS Load Estimate:** [Low / Moderate / High / Very High] (user input, Milo-derived, or informed by Apple Watch HR & recovery trends.)
* **Joint Load Estimate:** [Low / Moderate / High] (specify joint if relevant, e.g., "High - Left Knee")
* **Performance Grade:** [A / B+ / C ...] (user or Milo graded.)
* **User Feedback & Notable Observations:** Subjective experience, movement issues, and Off-Day RPE. MUST include RPE explicitly for Off-Days (e.g., "Off-day RPE: 5").
* **Next Lift Target:** Next Big 3 Lift – Intensity (e.g., Deadlift - Heavy). Drives Off-Day and subsequent Big 3 planning.
* **Milo Flags:** Persistent issues, regressions, pain points, deload triggers (e.g., "Right shoulder impingement during warm-up", "Lower back fatigue"). Enter "None" if no flags.
