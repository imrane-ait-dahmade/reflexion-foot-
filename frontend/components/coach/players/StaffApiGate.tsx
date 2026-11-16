"use client";

import { useEffect, useState } from "react";
import { KeyRound, Unplug } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getApiBaseUrl } from "@/lib/api/config";

type StaffApiGateProps = {
  checking: boolean;
  error: string | null;
  onLogin: (email: string, password: string) => Promise<unknown>;
};

/**
 * Connects coach UI to FastAPI staff JWT without replacing Better Auth page access.
 */
export function StaffApiGate({ checking, error, onLogin }: StaffApiGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const [originHint, setOriginHint] = useState(
    "même origine (proxy Next → FastAPI /api/v1)",
  );

  useEffect(() => {
    queueMicrotask(() => {
      setOriginHint(
        getApiBaseUrl() || "même origine (proxy Next → FastAPI /api/v1)",
      );
    });
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setLocalError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Connexion API impossible.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="mb-3 inline-flex size-12 items-center justify-center rounded-xl border border-border bg-brand-soft text-brand">
          <KeyRound className="size-5" aria-hidden />
        </div>
        <CardTitle>API staff requise</CardTitle>
        <CardDescription>
          La gestion des joueurs utilise FastAPI (JWT). Connecte un compte staff
          V2 — distinct de la session entraîneur Better Auth.
        </CardDescription>
      </CardHeader>

      <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
        <Input
          label="Email staff"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          hint="Identifiants FastAPI /api/v1/auth/login"
        />

        {(localError || error) && !checking ? (
          <p
            role="alert"
            className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger"
          >
            {localError || error}
          </p>
        ) : null}

        <Button
          type="submit"
          className="min-h-12 w-full"
          disabled={submitting || checking || !email || password.length < 1}
        >
          {submitting || checking ? "Connexion…" : "Connecter l’API"}
        </Button>
      </form>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <Unplug className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Cible : {originHint}. Si FastAPI est arrêté, démarre le backend puis
        réessaie.
      </p>
    </Card>
  );
}
