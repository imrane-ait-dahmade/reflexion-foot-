"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  PlayerFilters,
  type PlayerFilterState,
} from "@/components/coach/players/PlayerFilters";
import { PlayerForm } from "@/components/coach/players/PlayerForm";
import { PlayerImportDialog } from "@/components/coach/players/PlayerImportDialog";
import { PlayersHeader } from "@/components/coach/players/PlayersHeader";
import { PlayersList } from "@/components/coach/players/PlayersList";
import { PlayersToolbar } from "@/components/coach/players/PlayersToolbar";
import type { PlayerTeamMap } from "@/components/coach/players/player-utils";
import { StaffApiGate } from "@/components/coach/players/StaffApiGate";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePlayers } from "@/hooks/usePlayers";
import { usePositions } from "@/hooks/usePositions";
import { useStaffApiSession } from "@/hooks/useStaffApiSession";
import { useTeams } from "@/hooks/useTeams";
import { teamsService } from "@/lib/api/teams.service";
import type { PlayerResponse } from "@/lib/api/types";

export function PlayersPage() {
  const reduce = useReducedMotion();
  const staff = useStaffApiSession();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PlayerFilterState>({
    teamId: "",
    positionId: "",
    status: "active",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [teamMap, setTeamMap] = useState<PlayerTeamMap>({});
  const [teamFilterIds, setTeamFilterIds] = useState<string[] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useMemo(
    () => ({
      page: 1,
      page_size: 100,
      search: search || undefined,
      primary_position_id: filters.positionId || undefined,
      is_active:
        filters.status === "all"
          ? undefined
          : filters.status === "active",
    }),
    [search, filters.positionId, filters.status],
  );

  const players = usePlayers(listQuery, { enabled: staff.ready });
  const positions = usePositions({ enabled: staff.ready });
  const teams = useTeams(
    { page_size: 100, is_active: true },
    { enabled: staff.ready },
  );

  const rebuildTeamMap = useCallback(async () => {
    const items = teams.data?.items ?? [];
    if (items.length === 0) {
      setTeamMap({});
      return;
    }
    const next: PlayerTeamMap = {};
    await Promise.all(
      items.map(async (team) => {
        try {
          const members = await teamsService.listPlayers(team.id);
          for (const member of members) {
            if (!member.is_active) continue;
            next[member.player_id] = [
              ...(next[member.player_id] ?? []),
              team.name,
            ];
          }
        } catch {
          /* team membership optional for list rendering */
        }
      }),
    );
    setTeamMap(next);
  }, [teams.data]);

  useEffect(() => {
    if (!staff.ready) return;
    queueMicrotask(() => {
      void rebuildTeamMap();
    });
  }, [staff.ready, rebuildTeamMap]);

  useEffect(() => {
    if (!staff.ready) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!filters.teamId) {
        setTeamFilterIds(null);
        return;
      }
      void teamsService
        .listPlayers(filters.teamId)
        .then((rows) => {
          if (!active) return;
          setTeamFilterIds(
            rows.filter((row) => row.is_active).map((row) => row.player_id),
          );
        })
        .catch(() => {
          if (!active) return;
          setTeamFilterIds([]);
        });
    });
    return () => {
      active = false;
    };
  }, [filters.teamId, staff.ready]);

  const visiblePlayers: PlayerResponse[] = useMemo(() => {
    const items = players.data?.items ?? [];
    if (!teamFilterIds) return items;
    const allowed = new Set(teamFilterIds);
    return items.filter((player) => allowed.has(player.id));
  }, [players.data, teamFilterIds]);

  const fade = reduce
    ? undefined
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 },
      };

  if (staff.checking && !staff.ready) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!staff.ready) {
    return (
      <StaffApiGate
        checking={staff.checking}
        error={staff.error}
        onLogin={staff.login}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <motion.div {...fade}>
        <PlayersHeader
          total={players.data?.total ?? null}
          loading={players.loading}
        />
      </motion.div>

      <motion.div
        {...fade}
        transition={{ ...(fade?.transition ?? {}), delay: reduce ? 0 : 0.04 }}
        className="flex flex-col gap-4"
      >
        <PlayersToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          onCreate={() => setCreateOpen(true)}
          onImport={() => setImportOpen(true)}
          onRefresh={() => {
            players.reload();
            void rebuildTeamMap();
          }}
          refreshing={players.loading}
        />
        <PlayerFilters
          value={filters}
          onChange={setFilters}
          teams={teams.data?.items ?? []}
          positions={positions.data ?? []}
        />
      </motion.div>

      {players.error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger"
        >
          {players.error}
        </p>
      ) : null}

      <motion.div
        {...fade}
        transition={{ ...(fade?.transition ?? {}), delay: reduce ? 0 : 0.08 }}
      >
        <PlayersList
          players={visiblePlayers}
          teamMap={teamMap}
          loaded={!players.loading || Boolean(players.data)}
          onCreate={() => setCreateOpen(true)}
        />
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>
          Connecté API : {staff.user?.email ?? "staff"}
        </p>
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => void staff.logout()}
        >
          Déconnecter l’API staff
        </button>
      </div>

      <PlayerForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        positions={positions.data ?? []}
        teams={teams.data?.items ?? []}
        onSaved={() => {
          players.reload();
          void rebuildTeamMap();
        }}
      />

      <PlayerImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        teams={teams.data?.items ?? []}
        onImported={() => {
          players.reload();
          void rebuildTeamMap();
        }}
      />
    </div>
  );
}
