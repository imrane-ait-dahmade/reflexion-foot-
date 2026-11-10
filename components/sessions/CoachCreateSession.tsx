"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Binary,
  Check,
  Crosshair,
  Eye,
  Grid3X3,
  type LucideIcon,
  Search,
  Spline,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
import { CopyCodeButton } from "@/components/sessions/CopyCodeButton";
import { formatSessionStatus } from "@/lib/format";
import type { TestSlug } from "@/lib/db/types";
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

const TEST_ICONS: Record<string, LucideIcon> = {
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

export function CoachCreateSession() {
  const [title, setTitle] = useState("Séance vision");
  const [selected, setSelected] = useState<TestSlug[]>([
    "visual-tracking",
    "reaction-time",
  ]);
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

  const toggleExercise = (slug: TestSlug) => {
    setSelected((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  };

  const onCreate = async () => {
    if (selected.length === 0) {
      setError("Sélectionne au moins un exercice.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          testSlugs: selected,
          exerciseCount: selected.length,
        }),
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
        <p className="text-sm text-muted">
          Ordre joueur aléatoire parmi :
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {created.exercises.map((slug) => {
            const test = TESTS.find((item) => item.slug === slug);
            return <li key={slug}>{test?.name ?? slug}</li>;
          })}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <CopyCodeButton code={created.code} />
          <Link
            href={`/coach/sessions/${created.code}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
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
        <CoachSignOutButton />
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

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Exercices · {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-sm"
                onClick={() =>
                  setSelected(TESTS.map((test) => test.slug as TestSlug))
                }
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-sm"
                onClick={() => setSelected([])}
              >
                Aucun
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">
            Les joueurs reçoivent ces exercices dans un ordre mélangé.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {TESTS.map((test) => {
              const slug = test.slug as TestSlug;
              const active = selected.includes(slug);
              const Icon = TEST_ICONS[slug] ?? Crosshair;
              return (
                <li key={slug}>
                  <button
                    type="button"
                    onClick={() => toggleExercise(slug)}
                    aria-pressed={active}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-brand bg-brand-soft"
                        : "border-border bg-surface hover:border-brand/50 hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border ${
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-border text-muted"
                      }`}
                    >
                      {active ? (
                        <Check className="size-4" aria-hidden />
                      ) : (
                        <Icon className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{test.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {test.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={onCreate}
          disabled={loading || selected.length === 0}
        >
          {loading
            ? "Création…"
            : `Créer la session (${selected.length})`}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Mes sessions</h2>
          <Button
            variant="secondary"
            onClick={loadSessions}
            disabled={isPending}
          >
            Rafraîchir
          </Button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">
            Aucune session pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/coach/sessions/${session.code}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{session.title}</p>
                    <p className="text-lg font-bold tracking-[0.12em] text-brand">
                      {session.code}
                    </p>
                    <p className="text-sm text-muted">
                      {session.exerciseCount} exercice{session.exerciseCount > 1 ? "s" : ""}
                      {session.endsAt
                        ? ` · jusqu'à ${formatEndsAt(session.endsAt)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`text-sm uppercase ${
                      session.status === "active"
                        ? "text-brand"
                        : "text-muted"
                    }`}
                  >
                    {formatSessionStatus(session.status)}
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
