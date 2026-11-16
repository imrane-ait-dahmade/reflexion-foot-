import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/layout";
import { CoachSessionDashboard } from "@/components/sessions/CoachSessionDashboard";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
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
    <CoachShell
      title="Résultats de session"
      description="Les résultats des joueurs apparaissent ici en direct."
      coachName={coachAuth.coach.displayName}
      actions={<CoachSignOutButton className="w-full" />}
    >
      <CoachSessionDashboard code={code.toUpperCase()} />
    </CoachShell>
  );
}
