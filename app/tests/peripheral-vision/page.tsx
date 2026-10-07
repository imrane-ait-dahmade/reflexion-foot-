import type { Metadata } from "next";
import { PeripheralVisionTest } from "@/components/tests/PeripheralVisionTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Peripheral Vision | Football Vision Lab",
};

export default function PeripheralVisionPage() {
  return (
    <TestShell
      title="Peripheral Vision"
      description="Keep your eyes on the center. Detect the target appearing in your peripheral vision."
    >
      <PeripheralVisionTest />
    </TestShell>
  );
}
