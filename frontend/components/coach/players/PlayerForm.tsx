"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { isApiError } from "@/lib/api/errors";
import { playersService } from "@/lib/api/players.service";
import type {
  CreatePlayerRequest,
  PlayerResponse,
  PositionResponse,
  TeamResponse,
  UpdatePlayerRequest,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";

type PlayerFormProps = {
  open: boolean;
  onClose: () => void;
  positions: PositionResponse[];
  teams: TeamResponse[];
  player?: PlayerResponse | null;
  onSaved: (player: PlayerResponse) => void;
};

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  primary_position_id: string;
  secondary_position_ids: string[];
  team_id: string;
  jersey_number: string;
  preferred_foot: "" | "left" | "right" | "both";
  gender: "" | "male" | "female" | "other" | "unspecified";
  nationality: string;
  date_of_birth: string;
};

function fromPlayer(player?: PlayerResponse | null): FormState {
  return {
    first_name: player?.first_name ?? "",
    last_name: player?.last_name ?? "",
    email: player?.email ?? "",
    phone: player?.phone ?? "",
    primary_position_id: player?.primary_position_id ?? "",
    secondary_position_ids: player?.secondary_position_ids ?? [],
    team_id: "",
    jersey_number:
      player?.jersey_number != null ? String(player.jersey_number) : "",
    preferred_foot: player?.preferred_foot ?? "",
    gender: player?.gender ?? "",
    nationality: player?.nationality ?? "",
    date_of_birth: player?.date_of_birth ?? "",
  };
}

export function PlayerForm({
  open,
  onClose,
  positions,
  teams,
  player,
  onSaved,
}: PlayerFormProps) {
  const editing = Boolean(player);
  const [form, setForm] = useState<FormState>(() => fromPlayer(player));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);

  const secondaryOptions = useMemo(
    () =>
      positions.filter((position) => position.id !== form.primary_position_id),
    [positions, form.primary_position_id],
  );

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setForm(fromPlayer(player));
      setError("");
      setAccessCode(null);
    });
  }, [open, player]); // reset when dialog opens or target player changes

  const handleClose = () => {
    onClose();
  };

  const toggleSecondary = (id: string) => {
    setForm((current) => ({
      ...current,
      secondary_position_ids: current.secondary_position_ids.includes(id)
        ? current.secondary_position_ids.filter((item) => item !== id)
        : [...current.secondary_position_ids, id],
    }));
  };

  const onSubmit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Prénom et nom requis.");
      return;
    }
    if (!form.primary_position_id) {
      setError("Poste principal requis.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (editing && player) {
        const payload: UpdatePlayerRequest = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          primary_position_id: form.primary_position_id,
          secondary_position_ids: form.secondary_position_ids,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          nationality: form.nationality.trim() || null,
          date_of_birth: form.date_of_birth || null,
          preferred_foot: form.preferred_foot || null,
          gender: form.gender || null,
          jersey_number: form.jersey_number
            ? Number(form.jersey_number)
            : null,
          clear_email: !form.email.trim(),
          clear_phone: !form.phone.trim(),
          clear_nationality: !form.nationality.trim(),
          clear_date_of_birth: !form.date_of_birth,
          clear_preferred_foot: !form.preferred_foot,
          clear_gender: !form.gender,
          clear_jersey_number: !form.jersey_number,
        };
        const updated = await playersService.update(player.id, payload);
        onSaved(updated);
        onClose();
      } else {
        const payload: CreatePlayerRequest = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          primary_position_id: form.primary_position_id,
          secondary_position_ids: form.secondary_position_ids,
          team_id: form.team_id || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          nationality: form.nationality.trim() || null,
          date_of_birth: form.date_of_birth || null,
          preferred_foot: form.preferred_foot || null,
          gender: form.gender || null,
          jersey_number: form.jersey_number
            ? Number(form.jersey_number)
            : null,
        };
        const created = await playersService.create(payload);
        setAccessCode(created.access_code);
        onSaved(created);
      }
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Enregistrement impossible.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={editing ? "Modifier le joueur" : "Nouveau joueur"}
      description="Champs alignés sur CreatePlayerRequest / UpdatePlayerRequest FastAPI."
      className="max-w-2xl max-h-[90dvh] overflow-y-auto"
    >
      {accessCode ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Joueur créé. Code d’accès personnel (à communiquer au joueur) :
          </p>
          <p className="rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-center text-2xl font-bold tracking-[0.2em] text-brand">
            {accessCode}
          </p>
          <Button className="w-full min-h-12" onClick={handleClose}>
            Fermer
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Prénom"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
            <Input
              label="Nom"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Téléphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Poste principal</span>
            <Select
              value={form.primary_position_id || undefined}
              onValueChange={(primary_position_id) =>
                setForm((current) => ({
                  ...current,
                  primary_position_id,
                  secondary_position_ids: current.secondary_position_ids.filter(
                    (id) => id !== primary_position_id,
                  ),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.code} — {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Postes secondaires</legend>
            <div className="flex flex-wrap gap-2">
              {secondaryOptions.map((position) => {
                const active = form.secondary_position_ids.includes(position.id);
                return (
                  <button
                    key={position.id}
                    type="button"
                    onClick={() => toggleSecondary(position.id)}
                    className={cn(
                      "min-h-11 rounded-full border px-3 text-sm font-medium transition",
                      active
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border text-muted hover:bg-surface-hover",
                    )}
                  >
                    {position.code}
                  </button>
                );
              })}
              {secondaryOptions.length === 0 ? (
                <p className="text-sm text-muted">Choisis d’abord un poste principal.</p>
              ) : null}
            </div>
          </fieldset>

          {!editing ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Équipe (optionnel à la création)</span>
              <Select
                value={form.team_id || "none"}
                onValueChange={(team_id) =>
                  setForm({
                    ...form,
                    team_id: team_id === "none" ? "" : team_id,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : (
            <p className="text-xs text-muted">
              L’affectation d’équipe après création se fait via l’API équipes
              (`POST /teams/{"{id}"}/players`) — disponible dans le profil.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="N° de maillot"
              inputMode="numeric"
              value={form.jersey_number}
              onChange={(e) =>
                setForm({ ...form, jersey_number: e.target.value })
              }
            />
            <Input
              label="Date de naissance"
              type="date"
              value={form.date_of_birth}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value })
              }
            />
            <Input
              label="Nationalité"
              value={form.nationality}
              onChange={(e) =>
                setForm({ ...form, nationality: e.target.value })
              }
            />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Pied préféré</span>
              <Select
                value={form.preferred_foot || "none"}
                onValueChange={(preferred_foot) =>
                  setForm({
                    ...form,
                    preferred_foot:
                      preferred_foot === "none"
                        ? ""
                        : (preferred_foot as FormState["preferred_foot"]),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="left">Gauche</SelectItem>
                  <SelectItem value="right">Droit</SelectItem>
                  <SelectItem value="both">Les deux</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <p className="text-xs text-muted">
            Club / catégorie joueur : absents des schémas FastAPI — non affichés.
          </p>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="secondary"
              className="min-h-12 flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              className="min-h-12 flex-1"
              onClick={() => void onSubmit()}
              disabled={loading}
            >
              {loading ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
