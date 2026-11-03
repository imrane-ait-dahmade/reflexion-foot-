"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

type CoachAuthFormProps = {
  mode: "login" | "register";
  nextPath?: string;
};

export function CoachAuthForm({ mode, nextPath = "/coach" }: CoachAuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        const result = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
          callbackURL: nextPath,
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Inscription impossible.");
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: nextPath,
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Connexion impossible.");
        }
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
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
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
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
