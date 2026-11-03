"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";
import { TESTS } from "@/lib/tests/registry";

type CreatedSession = {
  code: string;
  title: string;
  exercises: string[];
  endsAt: string | null;
};

type SessionListItem = {
  id: string;
  code: string;
  title: string;
  status: string;
  createdAt: string;
  endsAt: string | null;
  exerciseCount: number;
};

function formatEndsAt(endsAt: string | null) {
  if (!endsAt) return null;
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CoachCreateSession() {
  const router = useRouter();
  const [title, setTitle] = useState("Séance vision");
  const [exerciseCount, setExerciseCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedSession | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isPending, startTransition] = useTransition();

  const loadSessions = useCallback(() => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/sessions");
        const data = await response.json();
        if (response.ok) setSessions(data.sessions ?? []);
      } catch {
        // Keep last list on refresh failure.
      }
    });
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, exerciseCount }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setCreated({
        code: data.code,
        title: data.title,
        exercises: data.exercises,
        endsAt: data.endsAt ?? null,
      });
      loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    await authClient.signOut();
    router.push("/coach/login");
    router.refresh();
  };

  if (created) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border p-5">
        <p className="text-sm text-muted">Session créée</p>
        <h2 className="text-xl font-semibold">{created.title}</h2>
        <div className="rounded-xl bg-surface px-4 py-6 text-center">
          <p className="text-sm uppercase tracking-wide text-muted">
            Code à partager
          </p>
          <p className="mt-2 text-5xl font-bold tracking-[0.2em] text-brand">
            {created.code}
          </p>
          {formatEndsAt(created.endsAt) && (
            <p className="mt-3 text-sm text-muted">
              Valide jusqu&apos;à {formatEndsAt(created.endsAt)}
            </p>
          )}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {created.exercises.map((slug) => {
            const test = TESTS.find((item) => item.slug === slug);
            return <li key={slug}>{test?.name ?? slug}</li>;
          })}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/coach/sessions/${created.code}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-brand px-6 font-semibold text-white"
          >
            Voir les résultats
          </Link>
          <Button
            variant="secondary"
            onClick={() => setCreated(null)}
            className="flex-1"
          >
            Nouvelle session
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onSignOut}>
          Se déconnecter
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <h2 className="font-semibold">Nouvelle session</h2>
        <label className="flex flex-col gap-1 text-sm">
          Titre de la session
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="min-h-12 rounded-lg border border-border bg-transparent px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nombre d&apos;exercices aléatoires
          <select
            value={exerciseCount}
            onChange={(event) => setExerciseCount(Number(event.target.value))}
            className="min-h-12 rounded-lg border border-border bg-transparent px-3"
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={onCreate} disabled={loading}>
          {loading ? "Création…" : "Créer la session"}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Mes sessions</h2>
          <Button variant="secondary" onClick={loadSessions} disabled={isPending}>
            Rafraîchir
          </Button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">Aucune session pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/coach/sessions/${session.code}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 hover:bg-surface-hover"
                >
                  <div>
                    <p className="font-semibold">{session.title}</p>
                    <p className="text-sm text-muted">
                      Code {session.code} · {session.exerciseCount} exercice(s)
                      {session.endsAt
                        ? ` · jusqu'à ${formatEndsAt(session.endsAt)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`text-sm uppercase ${
                      session.status === "active" ? "text-brand" : "text-muted"
                    }`}
                  >
                    {session.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
