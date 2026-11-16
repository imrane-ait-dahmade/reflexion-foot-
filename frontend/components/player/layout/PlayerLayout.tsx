import { ExperienceAttributes } from "@/components/theme/ExperienceAttributes";
import { ExerciseContainer } from "@/components/player/layout/ExerciseContainer";
import { PlayerHeader } from "@/components/player/layout/PlayerHeader";
import { cn } from "@/lib/cn";

type PlayerLayoutProps = {
  title?: string;
  description?: string;
  trailing?: React.ReactNode;
  /** Compact chrome for in-exercise screens. */
  immersive?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function PlayerLayout({
  title,
  description,
  trailing,
  immersive = false,
  children,
  className = "",
}: PlayerLayoutProps) {
  return (
    <>
      <ExperienceAttributes experience="player" immersive={immersive} />
      <main
        className={cn(
          "player-shell mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:py-10",
          immersive ? "max-w-3xl gap-4 py-4 sm:py-6" : "max-w-2xl",
          className,
        )}
      >
        <PlayerHeader
          title={title}
          description={description}
          trailing={trailing}
          minimal={immersive}
        />
        <ExerciseContainer>{children}</ExerciseContainer>
      </main>
    </>
  );
}
