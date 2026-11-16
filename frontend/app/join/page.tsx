import type { Metadata } from "next";
import { PlayerLayout } from "@/components/player/layout";
import { JoinSessionForm } from "@/components/sessions/JoinSessionForm";

export const metadata: Metadata = {
  title: "Rejoindre une session | RealScouting Academy",
};

export default function JoinPage() {
  return (
    <PlayerLayout
      title="Rejoindre une session"
      description="Entre le code de séance et ton code joueur (donnés par ton entraîneur)."
    >
      <JoinSessionForm />
    </PlayerLayout>
  );
}
