"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 hover:bg-zinc-900"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Dashboard
          </Link>
          <Link
            href="/calendar"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Calendar
          </Link>
          <Link
            href="/vials"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Vials
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Settings
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="block w-full px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
