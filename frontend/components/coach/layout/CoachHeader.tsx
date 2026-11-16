"use client";

import { useState } from "react";
import { Menu, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { CoachNavigation } from "@/components/coach/layout/CoachNavigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { IconButton } from "@/components/ui/IconButton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";

type CoachHeaderProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  coachName?: string;
  className?: string;
};

export function CoachHeader({
  title,
  description,
  actions,
  coachName,
  className = "",
}: CoachHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <IconButton label="Ouvrir le menu" size="md">
                <Menu className="size-5" />
              </IconButton>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>
                  <BrandMark size="sm" href="/coach" />
                </SheetTitle>
                <SheetDescription>
                  Navigation coach — tactile et compacte.
                </SheetDescription>
              </SheetHeader>
              <div className="p-3">
                <CoachNavigation
                  orientation="vertical"
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
          <BrandMark size="sm" href="/coach" showName={false} />
        </div>

        <div className="min-w-0 flex-1">
          {title ? (
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-lg">
                {title}
              </h1>
              {description ? (
                <p className="hidden truncate text-sm text-muted md:block">
                  {description}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                label="Profil coach"
                size="md"
                variant="secondary"
              >
                <UserRound className="size-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {coachName ? coachName : "Compte coach"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/coach">Dashboard</a>
              </DropdownMenuItem>
              {actions ? (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-1">{actions}</div>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
