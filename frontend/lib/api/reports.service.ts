/**
 * AI reports HTTP API status (FastAPI V2).
 *
 * `AiReport` models exist in the backend, and permissions such as
 * `ai.generate` / `results.view` are seeded, but **no presentation router**
 * is mounted on `api_router` yet.
 *
 * V1 AI reports remain on Next.js Route Handlers under `/api/sessions/.../reports`.
 * Do not call this service until FastAPI exposes report endpoints.
 */

export const reportsService = {
  /**
   * Placeholder — FastAPI has no `/reports` routes at inspection time.
   * @throws Error always
   */
  unavailable(): never {
    throw new Error(
      "AI reports are not exposed on the FastAPI HTTP API yet. Use V1 Next.js report routes.",
    );
  },
};
