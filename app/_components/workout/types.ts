// Plain JSON view types passed from server pages into the live-session client
// components. Dates travel as ISO strings.

export type SetView = {
  id: string;
  setIndex: number;
  setType: string;
  load: number;
  reps: number;
  rpe: number | null;
};

export type MovementView = {
  id: string;
  block: number;
  order: number;
  role: string;
  name: string;
  targetSets: number | null;
  targetReps: string | null;
  targetRPE: number | null;
  targetLoad: string | null;
  cue: string | null;
  duration: string | null;
  actualSets: number | null;
  actualReps: string | null;
  actualRPE: number | null;
  actualLoad: string | null;
  amended: boolean;
  amendReason: string | null;
  sets: SetView[];
};

export type FlagView = {
  id: string;
  issue: string;
  bodyArea: string | null;
  type: string;
  severity: string | null;
  status: string;
};

export type SessionView = {
  id: string;
  dateISO: string;
  category: string;
  mainLift: string | null;
  intensity: string | null;
  offDayType: string | null;
  calfType: string;
  focus: string | null;
  status: string;
  sessionRPE: number | null;
  // captured-summary draft (Milo's finalizeSummary or a prior visit)
  cnsLoad: string | null;
  jointLoad: string | null;
  jointLoadArea: string | null;
  performanceGrade: string | null;
  userFeedback: string | null;
  movements: MovementView[];
};

// Prefill anchor: the same set-index from the last completed session of this
// lift ("the engine target + last session's number for this set").
export type LastPerformance = {
  sets: { load: number; reps: number; rpe: number | null }[];
  dateISO: string;
} | null;
