import { cn } from "@/lib/cn";

type ExerciseContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/** Focus frame for cognitive exercises — high contrast, no chrome noise. */
export function ExerciseContainer({
  children,
  className = "",
}: ExerciseContainerProps) {
  return (
    <section
      className={cn(
        "player-exercise-frame flex w-full flex-1 flex-col gap-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
