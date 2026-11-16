import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/layout";
import { PlayerProfileClient } from "@/components/coach/players/PlayerProfileClient";
import { CoachSignOutButton } from "@/components/sessions/CoachSignOutButton";
import { requireCoach } from "@/lib/auth-server";

export const instant = false;

type PageProps = {
  params: Promise<{ playerId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { playerId } = await params;
  return {
    title: `Joueur ${playerId.slice(0, 8)} | RealScouting Academy`,
  };
}

export default async function CoachPlayerProfilePage({ params }: PageProps) {
  const coachAuth = await requireCoach();
  if (!coachAuth) {
    redirect("/coach/login");
  }

  const { playerId } = await params;

  return (
    <CoachShell
      title="Profil joueur"
      description="Identité, équipes et notes staff."
      coachName={coachAuth.coach.displayName}
      actions={<CoachSignOutButton className="w-full" />}
    >
      <PlayerProfileClient playerId={playerId} />
    </CoachShell>
  );
}
