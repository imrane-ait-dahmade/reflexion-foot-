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
      title={test?.name ?? "Exercice"}
      description="Enchaînement automatique — reste concentré jusqu'à la fin."
    >
      <SessionTestRunner code={code.toUpperCase()} testSlug={slug} />
    </TestShell>
  );
}
