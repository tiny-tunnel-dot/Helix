import { addDays, differenceInCalendarDays } from "date-fns";

// Single-tenant app for one user in Pacific time. All "what day is it?" and
// timestamp display logic resolves in this zone regardless of where the
// process runs (Vercel functions are UTC by default).
export const APP_TIMEZONE = "America/Los_Angeles";

// Extract calendar parts of `instant` as observed in `tz`.
function partsInTz(instant: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal" && p.type in out) {
      out[p.type as keyof typeof out] = Number(p.value);
    }
  }
  return out;
}

// Build a Date for the given calendar date at LOCAL midnight. Using local
// midnight (not UTC midnight) keeps date-fns operations like `format`,
// `isSameDay`, and `addDays` aligned with the user's perception of the date.
export function localDate(year: number, month1based: number, day: number): Date {
  return new Date(year, month1based - 1, day);
}

// Parse "YYYY-MM-DD" as a local-midnight Date.
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return localDate(y, m, d);
}

// Prisma reads `@db.Date` columns as JS Dates at UTC midnight of the stored
// date. In zones west of UTC that displays as the previous day. This converts
// such a value back to a local-midnight Date for safe formatting/comparison.
export function fromPrismaDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Returns a Date whose server-LOCAL parts equal the given instant's parts in
// APP_TIMEZONE. Use with date-fns `format()` to render Prisma timestamps
// (loggedAt, mixedAt) in Pacific regardless of where the function executes.
export function asAppLocal(instant: Date): Date {
  const p = partsInTz(instant, APP_TIMEZONE);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

// Local-midnight Date for today's calendar day in APP_TIMEZONE.
export function todayLocal(): Date {
  const p = partsInTz(new Date(), APP_TIMEZONE);
  return localDate(p.year, p.month, p.day);
}

// "YYYY-MM-DD" using local date parts.
export function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse a "?date=YYYY-MM-DD" param to a local-midnight Date, clamped to the
// cycle window and never past today.
export function parseDateParam(raw: string | undefined): Date {
  if (!raw) return todayLocal();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return todayLocal();
  const candidate = parseLocalDate(raw);
  const today = todayLocal();
  if (candidate < CYCLE_START) return CYCLE_START;
  if (candidate > today) return today;
  if (candidate > CYCLE_END) return CYCLE_END;
  return candidate;
}

export const CYCLE_START = localDate(2026, 5, 1);
export const CYCLE_END = localDate(2026, 6, 26);
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

// CJC/Ipa runs on a rolling 5-on / 2-off cycle starting from CYCLE_START
// (5-on/2-off prevents GH receptor desensitization). BPC/TB runs every day.
export function isCjcOnDay(date: Date): boolean {
  const dayIndex = differenceInCalendarDays(date, CYCLE_START);
  if (dayIndex < 0) return false;
  return dayIndex % 7 < 5;
}

export function scheduledDosesFor(date: Date): ScheduledDose[] {
  const out: ScheduledDose[] = [];
  out.push({ date, slot: "MIDDAY_BPC", peptide: "BPC_TB", doseUnits: 10 });
  if (isCjcOnDay(date)) {
    out.push({ date, slot: "AM_CJC", peptide: "CJC_IPA", doseUnits: 5 });
    out.push({ date, slot: "PM_CJC", peptide: "CJC_IPA", doseUnits: 5 });
  }
  return out;
}

export function allScheduledDoses(): ScheduledDose[] {
  const out: ScheduledDose[] = [];
  for (let i = 0; i < CYCLE_DAYS; i++) {
    const d = addDays(CYCLE_START, i);
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
