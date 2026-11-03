import type { Metadata } from "next";
import { CoachAuthForm } from "@/components/sessions/CoachAuthForm";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Inscription entraîneur | RealScouting Academy",
};

export default function CoachRegisterPage() {
  return (
    <TestShell
      title="Créer un compte entraîneur"
      description="Les joueurs n’ont pas besoin de compte : ils rejoignent avec un code."
    >
      <CoachAuthForm mode="register" />
    </TestShell>
  );
}
