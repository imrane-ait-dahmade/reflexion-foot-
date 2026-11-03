import { redirect } from "next/navigation";
import { CoachSessionDashboard } from "@/components/sessions/CoachSessionDashboard";
import { TestShell } from "@/components/tests/shared/TestShell";
import { requireCoach } from "@/lib/auth-server";

export const instant = false;

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function CoachSessionPage({ params }: PageProps) {
  const coachAuth = await requireCoach();
  if (!coachAuth) redirect("/coach/login");

  const { code } = await params;
  return (
    <TestShell
      title="Résultats de session"
      description="Les résultats des joueurs apparaissent ici en direct."
    >
      <CoachSessionDashboard code={code.toUpperCase()} />
    </TestShell>
  );
}
