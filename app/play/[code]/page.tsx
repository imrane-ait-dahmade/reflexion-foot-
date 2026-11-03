import { PlayerPlayHub } from "@/components/sessions/PlayerPlayHub";
import { TestShell } from "@/components/tests/shared/TestShell";

export const instant = false;

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function PlaySessionPage({ params }: PageProps) {
  const { code } = await params;
  return (
    <TestShell
      title="Tes exercices"
      description="Fais les exercices dans l’ordre. La progression et les scores sont envoyés à ton entraîneur."
    >
      <PlayerPlayHub code={code.toUpperCase()} />
    </TestShell>
  );
}
