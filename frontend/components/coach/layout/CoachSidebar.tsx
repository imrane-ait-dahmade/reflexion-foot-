"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { CoachNavigation } from "@/components/coach/layout/CoachNavigation";
import { IconButton } from "@/components/ui/IconButton";
import { Separator } from "@/components/ui/Separator";
import { cn } from "@/lib/cn";

type CoachSidebarProps = {
  className?: string;
  footer?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function CoachSidebar({
  className = "",
  footer,
  collapsed = false,
  onToggleCollapsed,
}: CoachSidebarProps) {
  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "coach-sidebar hidden shrink-0 flex-col border-r border-border bg-surface md:flex",
        className,
      )}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        {collapsed ? (
          <BrandMark size="sm" href="/coach" showName={false} />
        ) : (
          <BrandMark size="sm" href="/coach" />
        )}
        {onToggleCollapsed ? (
          <IconButton
            label={collapsed ? "Étendre le menu" : "Réduire le menu"}
            size="sm"
            onClick={onToggleCollapsed}
            className="hidden lg:inline-flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </IconButton>
        ) : null}
      </div>
      <Separator />
      <div className="flex flex-1 flex-col gap-4 p-2.5">
        <CoachNavigation orientation="vertical" collapsed={collapsed} />
        <div className="mt-auto space-y-3">
          {!collapsed ? (
            <p className="px-2 text-xs leading-relaxed text-muted">
              Intelligence visuelle pour le staff.
            </p>
          ) : null}
          {footer}
        </div>
      </div>
    </aside>
  );
}
