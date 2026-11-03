import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachAuthForm } from "@/components/sessions/CoachAuthForm";
import { TestShell } from "@/components/tests/shared/TestShell";
import { requireCoach } from "@/lib/auth-server";

export const instant = false;

export const metadata: Metadata = {
  title: "Connexion entraîneur | RealScouting Academy",
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function CoachLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const coachAuth = await requireCoach();
  const destination =
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/coach/login") &&
    !next.startsWith("/coach/register")
      ? next
      : "/coach";
  if (coachAuth) redirect(destination);

  return (
    <TestShell
      title="Connexion entraîneur"
      description="Connecte-toi pour créer des sessions et voir les résultats des joueurs."
    >
      <CoachAuthForm mode="login" nextPath={next || "/coach"} />
    </TestShell>
  );
}
