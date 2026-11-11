"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { CoachGroupReportPanel } from "@/components/sessions/CoachGroupReportPanel";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
import { CopyCodeButton } from "@/components/sessions/CopyCodeButton";
import { formatSessionStatus } from "@/lib/format";
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
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerFilter, setPlayerFilter] = useState<"all" | "doing" | "done">("all");
  const [isPending, startTransition] = useTransition();
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const load = useCallback((quiet = false) => {
    startTransition(async () => {
      if (!quiet) setError("");
      const playerId = selectedRef.current;
      const query = playerId ? `?player=${encodeURIComponent(playerId)}` : "";
      try {
        const response = await fetch(`/api/sessions/${code}/dashboard${query}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Erreur");
        if (selectedRef.current !== playerId) return;
        setData(json);
      } catch (err) {
        if (quiet) return;
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }, [code]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(true), 0);
    const id = window.setInterval(() => load(true), 5000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(id);
    };
  }, [load, selectedId]);

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

  const onRemove = async () => {
    if (
      !window.confirm(
        "Retirer cette séance ? Elle disparaît de ta liste. Les résultats restent enregistrés pour l'analyse.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      const response = await fetch(`/api/sessions/${code}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Erreur");
      router.push("/coach");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setRemoving(false);
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
  const completedResults = data.players.reduce(
    (sum, player) => sum + player.completedTests,
    0,
  );
  const overview = sessionOverview(
    data.players.length,
    data.exercises.length,
    completedResults,
  );
  const needle = playerQuery.trim().toLowerCase();
  const exerciseTotal = data.exercises.length;
  const doingCount = data.players.filter(
    (player) => player.completedTests < exerciseTotal,
  ).length;
  const doneCount = data.players.length - doingCount;
  const visiblePlayers = data.players.filter((player) => {
    if (needle && !player.displayName.toLowerCase().includes(needle)) return false;
    if (playerFilter === "done") return player.completedTests >= exerciseTotal && exerciseTotal > 0;
    if (playerFilter === "doing") return player.completedTests < exerciseTotal;
    return true;
  });

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Code à partager</p>
            <p className="text-3xl font-bold tracking-[0.15em] text-brand sm:text-4xl">
              {data.session.code}
            </p>
          </div>
          <CopyCodeButton code={data.session.code} />
        </div>
        <p className="mt-2 text-muted">{data.session.title}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Users className="size-4 text-brand" aria-hidden />
          {data.players.length} joueur{data.players.length > 1 ? "s" : ""}
          <span>·</span>
          {exerciseTotal} exercice{exerciseTotal > 1 ? "s" : ""}
          <span>·</span>
          <span className={isActive ? "text-brand" : "text-muted"}>
            {formatSessionStatus(data.session.status)}
          </span>
          {formatEndsAt(data.session.endsAt)
            ? ` · jusqu'à ${formatEndsAt(data.session.endsAt)}`
            : ""}
        </p>
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
              {overview.completionLabel} exercices terminés
            </p>
            <p className="mt-1 text-sm text-muted">{overview.overall}</p>
          </section>
          <CoachGroupReportPanel
            code={code}
            sessionTitle={data.session.title}
            finishedCount={doneCount}
            playerCount={data.players.length}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={playerQuery}
              onChange={(event) => setPlayerQuery(event.target.value)}
              placeholder="Chercher un joueur"
              className="min-h-12 flex-1 rounded-lg border border-border bg-transparent px-3"
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", `Tous ${data.players.length}`],
                  ["doing", `En cours ${doingCount}`],
                  ["done", `Terminés ${doneCount}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlayerFilter(id)}
                  className={`rounded-full border px-3 py-2 text-sm ${
                    playerFilter === id
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        <ul className="flex flex-col gap-3">
          {visiblePlayers.length === 0 ? (
            <li className="text-sm text-muted">Aucun joueur dans cette liste.</li>
          ) : null}
          {visiblePlayers.map((player) => {
            const open = selectedId === player.sessionPlayerId;
            const progress = exerciseTotal === 0
              ? 0
              : Math.round((player.completedTests / exerciseTotal) * 100);
            return (
              <li key={player.sessionPlayerId}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedId(open ? null : player.sessionPlayerId)
                  }
                  className="flex w-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-brand hover:bg-surface-hover"
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>
                      <span className="block font-semibold">{player.displayName}</span>
                      <span className="text-sm text-muted">
                        {player.completedTests}/{exerciseTotal} exercices
                      </span>
                    </span>
                    <ChevronDown
                      className={`size-5 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full bg-brand"
                      style={{ width: `${progress}%` }}
                    />
                  </span>
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
                        <CoachAnalysisPanel
                          code={code}
                          sessionPlayerId={player.sessionPlayerId}
                          playerName={player.displayName}
                          sessionTitle={data.session.title}
                          exerciseCount={data.exercises.length}
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
                          <ul className="grid gap-3 sm:grid-cols-2">
                            {selectedResults.map((result) => {
                              const Icon =
                                TEST_ICONS[result.testSlug] ?? Timer;
                              const view = presentResult(result);
                              return (
                                <li
                                  key={result.id}
                                  className="rounded-xl border border-border bg-surface p-3"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon
                                      className="size-5 shrink-0 text-brand"
                                      aria-hidden
                                    />
                                    <div className="min-w-0">
                                      <p className="font-semibold">{view.name}</p>
                                      <p className="text-xs text-muted">{view.primaryLabel}</p>
                                    </div>
                                    <p className="ml-auto text-right">
                                      <span className="block text-lg font-bold tabular-nums text-brand">
                                        {view.headline}
                                      </span>
                                      <span className="text-xs text-muted">{view.completionStatus}</span>
                                    </p>
                                  </div>
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-sm font-medium">
                                      Détail des indicateurs
                                    </summary>
                                    <p className="mt-2 text-sm text-muted">{view.note}</p>
                                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
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

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" onClick={() => load()} disabled={isPending}>
          Rafraîchir
        </Button>
        {isActive && (
          <Button variant="secondary" onClick={onClose} disabled={closing || removing}>
            {closing ? "Fermeture…" : "Fermer la session"}
          </Button>
        )}
        <Button variant="secondary" onClick={onRemove} disabled={removing || closing}>
          {removing ? "Suppression…" : "Supprimer"}
        </Button>
        <Link
          href="/coach"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-surface px-6 font-semibold"
        >
          Mes sessions
        </Link>
        <CoachSignOutButton />
      </div>
    </section>
  );
}
