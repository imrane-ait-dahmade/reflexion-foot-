import type { Metadata } from "next";
import { ReactionTimeTest } from "@/components/tests/ReactionTimeTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Temps de réaction | RealScouting Academy",
};

export default function ReactionTimePage() {
  return (
    <TestShell
      title="Temps de réaction"
      description="Attends l'apparition du cercle, puis touche-le le plus vite possible."
    >
      <ReactionTimeTest />
    </TestShell>
  );
}
