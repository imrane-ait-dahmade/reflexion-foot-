import { PlayerLayout } from "@/components/player/layout";
import { PlayerPlayHub } from "@/components/sessions/PlayerPlayHub";

export const instant = false;

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function PlaySessionPage({ params }: PageProps) {
  const { code } = await params;
  return (
    <PlayerLayout
      title="Ton parcours"
      description="Les exercices s'enchaînent automatiquement. Suis les consignes — ton entraîneur reçoit les résultats."
    >
      <PlayerPlayHub code={code.toUpperCase()} />
    </PlayerLayout>
  );
}
