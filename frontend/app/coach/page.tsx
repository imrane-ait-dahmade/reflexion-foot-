import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachDashboard } from "@/components/coach/dashboard";
import { CoachShell } from "@/components/coach/layout";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
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
    <CoachShell
      title="Dashboard"
      description="Séances, codes et lecture des performances."
      coachName={coachAuth.coach.displayName}
      actions={<CoachSignOutButton className="w-full" />}
    >
      <CoachDashboard coachName={coachAuth.coach.displayName} />
    </CoachShell>
  );
}
