"use client";

import { History } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

/**
 * Staff-facing player test history / performance evolution are not exposed
 * by the mounted FastAPI HTTP API (results models exist; no list router).
 */
export function PlayerHistory() {
  return (
    <Card>
      <CardHeader className="mb-0">
        <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted">
          <History className="size-5" aria-hidden />
        </div>
        <CardTitle>Historique & performance</CardTitle>
        <CardDescription>
          Aucun endpoint FastAPI staff pour lister les résultats ou l’évolution
          d’un joueur. Les tentatives sont écrites via le flux session joueur
          (`POST /player/session/exercises/.../complete`) uniquement.
        </CardDescription>
      </CardHeader>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li>• Historique de tests — non supporté</li>
        <li>• Évolution de performance — non supporté</li>
        <li>• Rapports IA — router non monté</li>
        <li>
          • Historique d’équipes — stocké en base (`joined_at` / `left_at`) mais
          l’API ne liste que les appartenances actives
        </li>
      </ul>
    </Card>
  );
}
