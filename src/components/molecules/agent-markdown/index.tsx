'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/utils';

/** Compact GFM rendering for the agent panel (tables, lists, code). */
export const agentMarkdownComponents: Components = {
  p: ({ children }) => <p className="my-1.5 leading-snug">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-4">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-2 max-h-48 overflow-auto rounded-md bg-muted/60 p-2 text-xs">{children}</pre>
  ),
  code: ({ className, children, ...props }) => {
    const inline = !className;
    if (inline) {
      return (
        <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={cn('font-mono text-xs', className)} {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-max border-collapse text-left text-[12px] leading-snug">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-t border-border first:border-t-0">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-2.5 py-1.5 font-medium text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums text-foreground">{children}</td>
  ),
};

export function AgentMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('max-w-none text-sm text-foreground', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={agentMarkdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
