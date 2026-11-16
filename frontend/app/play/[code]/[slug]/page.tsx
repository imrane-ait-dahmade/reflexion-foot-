import { notFound } from "next/navigation";
import { PlayerLayout } from "@/components/player/layout";
import { SessionTestRunner } from "@/components/sessions/SessionTestRunner";
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
    <PlayerLayout
      title={test?.name ?? "Exercice"}
      description="Enchaînement automatique — reste concentré jusqu'à la fin."
      immersive
    >
      <SessionTestRunner code={code.toUpperCase()} testSlug={slug} />
    </PlayerLayout>
  );
}
