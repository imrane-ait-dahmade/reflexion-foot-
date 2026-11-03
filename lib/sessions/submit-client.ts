import type { TestSlug } from "@/lib/db/types";

export type ClientResultPayload = {
  sessionPlayerId: string;
  testSlug: TestSlug;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics?: Record<string, unknown>;
};

export async function submitClientResult(payload: ClientResultPayload) {
  let response: Response;
  try {
    response = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Pas de connexion réseau.");
  }

  let data: { error?: string; id?: string } = {};
  try {
    data = (await response.json()) as { error?: string; id?: string };
  } catch {
    throw new Error("Réponse serveur invalide.");
  }

  if (!response.ok) {
    throw new Error(data.error ?? "Échec de l'enregistrement.");
  }
  return data;
}
