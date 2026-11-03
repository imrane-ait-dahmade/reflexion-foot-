"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TESTS } from "@/lib/tests/registry";

type DashboardData = {
  session: {
    code: string;
    title: string;
    status: string;
    endsAt: string | null;
  };
  exercises: { testSlug: string }[];
  players: {
    sessionPlayerId: string;
    displayName: string;
    completedTests: number;
    averageScore: number;
    totalScore: number;
  }[];
  results: {
    sessionPlayerId: string;
    testSlug: string;
    score: number;
    accuracy: number;
  }[];
};

type CoachSessionDashboardProps = {
  code: string;
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

export function CoachSessionDashboard({ code }: CoachSessionDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(`/api/sessions/${code}/dashboard`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Erreur");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }, [code]);

  useEffect(() => {
    const tick = () => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/sessions/${code}/dashboard`);
          const json = await response.json();
          if (!response.ok) return;
          setData(json);
        } catch {
          // Keep the last successful snapshot while polling.
        }
      });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [code]);

  const onClose = async () => {
    if (!window.confirm("Fermer cette session ? Les joueurs ne pourront plus rejoindre ni envoyer de nouveaux résultats.")) {
      return;
    }
    setClosing(true);
    try {
      const response = await fetch(`/api/sessions/${code}/close`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Erreur");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setClosing(false);
    }
  };

  if (!data && !error) {
    return <p className="text-muted">Chargement…</p>;
  }
  if (error && !data) {
    return <p className="text-danger">{error}</p>;
  }
  if (!data) return null;

  const isActive = data.session.status === "active";

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">Code</p>
        <p className="text-3xl font-bold tracking-[0.15em] text-brand">
          {data.session.code}
        </p>
        <p className="mt-1 text-muted">{data.session.title}</p>
        <p className="text-sm text-muted">
          Exercices :{" "}
          {data.exercises
            .map(
              (exercise) =>
                TESTS.find((test) => test.slug === exercise.testSlug)?.name ??
                exercise.testSlug,
            )
            .join(" · ")}
        </p>
        <p className="mt-2 text-sm">
          Statut :{" "}
          <span className={isActive ? "text-brand" : "text-muted"}>
            {data.session.status}
          </span>
          {formatEndsAt(data.session.endsAt)
            ? ` · jusqu'à ${formatEndsAt(data.session.endsAt)}`
            : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          Joueurs ({data.players.length})
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={load} disabled={isPending}>
            Rafraîchir
          </Button>
          {isActive && (
            <Button variant="secondary" onClick={onClose} disabled={closing}>
              {closing ? "Fermeture…" : "Fermer la session"}
            </Button>
          )}
          <Link
            href="/coach"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-surface px-6 font-semibold"
          >
            Mes sessions
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {data.players.length === 0 ? (
        <p className="text-muted">
          Aucun joueur pour l&apos;instant. Partage le code.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.players.map((player) => {
            const playerResults = data.results.filter(
              (result) => result.sessionPlayerId === player.sessionPlayerId,
            );
            return (
              <li
                key={player.sessionPlayerId}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{player.displayName}</p>
                  <p className="text-sm tabular-nums text-muted">
                    Moy. {player.averageScore} · Total {player.totalScore}
                  </p>
                </div>
                <p className="text-sm text-muted">
                  {player.completedTests} / {data.exercises.length} tests
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {playerResults.map((result) => (
                    <li
                      key={`${result.sessionPlayerId}-${result.testSlug}`}
                      className="flex justify-between gap-2 border-b border-border py-1"
                    >
                      <span>
                        {TESTS.find((test) => test.slug === result.testSlug)
                          ?.name ?? result.testSlug}
                      </span>
                      <span className="tabular-nums font-medium text-brand">
                        {result.score}/100 · {result.accuracy}%
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
