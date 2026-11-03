import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionTestRunner } from "@/components/sessions/SessionTestRunner";
import { TestShell } from "@/components/tests/shared/TestShell";
import { isTestSlug } from "@/lib/sessions/exercises";
import { TESTS } from "@/lib/tests/registry";

export const instant = false;

type PageProps = {
  params: Promise<{ code: string; slug: string }>;
};

export default async function PlayTestPage({ params }: PageProps) {
  const { code, slug } = await params;
  if (!isTestSlug(slug)) notFound();

  const test = TESTS.find((item) => item.slug === slug);

  return (
    <TestShell
      title={test?.name ?? slug}
      description={test?.description ?? ""}
    >
      <div className="mb-2">
        <Link
          href={`/play/${code.toUpperCase()}`}
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← Retour aux exercices
        </Link>
      </div>
      <SessionTestRunner code={code.toUpperCase()} testSlug={slug} />
    </TestShell>
  );
}
