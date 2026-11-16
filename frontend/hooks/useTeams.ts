"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { teamsService } from "@/lib/api/teams.service";
import type { ListTeamsQuery, TeamListResponse } from "@/lib/api/types";

export function useTeams(
  query: ListTeamsQuery = {},
  options: { enabled?: boolean } = {},
) {
  const page = query.page;
  const pageSize = query.page_size;
  const search = query.search;
  const isActive = query.is_active;

  const loader = useCallback(
    (signal: AbortSignal) =>
      teamsService.list(
        {
          page,
          page_size: pageSize,
          search,
          is_active: isActive,
        },
        signal,
      ),
    [page, pageSize, search, isActive],
  );

  return useAsyncResource<TeamListResponse>(loader, options);
}
