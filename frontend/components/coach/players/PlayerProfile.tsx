"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Pencil, UserMinus, UserPlus } from "lucide-react";
import { PlayerForm } from "@/components/coach/players/PlayerForm";
import { PlayerHistory } from "@/components/coach/players/PlayerHistory";
import {
  formatPositions,
  playerFullName,
  playerInitials,
} from "@/components/coach/players/player-utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePositions } from "@/hooks/usePositions";
import { useTeams } from "@/hooks/useTeams";
import { isApiError } from "@/lib/api/errors";
import { playersService } from "@/lib/api/players.service";
import { teamsService } from "@/lib/api/teams.service";
import type {
  PlayerNoteResponse,
  PlayerResponse,
  TeamPlayerMembershipResponse,
  TeamResponse,
} from "@/lib/api/types";

type PlayerProfileProps = {
  playerId: string;
};

export function PlayerProfile({ playerId }: PlayerProfileProps) {
  const [player, setPlayer] = useState<PlayerResponse | null>(null);
  const [notes, setNotes] = useState<PlayerNoteResponse[]>([]);
  const [memberships, setMemberships] = useState<
    Array<TeamPlayerMembershipResponse & { teamName: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const positions = usePositions({ enabled: true });
  const teams = useTeams({ page_size: 100, is_active: true }, { enabled: true });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detail, noteList, teamList] = await Promise.all([
        playersService.get(playerId),
        playersService.listNotes(playerId).catch(() => [] as PlayerNoteResponse[]),
        teamsService.list({ page_size: 100, is_active: true }),
      ]);
      setPlayer(detail);
      setNotes(noteList);

      const activeMemberships: Array<
        TeamPlayerMembershipResponse & { teamName: string }
      > = [];
      await Promise.all(
        teamList.items.map(async (team: TeamResponse) => {
          const rows = await teamsService.listPlayers(team.id);
          for (const row of rows) {
            if (row.player_id === playerId && row.is_active) {
              activeMemberships.push({ ...row, teamName: team.name });
            }
          }
        }),
      );
      setMemberships(activeMemberships);
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Chargement impossible.",
      );
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const availableTeams = useMemo(() => {
    const memberIds = new Set(memberships.map((item) => item.team_id));
    return (teams.data?.items ?? []).filter((team) => !memberIds.has(team.id));
  }, [memberships, teams.data]);

  const onToggleActive = async () => {
    if (!player) return;
    setBusy(true);
    try {
      const updated = await playersService.updateStatus(player.id, {
        is_active: !player.is_active,
      });
      setPlayer(updated);
    } catch (err) {
      setError(
        isApiError(err) ? err.message : "Mise à jour du statut impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onRotateCode = async () => {
    setBusy(true);
    try {
      const result = await playersService.rotateAccessCode(playerId);
      setAccessCode(result.access_code);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Rotation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onAssign = async () => {
    if (!assignTeamId) return;
    setBusy(true);
    try {
      await teamsService.assignPlayer(assignTeamId, { player_id: playerId });
      setAssignTeamId("");
      await load();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Affectation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onRemoveTeam = async (teamId: string) => {
    setBusy(true);
    try {
      await teamsService.removePlayer(teamId, playerId);
      await load();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Retrait impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onAddNote = async () => {
    if (!noteDraft.trim()) return;
    setBusy(true);
    try {
      const created = await playersService.createNote(playerId, {
        content: noteDraft.trim(),
      });
      setNotes((current) => [created, ...current]);
      setNoteDraft("");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Note impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (!player) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Joueur introuvable</CardTitle>
          <CardDescription>{error || "Réessaie plus tard."}</CardDescription>
        </CardHeader>
        <Link
          href="/coach/players"
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-surface px-6 text-sm font-semibold hover:bg-surface-hover"
        >
          Retour à la liste
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/coach/players"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Joueurs
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" aria-hidden />
            Modifier
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11"
            disabled={busy}
            onClick={() => void onRotateCode()}
          >
            <KeyRound className="size-4" aria-hidden />
            Code d’accès
          </Button>
          <Button
            variant={player.is_active ? "danger" : "primary"}
            size="sm"
            className="min-h-11"
            disabled={busy}
            onClick={() => void onToggleActive()}
          >
            {player.is_active ? "Archiver" : "Réactiver"}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {accessCode ? (
        <p className="rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-sm">
          Nouveau code :{" "}
          <span className="font-bold tracking-widest text-brand">{accessCode}</span>
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5 md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="inline-flex size-16 items-center justify-center rounded-full border border-border bg-background text-lg font-bold">
            {playerInitials(player)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {playerFullName(player)}
              </h2>
              <Badge tone={player.is_active ? "brand" : "neutral"}>
                {player.is_active ? "Actif" : "Archivé"}
              </Badge>
            </div>
            <p className="mt-1 text-brand">{formatPositions(player)}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <Info label="Email" value={player.email} />
              <Info label="Téléphone" value={player.phone} />
              <Info label="Nationalité" value={player.nationality} />
              <Info label="Naissance" value={player.date_of_birth} />
              <Info label="Pied" value={player.preferred_foot} />
              <Info
                label="Maillot"
                value={
                  player.jersey_number != null
                    ? String(player.jersey_number)
                    : null
                }
              />
              <Info label="Club" value={null} unsupported />
              <Info label="Catégorie" value={null} unsupported />
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Équipes</CardTitle>
            <CardDescription>
              Appartenances actives. Le retrait soft-leave conserve l’historique
              en base (pas d’API d’historique).
            </CardDescription>
          </CardHeader>
          <ul className="mt-3 space-y-2">
            {memberships.length === 0 ? (
              <li className="text-sm text-muted">Aucune équipe active.</li>
            ) : (
              memberships.map((item) => (
                <li
                  key={item.id}
                  className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border px-3"
                >
                  <span className="font-medium">{item.teamName}</span>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1 text-sm text-danger"
                    disabled={busy}
                    onClick={() => void onRemoveTeam(item.team_id)}
                  >
                    <UserMinus className="size-4" aria-hidden />
                    Retirer
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Select
              value={assignTeamId || undefined}
              onValueChange={setAssignTeamId}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Ajouter à une équipe" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="min-h-12"
              disabled={busy || !assignTeamId}
              onClick={() => void onAssign()}
            >
              <UserPlus className="size-4" aria-hidden />
              Assigner
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes staff</CardTitle>
            <CardDescription>
              Notes FastAPI (`/players/{"{id}"}/notes`).
            </CardDescription>
          </CardHeader>
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              rows={3}
              placeholder="Ajouter une note…"
              className="min-h-24 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <Button
              className="min-h-11 self-end"
              size="sm"
              disabled={busy || !noteDraft.trim()}
              onClick={() => void onAddNote()}
            >
              Enregistrer la note
            </Button>
          </div>
          <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
            {notes.length === 0 ? (
              <li className="text-sm text-muted">Aucune note.</li>
            ) : (
              notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <p>{note.content}</p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(note.created_at).toLocaleString("fr-FR")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </section>

      <PlayerHistory />

      <PlayerForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        player={player}
        positions={positions.data ?? []}
        teams={teams.data?.items ?? []}
        onSaved={(updated) => {
          setPlayer(updated);
          setEditOpen(false);
        }}
      />
    </div>
  );
}

function Info({
  label,
  value,
  unsupported,
}: {
  label: string;
  value: string | null | undefined;
  unsupported?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-medium">
        {unsupported ? (
          <span className="text-muted/80">Non supporté par l’API</span>
        ) : (
          value || "—"
        )}
      </dd>
    </div>
  );
}
