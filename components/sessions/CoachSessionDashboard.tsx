"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Binary,
  ChevronDown,
  Crosshair,
  Eye,
  Grid3X3,
  Search,
  Spline,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CoachAnalysisPanel } from "@/components/sessions/CoachAnalysisPanel";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
import { presentResult, sessionOverview } from "@/lib/tests/results/present";

type ResultRow = {
  id: string;
  sessionPlayerId: string;
  testSlug: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics: Record<string, unknown> | null;
  completedAt: string;
};

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
    averageScore: number | null;
    totalScore: number | null;
    joinedAt: string;
  }[];
  results: ResultRow[];
};

type CoachSessionDashboardProps = {
  code: string;
};

const TEST_ICONS: Record<string, typeof Zap> = {
  "visual-tracking": Crosshair,
  "visual-memory": Grid3X3,
  "reaction-time": Zap,
  "peripheral-vision": Eye,
  "football-visual-scanning": Crosshair,
  "sequential-visual-search": Search,
  "digit-memory": Binary,
  "dual-target-tracking": Spline,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
          // Keep last snapshot.
        }
      });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [code]);

  const selectedPlayer = useMemo(
    () => data?.players.find((player) => player.sessionPlayerId === selectedId),
    [data, selectedId],
  );

  const selectedResults = useMemo(() => {
    if (!data || !selectedId) return [];
    return data.results
      .filter((result) => result.sessionPlayerId === selectedId)
      .sort(
        (a, b) =>
          new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
      );
  }, [data, selectedId]);

  const onClose = async () => {
    if (
      !window.confirm(
        "Fermer cette session ? Les joueurs ne pourront plus continuer.",
      )
    ) {
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
  const overview = sessionOverview(
    data.players.length,
    data.exercises.length,
    data.results.length,
  );

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">Code</p>
        <p className="text-3xl font-bold tracking-[0.15em] text-brand">
          {data.session.code}
        </p>
        <p className="mt-1 text-muted">{data.session.title}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Users className="size-4 text-brand" aria-hidden />
          {data.players.length} joueur{data.players.length > 1 ? "s" : ""}
          <span>·</span>
          {data.exercises.length} exercice
          {data.exercises.length > 1 ? "s" : ""} (ordre aléatoire)
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
        <h2 className="text-lg font-semibold">Joueurs</h2>
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
          <CoachSignOutButton />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {data.players.length === 0 ? (
        <p className="text-muted">
          Aucun joueur pour l&apos;instant. Partage le code.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <section className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold">
              {overview.players} joueur{overview.players > 1 ? "s" : ""} ·{" "}
              {overview.completionLabel} exercices terminés
            </p>
            <p className="mt-1 text-sm text-muted">{overview.overall}</p>
          </section>
        <ul className="flex flex-col gap-3">
          {data.players.map((player) => {
            const open = selectedId === player.sessionPlayerId;
            return (
              <li key={player.sessionPlayerId}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedId(open ? null : player.sessionPlayerId)
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-brand hover:bg-surface-hover"
                >
                  <div>
                    <p className="font-semibold">{player.displayName}</p>
                    <p className="text-sm text-muted">
                      {player.completedTests} / {data.exercises.length}{" "}
                      exercices
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-brand">
                        {player.completedTests}/{data.exercises.length}
                      </p>
                      <p className="text-xs text-muted">terminés</p>
                    </div>
                    <ChevronDown
                      className={`size-5 text-muted transition ${open ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {open && selectedPlayer?.sessionPlayerId === player.sessionPlayerId ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                        <div className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                          <p className="text-xs text-muted">Progression</p>
                          <p className="font-bold tabular-nums">
                            {player.completedTests}/{data.exercises.length} exercices
                          </p>
                        </div>

                        <CoachAnalysisPanel
                          code={code}
                          sessionPlayerId={player.sessionPlayerId}
                          playerName={player.displayName}
                          sessionTitle={data.session.title}
                          results={selectedResults.map((result) => {
                            const view = presentResult(result);
                            return {
                              id: result.id,
                              name: view.name,
                              headline: view.headline,
                              note: view.note,
                              lines: view.lines,
                            };
                          })}
                        />
                        {selectedResults.length === 0 ? (
                          <p className="text-sm text-muted">
                            Aucun résultat encore.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-3">
                            {selectedResults.map((result) => {
                              const Icon =
                                TEST_ICONS[result.testSlug] ?? Timer;
                              const view = presentResult(result);
                              return (
                                <li
                                  key={result.id}
                                  className="rounded-xl border border-border bg-surface p-3"
                                >
                                  <div className="mb-2 flex items-center gap-2">
                                    <Icon
                                      className="size-5 text-brand"
                                      aria-hidden
                                    />
                                    <div>
                                      <p className="font-semibold">{view.name}</p>
                                      <p className="text-xs text-muted">{view.primaryLabel}</p>
                                    </div>
                                    <p className="ml-auto text-lg font-bold tabular-nums text-brand">
                                      {view.headline}
                                    </p>
                                  </div>
                                  <p className="mb-2 text-sm text-muted">{view.note}</p>
                                  <p className="mb-2 text-xs uppercase tracking-[0.14em] text-brand">
                                    {view.completionStatus}
                                  </p>
                                  <details>
                                    <summary className="cursor-pointer text-sm font-medium">
                                      Détail des indicateurs
                                    </summary>
                                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                                      {view.lines.map((line) => (
                                        <div
                                          key={line.label}
                                          className="flex justify-between gap-2 border-b border-border/60 py-1"
                                        >
                                          <dt className="text-muted">
                                            {line.label}
                                          </dt>
                                          <dd className="tabular-nums font-medium">
                                            {line.value}
                                          </dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </details>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
        </div>
      )}
    </section>
  );
}
