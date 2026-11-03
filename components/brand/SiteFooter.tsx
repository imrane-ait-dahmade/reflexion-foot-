import { ExternalLink, Github } from "lucide-react";

const GITHUB_URL = "https://github.com/imrane-ait-dahmade/reflexion-foot-";
const REALSCOUTING_URL = "https://realscouting.com/";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between">
        <p className="text-center text-xs text-muted sm:text-left">
          © {new Date().getFullYear()} RealScouting Academy
        </p>

        <nav aria-label="Liens externes" className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:border-brand hover:text-brand"
            aria-label="Code source sur GitHub"
            title="GitHub"
          >
            <Github className="size-5" aria-hidden />
          </a>
          <a
            href={REALSCOUTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
            title="RealScouting"
          >
            realscouting.com
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </nav>
      </div>
    </footer>
  );
}
