import type { Metadata } from "next";
import { VisualMemoryTest } from "@/components/tests/VisualMemoryTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Visual Memory Test | Football Vision Lab",
};

export default function VisualMemoryPage() {
  return (
    <TestShell
      title="Visual Memory Test"
      description="Memorize the highlighted positions, then select them once they disappear."
    >
      <VisualMemoryTest />
    </TestShell>
  );
}
