"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

type CoachAuthFormProps = {
  mode: "login" | "register";
  nextPath?: string;
};

/** Soft client navigations right after Set-Cookie can flash not-found under cacheComponents. */
function safeCoachDestination(path: string) {
  if (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/coach/login") &&
    !path.startsWith("/coach/register")
  ) {
    return path;
  }
  return "/coach";
}

function frenchAuthError(message: string, mode: "login" | "register") {
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid email or password") ||
    lower.includes("invalid credentials")
  ) {
    return "Email ou mot de passe incorrect.";
  }
  if (lower.includes("already") || lower.includes("exists")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (
    lower.includes("password") &&
    (lower.includes("8") || lower.includes("short") || lower.includes("least"))
  ) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (lower.includes("too many") || lower.includes("rate limit")) {
    return "Trop de tentatives. Réessaie dans un moment.";
  }
  if (/[àâéèêëïîôùûüç]/i.test(message)) return message;
  return mode === "login"
    ? "Connexion impossible. Réessaie."
    : "Inscription impossible. Réessaie.";
}

export function CoachAuthForm({ mode, nextPath = "/coach" }: CoachAuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const destination = safeCoachDestination(nextPath);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        const result = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
          callbackURL: destination,
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Inscription impossible.");
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: destination,
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Connexion impossible.");
        }
      }
      // Full reload so the new session cookie is on the first /coach request.
      window.location.assign(destination);
    } catch (err) {
      setError(
        frenchAuthError(err instanceof Error ? err.message : "", mode),
      );
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      {mode === "register" && (
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-12 rounded-lg border border-border bg-transparent px-3"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 rounded-lg border border-border bg-transparent px-3"
          autoComplete="email"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 rounded-lg border border-border bg-transparent px-3"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          aria-describedby="password-hint"
        />
      </label>
      <p id="password-hint" className="-mt-2 text-xs text-muted">
        8 caractères minimum.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Button
        onClick={onSubmit}
        disabled={
          loading ||
          !email.trim() ||
          password.length < 8 ||
          (mode === "register" && name.trim().length < 2)
        }
      >
        {loading
          ? "Patiente…"
          : mode === "login"
            ? "Se connecter"
            : "Créer mon compte"}
      </Button>
      <p className="text-sm text-muted">
        {mode === "login" ? (
          <>
            Pas encore de compte ?{" "}
            <Link href="/coach/register" className="underline">
              S&apos;inscrire
            </Link>
          </>
        ) : (
          <>
            Déjà inscrit ?{" "}
            <Link href="/coach/login" className="underline">
              Se connecter
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
