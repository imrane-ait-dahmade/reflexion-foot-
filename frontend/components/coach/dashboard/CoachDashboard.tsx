"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  CreateSessionDialog,
  type CreatedSession,
} from "@/components/coach/dashboard/CreateSessionDialog";
import { StaffApiGate } from "@/components/coach/players/StaffApiGate";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { usePlayers } from "@/hooks/usePlayers";
import { useSessions } from "@/hooks/useSessions";
import { useStaffApiSession } from "@/hooks/useStaffApiSession";
import { isApiError } from "@/lib/api/errors";
import { sessionsService } from "@/lib/api/sessions.service";
import { cn } from "@/lib/cn";
import { formatSessionStatus } from "@/lib/format";
import {
  canCancelSession,
  isSessionClosedTab,
  isSessionJoinable,
  isSessionOpenTab,
  mapSessionToListItem,
  type SessionListItem,
} from "@/lib/sessions/v2-status";

type CoachDashboardProps = {
  coachName: string;
};

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CoachDashboard({ coachName }: CoachDashboardProps) {
  const reduce = useReducedMotion();
  const staff = useStaffApiSession();
  const sessionsQuery = useSessions(
    { page: 1, page_size: 50 },
    { enabled: staff.ready },
  );
  const playersQuery = usePlayers(
    { page: 1, page_size: 1, is_active: true },
    { enabled: staff.ready },
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreatedSession | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const sessions: SessionListItem[] = useMemo(
    () => (sessionsQuery.data?.items ?? []).map(mapSessionToListItem),
    [sessionsQuery.data],
  );

  const loaded = Boolean(sessionsQuery.data) || Boolean(sessionsQuery.error);
  const refreshing = sessionsQuery.loading;

  const overview = useMemo(() => {
    const active = sessions.filter((s) => isSessionJoinable(s.status)).length;
    const openTab = sessions.filter((s) => isSessionOpenTab(s.status)).length;
    const closed = sessions.filter((s) => isSessionClosedTab(s.status)).length;
    const exerciseSlots = sessions.reduce((sum, s) => sum + s.exerciseCount, 0);
    const completionRate =
      sessions.length === 0
        ? 0
        : Math.round(
            (sessions.reduce(
              (sum, s) =>
                sum +
                (s.playerCount === 0
                  ? 0
                  : s.completedPlayers / s.playerCount),
              0,
            ) /
              sessions.length) *
              100,
          );
    return {
      total: sessionsQuery.data?.total ?? sessions.length,
      active,
      openTab,
      closed,
      exerciseSlots,
      playersTotal: playersQuery.data?.total ?? null,
      completionRate,
    };
  }, [sessions, sessionsQuery.data?.total, playersQuery.data?.total]);

  const reload = useCallback(() => {
    setActionError("");
    sessionsQuery.reload();
    playersQuery.reload();
  }, [sessionsQuery, playersQuery]);

  const onRemove = async (session: SessionListItem) => {
    if (!canCancelSession(session.status)) return;
    if (
      !window.confirm(
        `Annuler « ${session.title} » ? La séance passe en annulée. Les résultats déjà enregistrés sont conservés.`,
      )
    ) {
      return;
    }
    setRemovingId(session.id);
    setActionError("");
    try {
      await sessionsService.cancel(session.id);
      reload();
    } catch (err) {
      setActionError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Annulation impossible.",
      );
    } finally {
      setRemovingId(null);
    }
  };

  const fade = reduce
    ? undefined
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  if (staff.checking && !staff.ready) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
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

  const listError = actionError || sessionsQuery.error || "";

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <motion.section
        {...fade}
        className="relative overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(0_128_96_/_0.22),transparent_55%)]"
        />
        <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-7">
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
              Football Intelligence
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Bonjour, {coachName}
            </h2>
            <p className="text-sm text-muted md:text-base">
              Crée une séance, partage le code, suis les regards en direct.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="min-h-12 w-full shrink-0 md:w-auto"
          >
            <Plus className="size-4" aria-hidden />
            Nouvelle session
          </Button>
        </div>
      </motion.section>

      <motion.section
        {...fade}
        transition={{ ...(fade?.transition ?? {}), delay: reduce ? 0 : 0.05 }}
        className="grid grid-cols-2 gap-3 @min-[36rem]:grid-cols-4"
      >
        <OverviewCard
          label="Joueurs"
          value={
            overview.playersTotal == null ? "—" : String(overview.playersTotal)
          }
          hint="Actifs (FastAPI)"
          icon={Users}
          loading={playersQuery.loading && overview.playersTotal == null}
        />
        <OverviewCard
          label="Ouvertes"
          value={loaded ? String(overview.active) : "—"}
          hint="Codes rejoignables"
          icon={Activity}
          loading={!loaded}
          accent
        />
        <OverviewCard
          label="Terminées"
          value={loaded ? String(overview.closed) : "—"}
          hint="Complétées ou annulées"
          icon={Sparkles}
          loading={!loaded}
        />
        <OverviewCard
          label="Sessions"
          value={loaded ? String(overview.total) : "—"}
          hint={`${overview.exerciseSlots} exercices assignés · ${overview.completionRate}% complétion moy.`}
          icon={ClipboardList}
          loading={!loaded}
        />
      </motion.section>

      <motion.section
        {...fade}
        transition={{ ...(fade?.transition ?? {}), delay: reduce ? 0 : 0.08 }}
        className="grid grid-cols-1 gap-3 @min-[28rem]:grid-cols-3"
      >
        <QuickAction
          title="Créer une session"
          description="Joueurs, exercices, puis code."
          onClick={() => setCreateOpen(true)}
        />
        <QuickAction
          title="Joueurs"
          description="Effectif, postes et import Excel."
          href="/coach/players"
        />
        <QuickAction
          title="Dernière session"
          description="Ouvre la séance la plus récente."
          href={
            sessions[0]?.code && sessions[0].code !== "—"
              ? `/coach/sessions/${sessions[0].code}`
              : undefined
          }
          disabled={!sessions[0]?.code || sessions[0].code === "—"}
        />
      </motion.section>

      <motion.section
        {...fade}
        transition={{ ...(fade?.transition ?? {}), delay: reduce ? 0 : 0.1 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Sessions</h3>
            <p className="text-sm text-muted">
              Données FastAPI V2 — pas de repli V1.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reload()}
            disabled={refreshing}
            className="min-h-11"
          >
            <RefreshCw
              className={cn("size-4", refreshing && "animate-spin")}
              aria-hidden
            />
            Rafraîchir
          </Button>
        </div>

        {listError ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-danger/40 px-3 py-3 text-sm text-danger sm:flex-row sm:items-center sm:justify-between"
          >
            <p>{listError}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => reload()}
              className="shrink-0"
            >
              Réessayer
            </Button>
          </div>
        ) : null}

        <Tabs defaultValue="all">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">Toutes ({overview.total})</TabsTrigger>
            <TabsTrigger value="active">
              En cours ({overview.openTab})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Terminées ({overview.closed})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <SessionCards
              sessions={sessions}
              loaded={loaded}
              removingId={removingId}
              onRemove={onRemove}
              onCreate={() => setCreateOpen(true)}
            />
          </TabsContent>
          <TabsContent value="active">
            <SessionCards
              sessions={sessions.filter((s) => isSessionOpenTab(s.status))}
              loaded={loaded}
              removingId={removingId}
              onRemove={onRemove}
              onCreate={() => setCreateOpen(true)}
            />
          </TabsContent>
          <TabsContent value="closed">
            <SessionCards
              sessions={sessions.filter((s) => isSessionClosedTab(s.status))}
              loaded={loaded}
              removingId={removingId}
              onRemove={onRemove}
              onCreate={() => setCreateOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </motion.section>

      <CreateSessionDialog
        open={createOpen}
        created={created}
        onOpenChange={setCreateOpen}
        onCreated={(session) => {
          setCreated(session);
          reload();
        }}
        onClearCreated={() => setCreated(null)}
      />
    </div>
  );
}

function OverviewCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className="min-h-[7.5rem]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-16" />
          ) : (
            <p
              className={cn(
                "mt-2 text-3xl font-bold tracking-tight tabular-nums",
                accent && "text-brand",
              )}
            >
              {value}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-xl border border-border",
            accent ? "bg-brand-soft text-brand" : "text-muted",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

function QuickAction({
  title,
  description,
  onClick,
  href,
  disabled,
}: {
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className = cn(
    "flex min-h-[5.5rem] flex-col justify-between rounded-2xl border border-border bg-surface p-4 text-left transition",
    disabled
      ? "cursor-not-allowed opacity-50"
      : "hover:border-brand/40 hover:bg-surface-hover active:scale-[0.99]",
  );

  const body = (
    <>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <ArrowRight className="size-4 text-brand" aria-hidden />
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      {body}
    </button>
  );
}

function SessionCards({
  sessions,
  loaded,
  removingId,
  onRemove,
  onCreate,
}: {
  sessions: SessionListItem[];
  loaded: boolean;
  removingId: string | null;
  onRemove: (session: SessionListItem) => void;
  onCreate: () => void;
}) {
  if (!loaded) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <CardHeader className="mb-0">
          <CardTitle>Aucune session</CardTitle>
          <CardDescription>
            Crée une séance pour générer un code et lancer les exercices.
          </CardDescription>
        </CardHeader>
        <Button onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          Créer une session
        </Button>
      </Card>
    );
  }

  return (
    <AnimatePresence initial={false}>
      <ul className="grid gap-3 md:grid-cols-2">
        {sessions.map((session) => {
          const joinable = isSessionJoinable(session.status);
          const detailHref =
            session.code && session.code !== "—"
              ? `/coach/sessions/${session.code}`
              : null;
          return (
            <motion.li
              key={session.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
            >
              {detailHref ? (
                <Link
                  href={detailHref}
                  className="flex min-h-[7rem] flex-1 flex-col gap-3 p-4 transition hover:bg-surface-hover"
                >
                  <SessionCardBody session={session} joinable={joinable} />
                </Link>
              ) : (
                <div className="flex min-h-[7rem] flex-1 flex-col gap-3 p-4">
                  <SessionCardBody session={session} joinable={joinable} />
                </div>
              )}
              <div className="flex border-t border-border">
                {detailHref ? (
                  <Link
                    href={detailHref}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 text-sm font-semibold text-brand"
                  >
                    Ouvrir
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <span className="inline-flex min-h-12 flex-1 items-center justify-center text-sm text-muted">
                    Code indisponible
                  </span>
                )}
                {canCancelSession(session.status) ? (
                  <button
                    type="button"
                    onClick={() => void onRemove(session)}
                    disabled={removingId === session.id}
                    className="inline-flex min-h-12 min-w-28 items-center justify-center border-l border-border px-3 text-sm text-danger disabled:opacity-50"
                  >
                    {removingId === session.id ? "…" : "Annuler"}
                  </button>
                ) : null}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </AnimatePresence>
  );
}

function SessionCardBody({
  session,
  joinable,
}: {
  session: SessionListItem;
  joinable: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{session.title}</p>
          <p className="mt-1 text-2xl font-bold tracking-[0.14em] text-brand">
            {session.code}
          </p>
        </div>
        <Badge tone={joinable ? "brand" : "neutral"}>
          {formatSessionStatus(session.status)}
        </Badge>
      </div>
      <p className="text-sm text-muted">
        {session.exerciseCount} exercice
        {session.exerciseCount > 1 ? "s" : ""}
        <span className="mx-1.5 text-border">·</span>
        {session.playerCount} joueur
        {session.playerCount > 1 ? "s" : ""}
        <span className="mx-1.5 text-border">·</span>
        créée {formatCreatedAt(session.createdAt)}
      </p>
    </>
  );
}
