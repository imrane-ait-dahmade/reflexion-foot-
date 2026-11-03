import type { Metadata } from "next";
import { VisualTrackingTest } from "@/components/tests/VisualTrackingTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Suivi de numéros | RealScouting Academy",
};

export default function VisualTrackingPage() {
  return (
    <TestShell
      title="Suivi de numéros"
      description="Tous les numéros bougent. Suis la cible du regard et touche-la."
    >
      <VisualTrackingTest />
    </TestShell>
  );
}
