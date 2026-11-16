"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { exercisesService } from "@/lib/api/exercises.service";
import { isApiError } from "@/lib/api/errors";
import { playersService } from "@/lib/api/players.service";
import { sessionsService } from "@/lib/api/sessions.service";
import type { CognitiveTestResponse, PlayerResponse } from "@/lib/api/types";

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
  id: string;
  code: string;
  title: string;
  status: string;
  exercises: string[];
  endsAt: string | null;
};

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
  const [tests, setTests] = useState<CognitiveTestResponse[]>([]);
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [startImmediately, setStartImmediately] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingCatalog(true);
      setError("");
      void (async () => {
        try {
          const [catalog, roster] = await Promise.all([
            exercisesService.listCognitiveTests(),
            playersService.list({ page: 1, page_size: 100, is_active: true }),
          ]);
          if (cancelled) return;
          const activeTests = catalog.filter((t) => t.is_active);
          setTests(activeTests);
          setPlayers(roster.items);
          setSelectedTestIds((current) =>
            current.length > 0
              ? current.filter((id) => activeTests.some((t) => t.id === id))
              : activeTests
                  .filter((t) =>
                    ["visual-tracking", "reaction-time"].includes(t.slug),
                  )
                  .map((t) => t.id),
          );
        } catch (err) {
          if (cancelled) return;
          setError(
            isApiError(err)
              ? err.message
              : err instanceof Error
                ? err.message
                : "Impossible de charger le catalogue.",
          );
        } finally {
          if (!cancelled) setLoadingCatalog(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      return name.includes(q);
    });
  }, [players, playerSearch]);

  const closeAll = () => {
    onOpenChange(false);
    onClearCreated();
    setError("");
  };

  const toggleTest = (id: string) => {
    setSelectedTestIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const onCreate = async () => {
    if (selectedTestIds.length === 0) {
      setError("Sélectionne au moins un exercice.");
      return;
    }
    if (selectedPlayerIds.length === 0) {
      setError("Sélectionne au moins un joueur.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      let session = await sessionsService.create({
        player_ids: selectedPlayerIds,
        exercise_ids: selectedTestIds,
      });
      if (startImmediately) {
        session = await sessionsService.start(session.id);
      }
      const slugs = session.exercises
        .map((ex) => ex.cognitive_test?.slug)
        .filter((slug): slug is string => Boolean(slug));
      onCreated({
        id: session.id,
        code: session.session_code ?? "",
        title: session.title,
        status: session.status,
        exercises: slugs,
        endsAt: null,
      });
      onOpenChange(false);
      setSelectedPlayerIds([]);
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erreur",
      );
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
        description="Choisis joueurs et exercices. Le titre est généré automatiquement."
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Joueurs · {selectedPlayerIds.length} sélectionné
                {selectedPlayerIds.length > 1 ? "s" : ""}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPlayerIds([])}
                disabled={selectedPlayerIds.length === 0}
              >
                Aucun
              </Button>
            </div>
            <Input
              label="Rechercher un joueur"
              value={playerSearch}
              onChange={(event) => setPlayerSearch(event.target.value)}
              placeholder="Nom…"
            />
            <ul className="grid max-h-[min(28vh,14rem)] gap-2 overflow-y-auto sm:grid-cols-2">
              {loadingCatalog ? (
                <li className="text-sm text-muted">Chargement…</li>
              ) : filteredPlayers.length === 0 ? (
                <li className="text-sm text-muted">
                  Aucun joueur actif. Crée-en dans Joueurs.
                </li>
              ) : (
                filteredPlayers.map((player) => {
                  const active = selectedPlayerIds.includes(player.id);
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        onClick={() => togglePlayer(player.id)}
                        aria-pressed={active}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-brand bg-brand-soft"
                            : "border-border bg-surface hover:border-brand/50"
                        }`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs ${
                            active
                              ? "border-brand bg-brand text-white"
                              : "border-border text-muted"
                          }`}
                        >
                          {active ? <Check className="size-3.5" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {player.first_name} {player.last_name}
                          </span>
                          <span className="block text-xs text-muted">
                            {player.primary_position?.code ??
                              player.primary_position?.name ??
                              "—"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Exercices · {selectedTestIds.length} sélectionné
                {selectedTestIds.length > 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedTestIds(tests.map((t) => t.id))}
                  disabled={tests.length === 0}
                >
                  Tout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTestIds([])}
                >
                  Aucun
                </Button>
              </div>
            </div>
            <ul className="grid max-h-[min(36vh,18rem)] gap-2 overflow-y-auto sm:grid-cols-2">
              {tests.map((test) => {
                const active = selectedTestIds.includes(test.id);
                const Icon = TEST_ICONS[test.slug] ?? Crosshair;
                return (
                  <li key={test.id}>
                    <button
                      type="button"
                      onClick={() => toggleTest(test.id)}
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

          <label className="flex items-start gap-3 rounded-xl border border-border px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--brand)]"
              checked={startImmediately}
              onChange={(event) => setStartImmediately(event.target.checked)}
            />
            <span>
              <span className="font-semibold">Ouvrir immédiatement</span>
              <span className="mt-0.5 block text-muted">
                Passe la séance en cours pour que le code soit rejoignable.
              </span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button
            onClick={() => void onCreate()}
            disabled={
              loading ||
              loadingCatalog ||
              selectedTestIds.length === 0 ||
              selectedPlayerIds.length === 0
            }
            className="w-full sm:w-auto"
          >
            {loading
              ? "Création…"
              : `Créer la session (${selectedPlayerIds.length}j · ${selectedTestIds.length}ex)`}
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
              <p className="text-sm tracking-wide text-muted uppercase">
                Code à partager
              </p>
              <p className="mt-2 text-5xl font-bold tracking-[0.2em] text-brand">
                {created.code || "—"}
              </p>
              <p className="mt-3 text-sm text-muted">
                {created.title}
                {created.status === "draft"
                  ? " · brouillon (pas encore rejoignable)"
                  : created.status === "in_progress"
                    ? " · ouverte"
                    : ""}
              </p>
            </div>
            <p className="text-sm text-muted">Exercices :</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {created.exercises.map((slug) => {
                const test = tests.find((item) => item.slug === slug);
                return <li key={slug}>{test?.name ?? slug}</li>;
              })}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              {created.code ? <CopyCodeButton code={created.code} /> : null}
              {created.code ? (
                <Link
                  href={`/coach/sessions/${created.code}`}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
                >
                  Ouvrir la session
                </Link>
              ) : null}
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
