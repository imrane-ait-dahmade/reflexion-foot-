"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  joinPlayerSessionV2,
  playerApiErrorMessage,
} from "@/lib/sessions/player-v2";

export function JoinSessionForm() {
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState("");
  const [personalCode, setPersonalCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    !loading && sessionCode.trim().length >= 4 && personalCode.trim().length >= 4;

  const onJoin = async () => {
    if (!canSubmit) {
      if (sessionCode.trim().length < 4) {
        setError("Le code de session doit contenir au moins 4 caractères.");
        return;
      }
      if (personalCode.trim().length < 4) {
        setError("Entre ton code joueur (donné par ton entraîneur).");
        return;
      }
      return;
    }

    setLoading(true);
    setError("");
    try {
      const state = await joinPlayerSessionV2({
        sessionCode,
        personalCode,
      });
      router.replace(`/play/${state.code}`);
    } catch (err) {
      setError(
        playerApiErrorMessage(err, "Impossible de rejoindre la session."),
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
          value={sessionCode}
          onChange={(event) =>
            setSessionCode(
              event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
            )
          }
          placeholder="ABC123"
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          className="min-h-12 rounded-lg border border-border bg-transparent px-3 tracking-[0.2em]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ton code joueur
        <input
          value={personalCode}
          onChange={(event) => setPersonalCode(event.target.value)}
          placeholder="Code personnel"
          maxLength={64}
          autoComplete="off"
          className="min-h-12 rounded-lg border border-border bg-transparent px-3"
        />
      </label>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={!canSubmit}>
        {loading ? "Connexion…" : "Continuer"}
      </Button>
      <p className="text-center text-xs text-muted">
        Demande à ton entraîneur le code de séance et ton code joueur. Pas de
        compte email.
      </p>
    </form>
  );
}
