import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/layout";
import { PlayersPage } from "@/components/coach/players";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
import { requireCoach } from "@/lib/auth-server";

export const instant = false;

export const metadata: Metadata = {
  title: "Joueurs | RealScouting Academy",
};

export default async function CoachPlayersPage() {
  const coachAuth = await requireCoach();
  if (!coachAuth) {
    redirect("/coach/login");
  }

  return (
    <CoachShell
      title="Joueurs"
      description="Effectif, postes et équipes via FastAPI."
      coachName={coachAuth.coach.displayName}
      actions={<CoachSignOutButton className="w-full" />}
    >
      <PlayersPage />
    </CoachShell>
  );
}
