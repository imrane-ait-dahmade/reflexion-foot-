import Link from "next/link";
import { TestShell } from "@/components/tests/shared/TestShell";

export default function NotFound() {
  return (
    <TestShell
      title="Page introuvable"
      description="Cette adresse n'existe pas. Retourne à l'accueil ou rejoins une session avec le code de ton entraîneur."
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Accueil
        </Link>
        <Link
          href="/join"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 font-semibold"
        >
          Rejoindre une session
        </Link>
      </div>
    </TestShell>
  );
}
