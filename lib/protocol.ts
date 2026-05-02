import { addDays, differenceInCalendarDays, isWeekend, startOfDay } from "date-fns";

export const CYCLE_START = new Date("2026-05-01T00:00:00Z");
export const CYCLE_END = new Date("2026-06-26T00:00:00Z");
export const CYCLE_DAYS = 57;

export type Slot = "AM_CJC" | "MIDDAY_BPC" | "PM_CJC";
export type Peptide = "CJC_IPA" | "BPC_TB";
export type Site =
  | "stomach_L"
  | "stomach_R"
  | "shoulder_L"
  | "shoulder_R";

export const PEPTIDE_LABEL: Record<Peptide, string> = {
  CJC_IPA: "CJC/Ipa",
  BPC_TB: "BPC/TB",
};

export const SLOT_LABEL: Record<Slot, string> = {
  AM_CJC: "Morning CJC/Ipa",
  MIDDAY_BPC: "Midday BPC/TB",
  PM_CJC: "Bedtime CJC/Ipa",
};

export const SITE_LABEL: Record<Site, string> = {
  stomach_L: "Stomach (L)",
  stomach_R: "Stomach (R)",
  shoulder_L: "Shoulder (L)",
  shoulder_R: "Shoulder (R)",
};

export const ALLOWED_SITES: Record<Peptide, Site[]> = {
  CJC_IPA: ["stomach_L", "stomach_R"],
  BPC_TB: ["stomach_L", "stomach_R", "shoulder_L", "shoulder_R"],
};

export type ScheduledDose = {
  date: Date;
  slot: Slot;
  peptide: Peptide;
  doseUnits: number;
};

export function scheduledDosesFor(date: Date): ScheduledDose[] {
  const out: ScheduledDose[] = [];
  out.push({ date, slot: "MIDDAY_BPC", peptide: "BPC_TB", doseUnits: 10 });
  if (!isWeekend(date)) {
    out.push({ date, slot: "AM_CJC", peptide: "CJC_IPA", doseUnits: 5 });
    out.push({ date, slot: "PM_CJC", peptide: "CJC_IPA", doseUnits: 5 });
  }
  return out;
}

export function allScheduledDoses(): ScheduledDose[] {
  const out: ScheduledDose[] = [];
  for (let i = 0; i < CYCLE_DAYS; i++) {
    const d = startOfDay(addDays(CYCLE_START, i));
    out.push(...scheduledDosesFor(d));
  }
  return out;
}

export function dayOfCycle(today: Date): number {
  return Math.min(
    CYCLE_DAYS,
    Math.max(1, differenceInCalendarDays(today, CYCLE_START) + 1)
  );
}

export function nextSiteFor(
  peptide: Peptide,
  recentSites: (Site | null)[]
): Site {
  const allowed = ALLOWED_SITES[peptide];
  const used = recentSites.filter((s): s is Site =>
    s !== null && allowed.includes(s)
  );
  if (used.length === 0) return allowed[0];

  const lastIndex = allowed.indexOf(used[0]);
  return allowed[(lastIndex + 1) % allowed.length];
}

export const VIAL_RANGES = [
  {
    peptideType: "BPC_TB" as const,
    vialNumber: 1,
    rangeStart: "2026-05-01",
    rangeEnd: "2026-05-20",
  },
  {
    peptideType: "BPC_TB" as const,
    vialNumber: 2,
    rangeStart: "2026-05-21",
    rangeEnd: "2026-06-09",
  },
  {
    peptideType: "BPC_TB" as const,
    vialNumber: 3,
    rangeStart: "2026-06-10",
    rangeEnd: "2026-06-26",
  },
  {
    peptideType: "CJC_IPA" as const,
    vialNumber: 1,
    rangeStart: "2026-05-01",
    rangeEnd: "2026-05-28",
  },
  {
    peptideType: "CJC_IPA" as const,
    vialNumber: 2,
    rangeStart: "2026-05-29",
    rangeEnd: "2026-06-26",
  },
];
