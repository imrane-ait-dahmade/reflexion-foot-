"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

type TooltipProps = {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
};

/** Lightweight accessible tooltip — no portal dependency. */
export function Tooltip({
  content,
  children,
  side = "top",
  className = "",
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-40 w-max max-w-xs -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground shadow-[var(--shadow-sm)]",
            side === "top" ? "bottom-[calc(100%+0.4rem)]" : "top-[calc(100%+0.4rem)]",
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
