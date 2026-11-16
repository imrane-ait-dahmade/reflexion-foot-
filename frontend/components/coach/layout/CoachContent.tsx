import { cn } from "@/lib/cn";

type CoachContentProps = {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
};

export function CoachContent({
  children,
  className = "",
  wide = true,
}: CoachContentProps) {
  return (
    <div
      className={cn(
        "coach-content @container mx-auto w-full flex-1 px-3 py-5 sm:px-5 sm:py-6 md:px-6 md:py-7",
        wide ? "max-w-6xl" : "max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
