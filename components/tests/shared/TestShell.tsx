import Link from "next/link";

type TestShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function TestShell({ title, description, children }: TestShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← Football Vision Lab
        </Link>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-foreground/70">{description}</p>
      </header>
      {children}
    </main>
  );
}
