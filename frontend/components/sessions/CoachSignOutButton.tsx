"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authBffClient } from "@/lib/api/auth-bff.client";

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
      await authBffClient.logout();
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
