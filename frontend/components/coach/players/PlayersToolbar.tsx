"use client";

import { FileSpreadsheet, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type PlayersToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  disabled?: boolean;
};

export function PlayersToolbar({
  search,
  onSearchChange,
  onCreate,
  onImport,
  onRefresh,
  refreshing,
  disabled,
}: PlayersToolbarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          aria-label="Rechercher un joueur"
          placeholder="Nom, email…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-11"
          disabled={disabled}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={onRefresh}
          disabled={disabled || refreshing}
        >
          <RefreshCw
            className={cn("size-4", refreshing && "animate-spin")}
            aria-hidden
          />
          Rafraîchir
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={onImport}
          disabled={disabled}
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          Import Excel
        </Button>
        <Button size="sm" className="min-h-11" onClick={onCreate} disabled={disabled}>
          <Plus className="size-4" aria-hidden />
          Nouveau joueur
        </Button>
      </div>
    </div>
  );
}
