import { BrandMark } from "@/components/brand/BrandMark";
import { cn } from "@/lib/cn";

type PlayerHeaderProps = {
  title?: string;
  description?: string;
  trailing?: React.ReactNode;
  minimal?: boolean;
  className?: string;
};

export function PlayerHeader({
  title,
  description,
  trailing,
  minimal = false,
  className = "",
}: PlayerHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4",
        minimal && "gap-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <BrandMark size="sm" href="/join" />
        {trailing}
      </div>
      {(title || description) && (
        <div className="flex flex-col gap-1.5">
          {title ? (
            <h1
              className={cn(
                "font-bold tracking-tight",
                minimal ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
              )}
            >
              {title}
            </h1>
          ) : null}
          {description && !minimal ? (
            <p className="text-muted">{description}</p>
          ) : null}
        </div>
      )}
    </header>
  );
}
