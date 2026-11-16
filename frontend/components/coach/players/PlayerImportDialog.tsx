"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
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
  ImportConfirmResponse,
  ImportPreviewResponse,
  TeamResponse,
} from "@/lib/api/types";

type Step = "upload" | "preview" | "summary";

type PlayerImportDialogProps = {
  open: boolean;
  onClose: () => void;
  teams: TeamResponse[];
  onImported: () => void;
};

export function PlayerImportDialog({
  open,
  onClose,
  teams,
  onImported,
}: PlayerImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [summary, setSummary] = useState<ImportConfirmResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setTeamId("");
    setPreview(null);
    setSummary(null);
    setError("");
    setLoading(false);
  };

  const close = () => {
    onClose();
    reset();
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setError("");
    setFileName(file.name);
    try {
      const result = await playersService.importPreview(file);
      setPreview(result);
      setStep("preview");
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Prévisualisation impossible.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    if (!preview || preview.valid_rows.length === 0) {
      setError("Aucune ligne valide à importer.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await playersService.importConfirm({
        rows: preview.valid_rows,
        team_id: teamId || null,
      });
      setSummary(result);
      setStep("summary");
      onImported();
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Import impossible.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Import Excel"
      description="Preview → validation → confirmation. Les doublons ne sont pas importés silencieusement."
      className="max-w-2xl max-h-[90dvh] overflow-y-auto"
    >
      {step === "upload" ? (
        <div className="flex flex-col gap-4">
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 text-center hover:bg-surface-hover">
            <span className="text-sm font-medium">
              Choisir un fichier .xlsx / .xlsm
            </span>
            <span className="text-xs text-muted">
              Colonnes attendues par FastAPI (prénom, nom, postes…)
            </span>
            <input
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={loading}
              onChange={(event) => {
                void onFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
          {loading ? <p className="text-sm text-muted">Analyse…</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Fichier : <span className="text-foreground">{fileName}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Lignes" value={preview.total_rows} />
            <Stat label="Valides" value={preview.valid_count} accent />
            <Stat label="Rejets" value={preview.reject_count} />
            <Stat label="Doublons" value={preview.duplicate_count} />
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Assigner à une équipe (optionnel)</span>
            <Select
              value={teamId || "none"}
              onValueChange={(value) =>
                setTeamId(value === "none" ? "" : value)
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

          {preview.rejects.length > 0 ? (
            <Section title="Erreurs de validation">
              {preview.rejects.slice(0, 8).map((item) => (
                <li key={`r-${item.row_number}`} className="text-sm text-danger">
                  Ligne {item.row_number} — {item.reason}
                </li>
              ))}
            </Section>
          ) : null}

          {preview.duplicates.length > 0 ? (
            <Section title="Doublons détectés (non importés)">
              {preview.duplicates.slice(0, 8).map((item) => (
                <li key={`d-${item.row_number}`} className="text-sm text-warning">
                  Ligne {item.row_number} — {item.reason}
                </li>
              ))}
            </Section>
          ) : null}

          {preview.valid_rows.length > 0 ? (
            <Section title="Aperçu des lignes valides">
              {preview.valid_rows.slice(0, 6).map((row) => (
                <li key={`v-${row.row_number}`} className="text-sm">
                  Ligne {row.row_number} — {row.first_name} {row.last_name} (
                  {row.primary_position_code})
                </li>
              ))}
            </Section>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-12 flex-1" onClick={reset}>
              Autre fichier
            </Button>
            <Button
              className="min-h-12 flex-1"
              disabled={loading || preview.valid_count === 0}
              onClick={() => void onConfirm()}
            >
              {loading
                ? "Import…"
                : `Confirmer (${preview.valid_count})`}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "summary" && summary ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Créés" value={summary.created_count} accent />
            <Stat label="Rejets" value={summary.rejects.length} />
            <Stat label="Doublons" value={summary.duplicates.length} />
          </div>
          {summary.created_players.slice(0, 5).map((player) => (
            <p key={player.id} className="text-sm">
              {player.first_name} {player.last_name} — code{" "}
              <span className="font-semibold text-brand">{player.access_code}</span>
            </p>
          ))}
          <Button className="min-h-12" onClick={close}>
            Terminer
          </Button>
        </div>
      ) : null}
    </Dialog>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${accent ? "text-brand" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{title}</p>
      <ul className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border p-3">
        {children}
      </ul>
    </div>
  );
}
