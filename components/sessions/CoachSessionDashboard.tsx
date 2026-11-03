"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Crosshair,
  Eye,
  Grid3X3,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
import { TESTS } from "@/lib/tests/registry";
import { formatMs, formatPercent } from "@/lib/format";

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
    averageScore: number;
    totalScore: number;
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

function metricLines(result: ResultRow) {
  const lines: { label: string; value: string }[] = [
    { label: "Score", value: `${result.score}/100` },
    { label: "Précision", value: formatPercent(result.accuracy) },
    { label: "Bonnes réponses", value: String(result.correctAnswers) },
    { label: "Erreurs", value: String(result.errors) },
    {
      label: "Réaction moy.",
      value: formatMs(result.averageReactionMs),
    },
    { label: "Meilleure réaction", value: formatMs(result.bestReactionMs) },
    {
      label: "Durée",
      value: `${Math.round(result.durationMs / 1000)} s`,
    },
  ];

  const metrics = result.metrics ?? {};
  if (typeof metrics.targetsFound === "number") {
    lines.push({ label: "Cibles trouvées", value: String(metrics.targetsFound) });
  }
  if (typeof metrics.roundsCompleted === "number") {
    lines.push({ label: "Manches", value: String(metrics.roundsCompleted) });
  }
  if (typeof metrics.falseStarts === "number") {
    lines.push({ label: "Faux départs", value: String(metrics.falseStarts) });
  }
  if (typeof metrics.missed === "number") {
    lines.push({ label: "Manqués", value: String(metrics.missed) });
  }
  if (typeof metrics.leftAccuracy === "number") {
    lines.push({
      label: "Précision gauche",
      value: formatPercent(metrics.leftAccuracy),
    });
  }
  if (typeof metrics.rightAccuracy === "number") {
    lines.push({
      label: "Précision droite",
      value: formatPercent(metrics.rightAccuracy),
    });
  }
  if (typeof metrics.incorrect === "number") {
    lines.push({ label: "Incorrects", value: String(metrics.incorrect) });
  }
  for (const [key, label] of [
    ["closest", "Proche du ballon"],
    ["defender", "Défenseur"],
    ["free", "Joueur libre"],
  ] as const) {
    const hits = metrics[`${key}Correct`];
    const total = metrics[`${key}Total`];
    if (typeof hits === "number" && typeof total === "number") {
      lines.push({ label, value: `${hits}/${total}` });
    }
  }

  return lines;
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
                        {player.averageScore}
                      </p>
                      <p className="text-xs text-muted">moyenne</p>
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
                        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="rounded-lg border border-border bg-surface px-2 py-2">
                            <p className="text-xs text-muted">Total</p>
                            <p className="font-bold tabular-nums">
                              {player.totalScore}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-surface px-2 py-2">
                            <p className="text-xs text-muted">Moyenne</p>
                            <p className="font-bold tabular-nums text-brand">
                              {player.averageScore}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-surface px-2 py-2">
                            <p className="text-xs text-muted">Progression</p>
                            <p className="font-bold tabular-nums">
                              {player.completedTests}/{data.exercises.length}
                            </p>
                          </div>
                        </div>

                        {selectedResults.length === 0 ? (
                          <p className="text-sm text-muted">
                            Aucun résultat encore.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-3">
                            {selectedResults.map((result) => {
                              const Icon =
                                TEST_ICONS[result.testSlug] ?? Timer;
                              const name =
                                TESTS.find((test) => test.slug === result.testSlug)
                                  ?.name ?? result.testSlug;
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
                                    <p className="font-semibold">{name}</p>
                                    <p className="ml-auto text-lg font-bold tabular-nums text-brand">
                                      {result.score}/100
                                    </p>
                                  </div>
                                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                                    {metricLines(result).map((line) => (
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
      )}
    </section>
  );
}
