"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { savePlayerSession } from "@/lib/sessions/player-session";
import type { TestSlug } from "@/lib/db/types";

function friendlyJoinError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("introuvable") || lower.includes("invalid") || lower.includes("code")) {
    return "Code incorrect ou session introuvable. Vérifie auprès de ton entraîneur.";
  }
  if (lower.includes("fermée") || lower.includes("expir")) {
    return "Cette session est fermée ou a expiré. Demande un nouveau code.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Pas de connexion. Vérifie ton réseau puis réessaie.";
  }
  return message || "Impossible de rejoindre la session.";
}

export function JoinSessionForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    !loading && code.trim().length >= 4 && displayName.trim().length >= 2;

  const onJoin = async () => {
    if (!canSubmit) {
      if (code.trim().length < 4) {
        setError("Le code doit contenir au moins 4 caractères.");
        return;
      }
      if (displayName.trim().length < 2) {
        setError("Indique ton prénom (au moins 2 lettres).");
        return;
      }
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          displayName: displayName.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }

      savePlayerSession({
        code: data.session.code,
        sessionId: data.session.id,
        sessionPlayerId: data.sessionPlayerId,
        displayName: data.displayName,
        exercises: data.exercises.map(
          (exercise: { testSlug: TestSlug }) => exercise.testSlug,
        ),
      });

      // Hub auto-redirects to the first unfinished exercise in order.
      router.replace(`/play/${data.session.code}`);
    } catch (err) {
      setError(
        friendlyJoinError(err instanceof Error ? err.message : "Erreur"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onJoin();
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Code de session
        <input
          value={code}
          onChange={(event) =>
            setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          placeholder="ABC123"
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          className="min-h-12 rounded-lg border border-border bg-transparent px-3 tracking-[0.2em]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ton prénom / nom
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Ex: Amine"
          maxLength={40}
          autoComplete="nickname"
          className="min-h-12 rounded-lg border border-border bg-transparent px-3"
        />
      </label>
      {error && (
        <p className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!canSubmit}>
        {loading ? "Connexion…" : "Continuer"}
      </Button>
      <p className="text-center text-xs text-muted">
        Pas de compte requis. Utilise le même appareil jusqu&apos;à la fin des
        exercices.
      </p>
    </form>
  );
}
