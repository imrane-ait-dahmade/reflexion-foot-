import type { Metadata } from "next";
import { ReactionTimeTest } from "@/components/tests/ReactionTimeTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Reaction Time | Football Vision Lab",
};

export default function ReactionTimePage() {
  return (
    <TestShell
      title="Reaction Time"
      description="Wait for the circle to appear, then tap it as fast as you can."
    >
      <ReactionTimeTest />
    </TestShell>
  );
}
