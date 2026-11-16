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
      description="Entre le code donné par ton entraîneur, puis ton nom. Pas de compte requis."
    >
      <JoinSessionForm />
    </PlayerLayout>
  );
}
