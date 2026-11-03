import type { Metadata } from "next";
import { VisualMemoryTest } from "@/components/tests/VisualMemoryTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Mémoire visuelle | RealScouting Academy",
};

export default function VisualMemoryPage() {
  return (
    <TestShell
      title="Mémoire visuelle"
      description="Mémorise les cases allumées, puis sélectionne-les une fois éteintes."
    >
      <VisualMemoryTest />
    </TestShell>
  );
}
