import type { Metadata } from "next";
import { FootballVisualScanningTest } from "@/components/tests/FootballVisualScanningTest";
import { TestShell } from "@/components/tests/shared/TestShell";

export const metadata: Metadata = {
  title: "Lecture du jeu",
};

export default function FootballVisualScanningPage() {
  return (
    <TestShell
      title="Lecture du jeu"
      description="Analyse une action réelle : qui est proche du ballon, qui défend, qui est libre."
    >
      <FootballVisualScanningTest />
    </TestShell>
  );
}
