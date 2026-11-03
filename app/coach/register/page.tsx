import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachAuthForm } from "@/components/sessions/CoachAuthForm";
import { TestShell } from "@/components/tests/shared/TestShell";
import { requireCoach } from "@/lib/auth-server";

export const instant = false;

export const metadata: Metadata = {
  title: "Inscription entraîneur | RealScouting Academy",
};

export default async function CoachRegisterPage() {
  const coachAuth = await requireCoach();
  if (coachAuth) redirect("/coach");

  return (
    <TestShell
      title="Créer un compte entraîneur"
      description="Les joueurs n’ont pas besoin de compte : ils rejoignent avec un code."
    >
      <CoachAuthForm mode="register" />
    </TestShell>
  );
}
