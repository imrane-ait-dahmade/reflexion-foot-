import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  /** Pass `false` on the home page to avoid a self-link. */
  href?: string | false;
  size?: "sm" | "md";
  showName?: boolean;
};

export function BrandMark({
  href = "/",
  size = "md",
  showName = true,
}: BrandMarkProps) {
  const logoClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  const content = (
    <span className="inline-flex items-center gap-3">
      <Image
        src="/logo-rs.png"
        alt="RealScouting"
        width={size === "sm" ? 32 : 40}
        height={size === "sm" ? 32 : 40}
        className={`${logoClass} object-contain`}
        priority
      />
      {showName && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-wide text-foreground">
            RealScouting
          </span>
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-brand">
            Academy
          </span>
        </span>
      )}
    </span>
  );

  if (href === false) return content;
  return (
    <Link href={href} className="w-fit hover:opacity-90">
      {content}
    </Link>
  );
}
