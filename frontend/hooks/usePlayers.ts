"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { playersService } from "@/lib/api/players.service";
import type { ListPlayersQuery, PlayerListResponse } from "@/lib/api/types";

export function usePlayers(
  query: ListPlayersQuery = {},
  options: { enabled?: boolean } = {},
) {
  const page = query.page;
  const pageSize = query.page_size;
  const search = query.search;
  const primaryPositionId = query.primary_position_id;
  const isActive = query.is_active;

  const loader = useCallback(
    (signal: AbortSignal) =>
      playersService.list(
        {
          page,
          page_size: pageSize,
          search,
          primary_position_id: primaryPositionId,
          is_active: isActive,
        },
        signal,
      ),
    [page, pageSize, search, primaryPositionId, isActive],
  );

  return useAsyncResource<PlayerListResponse>(loader, options);
}
