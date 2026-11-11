"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

type CoachSignOutButtonProps = {
  className?: string;
};

export function CoachSignOutButton({ className }: CoachSignOutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSignOut = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message ?? "Déconnexion impossible.");
      }
      window.location.assign("/coach/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        variant="secondary"
        onClick={onSignOut}
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? "Déconnexion…" : "Se déconnecter"}
      </Button>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
