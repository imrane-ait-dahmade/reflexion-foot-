"use client";

import Link from "next/link";
import { TestShell } from "@/components/tests/shared/TestShell";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <TestShell
      title="Affichage impossible"
      description="Cette page n'a pas pu se charger. Réessaie, ou reviens à l'accueil."
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 font-semibold"
        >
          Accueil
        </Link>
      </div>
    </TestShell>
  );
}
