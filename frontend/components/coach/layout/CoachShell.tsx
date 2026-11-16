"use client";

import { useState } from "react";
import { CoachContent } from "@/components/coach/layout/CoachContent";
import { CoachHeader } from "@/components/coach/layout/CoachHeader";
import { CoachSidebar } from "@/components/coach/layout/CoachSidebar";
import { cn } from "@/lib/cn";

type CoachShellProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  coachName?: string;
  wide?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** Tablet-first coach analytics shell — sidebar + header + content. */
export function CoachShell({
  title,
  description,
  actions,
  sidebarFooter,
  coachName,
  wide = true,
  children,
  className = "",
}: CoachShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("coach-shell flex flex-1", className)}>
      <CoachSidebar
        footer={sidebarFooter}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <CoachHeader
          title={title}
          description={description}
          actions={actions}
          coachName={coachName}
        />
        <CoachContent wide={wide}>{children}</CoachContent>
      </div>
    </div>
  );
}
