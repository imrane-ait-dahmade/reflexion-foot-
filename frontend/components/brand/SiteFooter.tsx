import { ExternalLink } from "lucide-react";

const GITHUB_URL = "https://github.com/imrane-ait-dahmade/reflexion-foot-";
const REALSCOUTING_URL = "https://realscouting.com/";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.584 2 12.253c0 4.526 2.865 8.363 6.839 9.712.5.094.682-.222.682-.482 0-.237-.009-.866-.014-1.7-2.782.618-3.369-1.38-3.369-1.38-.455-1.183-1.11-1.498-1.11-1.498-.908-.636.069-.623.069-.623 1.004.072 1.532 1.057 1.532 1.057.892 1.568 2.341 1.115 2.91.853.091-.662.35-1.115.636-1.372-2.22-.259-4.555-1.142-4.555-5.082 0-1.122.39-2.04 1.029-2.759-.103-.26-.446-1.302.098-2.714 0 0 .84-.276 2.75 1.053A9.35 9.35 0 0 1 12 6.844a9.35 9.35 0 0 1 2.504.346c1.909-1.329 2.748-1.053 2.748-1.053.546 1.412.203 2.454.1 2.714.64.719 1.028 1.637 1.028 2.759 0 3.95-2.339 4.82-4.566 5.074.359.317.679.943.679 1.901 0 1.372-.012 2.477-.012 2.814 0 .263.18.58.688.481A10.02 10.02 0 0 0 22 12.253C22 6.584 17.523 2 12 2Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between md:max-w-6xl">
        <p className="text-center text-xs text-muted sm:text-left">
          © 2026 RealScouting Academy
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
            <GitHubIcon className="size-5" />
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
