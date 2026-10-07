import Link from "next/link";
import { TESTS } from "@/lib/tests/registry";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Football Vision Lab</h1>
        <p className="text-foreground/70">
          Visual and cognitive tests for football players.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {TESTS.map((test) => (
          <li key={test.slug}>
            <Link
              href={test.href}
              className="block rounded-xl border border-foreground/15 p-4 transition hover:bg-foreground/5"
            >
              <p className="font-semibold">{test.name}</p>
              <p className="text-sm text-foreground/70">{test.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
