"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
import { StaffApiGate } from "@/components/coach/players/StaffApiGate";
import { Button } from "@/components/ui/Button";
import { CoachAnalysisPanel } from "@/components/sessions/CoachAnalysisPanel";
import { CoachGroupReportPanel } from "@/components/sessions/CoachGroupReportPanel";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
import { CopyCodeButton } from "@/components/sessions/CopyCodeButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useStaffApiSession } from "@/hooks/useStaffApiSession";
import { isApiError } from "@/lib/api/errors";
import { sessionsService } from "@/lib/api/sessions.service";
import type {
  SessionDashboardPlayer,
  SessionDashboardResponse,
  SessionDashboardResult,
} from "@/lib/api/types";
import { formatSessionStatus } from "@/lib/format";
import { canCancelSession, isSessionJoinable } from "@/lib/sessions/v2-status";
import {
  presentResult,
  sessionOverview,
  type PresentableResult,
} from "@/lib/tests/results/present";

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

function num(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toPresentable(result: SessionDashboardResult): PresentableResult {
  const metrics =
    result.result_data && typeof result.result_data === "object"
      ? (result.result_data as Record<string, unknown>)
      : {};
  return {
    testSlug: result.test_slug,
    score: result.score,
    accuracy: Number(result.accuracy) || 0,
    correctAnswers: num(metrics, "correctAnswers") || num(metrics, "correct_answers"),
    errors: num(metrics, "errors"),
    averageReactionMs:
      num(metrics, "averageReactionMs") || num(metrics, "average_reaction_ms"),
    bestReactionMs:
      num(metrics, "bestReactionMs") || num(metrics, "best_reaction_ms"),
    durationMs:
      num(metrics, "durationMs") ||
      num(metrics, "duration_ms") ||
      result.response_time_ms,
    metrics,
    completedAt: result.completed_at ?? undefined,
  };
}

export function CoachSessionDashboard({ code }: CoachSessionDashboardProps) {
  const router = useRouter();
  const staff = useStaffApiSession();
  const [data, setData] = useState<SessionDashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerFilter, setPlayerFilter] = useState<"all" | "doing" | "done">(
    "all",
  );
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const load = useCallback(
    async (quiet = false) => {
      if (!staff.ready) return;
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const json = await sessionsService.dashboardByCode(code);
        setData(json);
        if (!quiet) setError("");
      } catch (err) {
        if (quiet) return;
        setError(
          isApiError(err)
            ? err.message
            : err instanceof Error
              ? err.message
              : "Erreur",
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [code, staff.ready],
  );

  useEffect(() => {
    if (!staff.ready) return;
    const boot = window.setTimeout(() => void load(false), 0);
    const id = window.setInterval(() => void load(true), 5000);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [staff.ready, load]);

  const selectedResults = useMemo(() => {
    if (!data || !selectedId) return [];
    return data.results
      .filter((result) => result.session_player_id === selectedId)
      .sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return aTime - bTime;
      });
  }, [data, selectedId]);

  const onClose = async () => {
    if (!data) return;
    if (
      !window.confirm(
        "Fermer cette session ? Les joueurs ne pourront plus continuer.",
      )
    ) {
      return;
    }
    setClosing(true);
    setError("");
    try {
      await sessionsService.complete(data.session.id);
      await load();
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erreur",
      );
    } finally {
      setClosing(false);
    }
  };

  const onStart = async () => {
    if (!data) return;
    setStarting(true);
    setError("");
    try {
      await sessionsService.start(data.session.id);
      await load();
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erreur",
      );
    } finally {
      setStarting(false);
    }
  };

  const onCancel = async () => {
    if (!data) return;
    if (
      !window.confirm(
        "Annuler cette séance ? Elle disparaît des actives. Les résultats déjà enregistrés sont conservés.",
      )
    ) {
      return;
    }
    setCancelling(true);
    try {
      await sessionsService.cancel(data.session.id);
      router.push("/coach");
      router.refresh();
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erreur",
      );
      setCancelling(false);
    }
  };

  if (staff.checking && !staff.ready) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!staff.ready) {
    return (
      <StaffApiGate
        checking={staff.checking}
        error={staff.error}
        onLogin={staff.login}
      />
    );
  }

  if (loading && !data && !error) {
    return <p className="text-muted">Chargement…</p>;
  }
  if (error && !data) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-danger" role="alert">
          {error}
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          Réessayer
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const sessionCode = data.session.session_code ?? code;
  const joinable = isSessionJoinable(data.session.status);
  const isDraft = data.session.status === "draft";
  const completedResults = data.players.reduce(
    (sum: number, player: SessionDashboardPlayer) => sum + player.completed_tests,
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
    (player) => player.completed_tests < exerciseTotal,
  ).length;
  const doneCount = data.players.length - doingCount;
  const visiblePlayers = data.players.filter((player) => {
    if (needle && !player.display_name.toLowerCase().includes(needle)) {
      return false;
    }
    if (playerFilter === "done") {
      return player.completed_tests >= exerciseTotal && exerciseTotal > 0;
    }
    if (playerFilter === "doing") {
      return player.completed_tests < exerciseTotal;
    }
    return true;
  });

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Code à partager</p>
            <p className="text-3xl font-bold tracking-[0.15em] text-brand sm:text-4xl">
              {sessionCode}
            </p>
          </div>
          <CopyCodeButton code={sessionCode} />
        </div>
        <p className="mt-2 text-muted">{data.session.title}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Users className="size-4 text-brand" aria-hidden />
          {data.players.length} joueur{data.players.length > 1 ? "s" : ""}
          <span>·</span>
          {exerciseTotal} exercice{exerciseTotal > 1 ? "s" : ""}
          <span>·</span>
          <span className={joinable ? "text-brand" : "text-muted"}>
            {formatSessionStatus(data.session.status)}
          </span>
        </p>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {data.players.length === 0 ? (
        <p className="text-muted">
          Aucun joueur pour l&apos;instant. Partage le code
          {isDraft ? " après ouverture de la séance" : ""}.
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
            code={sessionCode}
            sessionTitle={data.session.title}
            finishedCount={doneCount}
            playerCount={data.players.length}
            playerScores={data.players
              .filter(
                (player) =>
                  exerciseTotal > 0 && player.completed_tests >= exerciseTotal,
              )
              .map((player) => ({
                name: player.display_name,
                averageScore: player.average_score ?? 0,
              }))}
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
              const open = selectedId === player.session_player_id;
              const progress =
                exerciseTotal === 0
                  ? 0
                  : Math.round((player.completed_tests / exerciseTotal) * 100);
              return (
                <li key={player.session_player_id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(open ? null : player.session_player_id)
                    }
                    className="flex w-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-brand hover:bg-surface-hover"
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span>
                        <span className="block font-semibold">
                          {player.display_name}
                        </span>
                        <span className="text-sm text-muted">
                          {player.completed_tests}/{exerciseTotal} exercices
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
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                          <CoachAnalysisPanel
                            code={sessionCode}
                            sessionPlayerId={player.session_player_id}
                            playerName={player.display_name}
                            sessionTitle={data.session.title}
                            exerciseCount={data.exercises.length}
                            results={selectedResults.map((result) => {
                              const view = presentResult(toPresentable(result));
                              return {
                                id: result.id,
                                name: view.name,
                                headline: view.headline,
                                note: view.note,
                                score: result.score,
                                accuracy: Number(result.accuracy) || 0,
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
                                  TEST_ICONS[result.test_slug] ?? Timer;
                                const view = presentResult(
                                  toPresentable(result),
                                );
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
                                        <p className="font-semibold">
                                          {view.name}
                                        </p>
                                        <p className="text-xs text-muted">
                                          {view.primaryLabel}
                                        </p>
                                      </div>
                                      <p className="ml-auto text-right">
                                        <span className="block text-lg font-bold text-brand tabular-nums">
                                          {view.headline}
                                        </span>
                                        <span className="text-xs text-muted">
                                          {view.completionStatus}
                                        </span>
                                      </p>
                                    </div>
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-sm font-medium">
                                        Détail des indicateurs
                                      </summary>
                                      <p className="mt-2 text-sm text-muted">
                                        {view.note}
                                      </p>
                                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                                        {view.lines.map((line) => (
                                          <div
                                            key={line.label}
                                            className="flex justify-between gap-2 border-b border-border/60 py-1"
                                          >
                                            <dt className="text-muted">
                                              {line.label}
                                            </dt>
                                            <dd className="font-medium tabular-nums">
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
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          Rafraîchir
        </Button>
        {isDraft ? (
          <Button
            variant="secondary"
            onClick={() => void onStart()}
            disabled={starting || cancelling}
          >
            {starting ? "Ouverture…" : "Ouvrir la session"}
          </Button>
        ) : null}
        {joinable ? (
          <Button
            variant="secondary"
            onClick={() => void onClose()}
            disabled={closing || cancelling}
          >
            {closing ? "Fermeture…" : "Fermer la session"}
          </Button>
        ) : null}
        {canCancelSession(data.session.status) ? (
          <Button
            variant="secondary"
            onClick={() => void onCancel()}
            disabled={cancelling || closing || starting}
          >
            {cancelling ? "Annulation…" : "Annuler"}
          </Button>
        ) : null}
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
