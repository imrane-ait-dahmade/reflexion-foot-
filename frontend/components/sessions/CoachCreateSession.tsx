"use client";

/**
 * @deprecated Prefer `CoachDashboard` for the V2 coach home.
 * Kept as a thin alias so older imports keep working.
 */
import { CoachDashboard } from "@/components/coach/dashboard";

type CoachCreateSessionProps = {
  coachName?: string;
};

export function CoachCreateSession({
  coachName = "Coach",
}: CoachCreateSessionProps) {
  return <CoachDashboard coachName={coachName} />;
}
