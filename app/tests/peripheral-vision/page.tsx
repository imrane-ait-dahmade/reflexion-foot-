import type { Metadata } from "next";
import { PeripheralVisionTest } from "@/components/tests/PeripheralVisionTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Vision périphérique | RealScouting Academy",
};

export default function PeripheralVisionPage() {
  return (
    <TestShell
      title="Vision périphérique"
      description="Fixe le centre. Détecte la cible qui flash dans ta vision périphérique."
    >
      <PeripheralVisionTest />
    </TestShell>
  );
}
