import type { Metadata } from "next";
import { CoachAuthForm } from "@/components/sessions/CoachAuthForm";
import { TestShell } from "@/components/tests/shared/TestShell";

export const instant = false;

export const metadata: Metadata = {
  title: "Connexion entraîneur | RealScouting Academy",
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function CoachLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  return (
    <TestShell
      title="Connexion entraîneur"
      description="Connecte-toi pour créer des sessions et voir les résultats des joueurs."
    >
      <CoachAuthForm mode="login" nextPath={next || "/coach"} />
    </TestShell>
  );
}
