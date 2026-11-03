import Link from "next/link";
import { ClipboardList, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { requireCoach } from "@/lib/auth-server";

export const instant = false;

export default async function Home() {
  const coachAuth = await requireCoach();
  if (coachAuth) redirect("/coach");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <BrandMark href={false} size="md" />
        <h1 className="text-3xl font-bold">RealScouting Academy</h1>
        <p className="max-w-xl text-lg text-foreground">
          C&apos;est mental, et ça fait travailler les muscles des yeux.
        </p>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          Le joueur suit une cible du regard, retient ce qu&apos;il vient de
          voir, réagit dès qu&apos;un signal apparaît, repère un éclair sur le
          côté sans quitter le centre, puis cherche le bon joueur dans une
          action. Les yeux bougent, s&apos;arrêtent et changent de direction.
          En même temps, l&apos;attention choisit quoi garder et quoi laisser.
          Ce n&apos;est pas un examen de la vue : c&apos;est une séance courte
          pour observer comment le joueur regarde et décide.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/coach"
          className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center transition hover:border-brand hover:bg-surface-hover"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
            <ClipboardList className="size-8" strokeWidth={1.6} aria-hidden />
          </span>
          <span className="text-lg font-semibold">Entraîneur</span>
        </Link>

        <Link
          href="/join"
          className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center transition hover:border-brand hover:bg-surface-hover"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
            <UserRound className="size-8" strokeWidth={1.6} aria-hidden />
          </span>
          <span className="text-lg font-semibold">Joueur</span>
        </Link>
      </div>
    </main>
  );
}
