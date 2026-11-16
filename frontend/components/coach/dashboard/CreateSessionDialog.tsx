"use client";

import Link from "next/link";
import { useState } from "react";
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
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { CopyCodeButton } from "@/components/sessions/CopyCodeButton";
import type { TestSlug } from "@/lib/db/types";
import { TESTS } from "@/lib/tests/registry";

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

export type CreatedSession = {
  code: string;
  title: string;
  exercises: string[];
  endsAt: string | null;
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

type CreateSessionDialogProps = {
  open: boolean;
  created: CreatedSession | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (session: CreatedSession) => void;
  onClearCreated: () => void;
};

export function CreateSessionDialog({
  open,
  created,
  onOpenChange,
  onCreated,
  onClearCreated,
}: CreateSessionDialogProps) {
  const [title, setTitle] = useState("Séance vision");
  const [selected, setSelected] = useState<TestSlug[]>([
    "visual-tracking",
    "reaction-time",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const closeAll = () => {
    onOpenChange(false);
    onClearCreated();
    setError("");
  };

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
      if (!response.ok) throw new Error(data.error ?? "Erreur");
      onCreated({
        code: data.code,
        title: data.title,
        exercises: data.exercises,
        endsAt: data.endsAt ?? null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={() => onOpenChange(false)}
        title="Nouvelle session"
        description="Les joueurs reçoivent ces exercices dans un ordre mélangé."
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Titre de la session"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Exercices · {selected.length} sélectionné
                {selected.length > 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setSelected(TESTS.map((test) => test.slug as TestSlug))
                  }
                >
                  Tout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected([])}
                >
                  Aucun
                </Button>
              </div>
            </div>
            <ul className="grid max-h-[min(42vh,22rem)] gap-2 overflow-y-auto sm:grid-cols-2">
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
                      className={`flex min-h-14 w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-brand bg-brand-soft"
                          : "border-border bg-surface hover:border-brand/50 hover:bg-surface-hover"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border ${
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

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button
            onClick={onCreate}
            disabled={loading || selected.length === 0}
            className="w-full sm:w-auto"
          >
            {loading ? "Création…" : `Créer la session (${selected.length})`}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(created)}
        onClose={closeAll}
        title="Session créée"
        description="Partage le code aux joueurs."
      >
        {created ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-surface px-4 py-6 text-center">
              <p className="text-sm uppercase tracking-wide text-muted">
                Code à partager
              </p>
              <p className="mt-2 text-5xl font-bold tracking-[0.2em] text-brand">
                {created.code}
              </p>
              {formatEndsAt(created.endsAt) ? (
                <p className="mt-3 text-sm text-muted">
                  Valide jusqu&apos;à {formatEndsAt(created.endsAt)}
                </p>
              ) : null}
            </div>
            <p className="text-sm text-muted">Ordre joueur aléatoire parmi :</p>
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
                onClick={() => {
                  onClearCreated();
                  onOpenChange(true);
                }}
                className="flex-1"
              >
                Nouvelle session
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
