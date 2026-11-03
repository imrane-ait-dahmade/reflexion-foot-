import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachCreateSession } from "@/components/sessions/CoachCreateSession";
import { TestShell } from "@/components/tests/shared/TestShell";
import { requireCoach } from "@/lib/auth-server";

export const instant = false;

export const metadata: Metadata = {
  title: "Coach | RealScouting Academy",
};

export default async function CoachPage() {
  const coachAuth = await requireCoach();
  if (!coachAuth) {
    redirect("/coach/login");
  }

  return (
    <TestShell
      title={`Bonjour, ${coachAuth.coach.displayName}`}
      description="Crée une session, partage le code aux joueurs, puis suis leurs résultats."
    >
      <CoachCreateSession />
    </TestShell>
  );
}
