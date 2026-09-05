import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";

/**
 * Single-window desktop shell: fixed header, scroll-safe centered column.
 * Content must never overflow horizontally at any window size ≥ minWidth.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-950">
      {/* Subtle backdrop depth — one restrained radial wash, no neon */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_30%,rgba(125,211,252,0.06),transparent)]"
      />
      <TopBar />
      <main className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-6 pb-5 sm:px-8">
        {children}
      </main>
    </div>
  );
}
