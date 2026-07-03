import type { ReactNode } from 'react';
import Link from 'next/link';

/** Static product preview used on marketing pages (replaces interactive demo placeholders). */
export function MarketingProductPreview({ caption }: { caption?: string }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm"
      role="img"
      aria-label={caption ?? 'Tensr analysis workspace preview'}
    >
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-xs text-muted-foreground">Tensr workspace</span>
      </div>
      <div className="grid gap-px bg-border p-px sm:grid-cols-[140px_1fr_200px]">
        <div className="hidden bg-background p-3 sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Analyses
          </p>
          <ul className="mt-2 space-y-1 text-xs text-foreground/80">
            <li>Descriptive statistics</li>
            <li>T-test</li>
            <li>Correlation</li>
            <li>Regression</li>
          </ul>
        </div>
        <div className="bg-background p-4">
          <div className="mb-3 flex gap-2">
            {['Dataset', 'Results'].map(t => (
              <span
                key={t}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-4 gap-px bg-border text-[10px]">
              {['ID', 'Group', 'Score', 'Age'].map(h => (
                <div key={h} className="bg-muted/50 px-2 py-1 font-medium text-muted-foreground">
                  {h}
                </div>
              ))}
              {[1, 2, 3, 4].map(r => (
                <div key={r} className="col-span-4 grid grid-cols-4 gap-px bg-border">
                  {[r, r % 2 ? 'A' : 'B', 72 + r * 3, 20 + r * 2].map((cell, i) => (
                    <div key={i} className="bg-background px-2 py-1 text-foreground/70">
                      {cell}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden bg-background p-3 sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Assistant
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Run a t-test comparing groups and summarise effect size.
          </p>
        </div>
      </div>
      {caption ? (
        <p className="border-t border-border bg-background px-4 py-2 text-center text-xs text-muted-foreground">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingCtaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
