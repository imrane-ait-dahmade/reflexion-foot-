"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  {
    href: "/coach",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (path: string) =>
      path === "/coach" || path.startsWith("/coach/sessions"),
  },
  {
    href: "/coach/players",
    label: "Joueurs",
    icon: Users,
    match: (path: string) => path.startsWith("/coach/players"),
  },
] as const;

type CoachNavigationProps = {
  orientation?: "vertical" | "horizontal";
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function CoachNavigation({
  orientation = "vertical",
  collapsed = false,
  onNavigate,
}: CoachNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation coach"
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex flex-row gap-1 overflow-x-auto",
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={item.label}
            className={cn(
              "inline-flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]",
              collapsed && orientation === "vertical" && "justify-center px-0",
              active
                ? "bg-brand-soft text-brand"
                : "text-muted hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {!collapsed || orientation === "horizontal" ? item.label : null}
          </Link>
        );
      })}
    </nav>
  );
}
