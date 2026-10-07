import type { Metadata } from "next";
import { VisualTrackingTest } from "@/components/tests/VisualTrackingTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Dynamic Number Tracking | Football Vision Lab",
};

export default function VisualTrackingPage() {
  return (
    <TestShell
      title="Dynamic Number Tracking"
      description="All numbers keep moving. Follow the target number with your eyes and tap it."
    >
      <VisualTrackingTest />
    </TestShell>
  );
}
