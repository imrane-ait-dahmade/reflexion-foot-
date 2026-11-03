import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { TESTS } from "@/lib/tests/registry";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-4">
        <BrandMark href={false} size="md" />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">RealScouting Academy</h1>
          <p className="text-muted">
            Tests visuels et cognitifs pour footballeurs. Les joueurs
            rejoignent une session avec un code — sans créer de compte.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/coach/login"
          className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand hover:bg-surface-hover"
        >
          <p className="font-semibold text-brand">Je suis entraîneur</p>
          <p className="mt-1 text-sm text-muted">
            Connexion / inscription, puis créer une session.
          </p>
        </Link>
        <Link
          href="/join"
          className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand hover:bg-surface-hover"
        >
          <p className="font-semibold text-brand">Je suis joueur</p>
          <p className="mt-1 text-sm text-muted">
            Entrer un code + ton nom, sans compte.
          </p>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tests libres</h2>
        <ul className="flex flex-col gap-3">
          {TESTS.map((test) => (
            <li key={test.slug}>
              <Link
                href={test.href}
                className="block rounded-2xl border border-border bg-surface p-4 transition hover:border-brand hover:bg-surface-hover"
              >
                <p className="font-semibold">{test.name}</p>
                <p className="mt-1 text-sm text-muted">{test.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
