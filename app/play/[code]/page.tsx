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
      title="Ton parcours"
      description="Les exercices s'enchaînent automatiquement. Suis les consignes — ton entraîneur reçoit les résultats."
    >
      <PlayerPlayHub code={code.toUpperCase()} />
    </TestShell>
  );
}
