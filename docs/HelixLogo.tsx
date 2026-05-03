// components/HelixLogo.tsx
//
// Helix brand mark + wordmark lockup.
// Wordmark: Libre Franklin, weight 700, letter-spacing 0.5px.
// Strand colors: white (#FFFFFF) + emerald (#34D399 / Tailwind emerald-400).
//
// Usage:
//   <HelixLogo />                              // default header size
//   <HelixLogo size="sm" />                    // compact
//   <HelixLogo showWordmark={false} />         // mark only (favicon/avatar use)
//   <HelixLogo subtitle="Peptide Protocol" />  // with caps subtitle

import React from "react";

type Size = "sm" | "md" | "lg";

interface HelixLogoProps {
  size?: Size;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}

const SIZES: Record<Size, { mark: number; word: string; gap: string; sub: string }> = {
  sm: { mark: 18, word: "text-lg",  gap: "gap-2",   sub: "text-[8px]"  },
  md: { mark: 24, word: "text-2xl", gap: "gap-2.5", sub: "text-[9px]"  },
  lg: { mark: 36, word: "text-4xl", gap: "gap-3",   sub: "text-[11px]" },
};

export function HelixMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={(size * 42) / 32}
      viewBox="0 0 32 42"
      fill="none"
      className={className}
      aria-label="Helix"
    >
      <path
        d="M5 4 C 18 12, 18 30, 5 38"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M27 4 C 14 12, 14 30, 27 38"
        stroke="#34D399"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function HelixLogo({
  size = "md",
  showWordmark = true,
  subtitle,
  className = "",
}: HelixLogoProps) {
  const s = SIZES[size];

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <HelixMark size={s.mark} className="text-white shrink-0" />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={`${s.word} font-bold text-white tracking-[0.5px]`}
            style={{ fontFamily: "'Libre Franklin', sans-serif" }}
          >
            Helix
          </span>
          {subtitle && (
            <span
              className={`${s.sub} mt-1 uppercase tracking-[1.5px] text-neutral-500`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
