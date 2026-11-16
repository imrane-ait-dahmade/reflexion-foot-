"use client";

import { PlayerProfile } from "@/components/coach/players/PlayerProfile";
import { StaffApiGate } from "@/components/coach/players/StaffApiGate";
import { Skeleton } from "@/components/ui/Skeleton";
import { useStaffApiSession } from "@/hooks/useStaffApiSession";

export function PlayerProfileClient({ playerId }: { playerId: string }) {
  const staff = useStaffApiSession();

  if (staff.checking && !staff.ready) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (!staff.ready) {
    return (
      <StaffApiGate
        checking={staff.checking}
        error={staff.error}
        onLogin={staff.login}
      />
    );
  }

  return <PlayerProfile playerId={playerId} />;
}
