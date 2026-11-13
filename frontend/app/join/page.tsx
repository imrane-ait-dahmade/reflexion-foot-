import type { Metadata } from "next";
import { JoinSessionForm } from "@/components/sessions/JoinSessionForm";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Rejoindre une session | RealScouting Academy",
};

export default function JoinPage() {
  return (
    <TestShell
      title="Rejoindre une session"
      description="Entre le code donné par ton entraîneur, puis ton nom. Pas de compte requis."
    >
      <JoinSessionForm />
    </TestShell>
  );
}
