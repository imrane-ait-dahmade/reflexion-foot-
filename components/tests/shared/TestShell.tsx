import { BrandMark } from "@/components/brand/BrandMark";

type TestShellProps = {
  title: string;
  description: string;
  wide?: boolean;
  children: React.ReactNode;
};

export function TestShell({ title, description, wide = false, children }: TestShellProps) {
  return (
    <main className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:py-10 ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
      <header className="flex flex-col gap-4">
        <BrandMark size="sm" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="text-muted">{description}</p>
        </div>
      </header>
      {children}
    </main>
  );
}
