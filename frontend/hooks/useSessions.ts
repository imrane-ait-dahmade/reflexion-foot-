"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { sessionsService } from "@/lib/api/sessions.service";
import type { ListSessionsQuery, SessionListResponse } from "@/lib/api/types";

export function useSessions(
  query: ListSessionsQuery = {},
  options: { enabled?: boolean } = {},
) {
  const page = query.page;
  const pageSize = query.page_size;
  const search = query.search;
  const status = query.status;

  const loader = useCallback(
    (signal: AbortSignal) =>
      sessionsService.list(
        {
          page,
          page_size: pageSize,
          search,
          status,
        },
        signal,
      ),
    [page, pageSize, search, status],
  );

  return useAsyncResource<SessionListResponse>(loader, options);
}
