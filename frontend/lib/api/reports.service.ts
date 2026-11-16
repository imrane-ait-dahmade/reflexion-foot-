/**
 * AI reports via FastAPI V2 (`/api/v1/ai/reports`).
 */

import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

export type AiReportType = "test" | "session" | "progress" | "group";

export type AiReportResponse = {
  id: string;
  report_type: AiReportType;
  session_player_id: string | null;
  training_session_id: string | null;
  report_data: Record<string, unknown>;
  model_name: string | null;
  prompt_version: string | null;
  created_at: string;
};

export type AiReportListResponse = {
  items: AiReportResponse[];
  total: number;
};

export type GenerateReportRequest = {
  report_type: AiReportType;
  session_player_id?: string | null;
  training_session_id?: string | null;
  focus_test_slug?: string | null;
  force?: boolean;
};

export const reportsService = {
  listForSession(
    trainingSessionId: string,
    signal?: AbortSignal,
  ): Promise<AiReportListResponse> {
    return apiClient.get<AiReportListResponse>(
      endpoints.aiReports.bySession(trainingSessionId),
      { auth: "staff", signal },
    );
  },

  get(reportId: string, signal?: AbortSignal): Promise<AiReportResponse> {
    return apiClient.get<AiReportResponse>(endpoints.aiReports.byId(reportId), {
      auth: "staff",
      signal,
    });
  },

  generate(payload: GenerateReportRequest): Promise<AiReportResponse> {
    return apiClient.post<AiReportResponse>(endpoints.aiReports.create, payload, {
      auth: "staff",
    });
  },
};
