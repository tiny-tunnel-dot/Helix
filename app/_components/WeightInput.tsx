"use client";

import { useState } from "react";
import { recordWeight } from "@/app/actions/weight";

export function WeightInput() {
  const [val, setVal] = useState("");
  return (
    <form
      action={async (fd) => {
        await recordWeight(fd);
        setVal("");
      }}
      className="flex items-center gap-1.5"
    >
      <input
        type="number"
        step="0.1"
        name="weight"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="lb"
        className="w-20 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
      />
      <button
        type="submit"
        className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
      >
        Log
      </button>
    </form>
  );
}
