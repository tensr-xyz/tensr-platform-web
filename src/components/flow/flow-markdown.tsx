'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { liftInlineTables } from '@/lib/lift-inline-tables';
import { keepLineBreaks } from '@/components/flow/chat-output';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/utils';

/** Agent answers in Flow: GFM tables render through the shared Table, type stays 400/500. */
const components: Components = {
  p: ({ children }) => <p className="flow-md-p">{children}</p>,
  ul: ({ children }) => <ul className="flow-md-list">{children}</ul>,
  ol: ({ children }) => <ol className="flow-md-list flow-md-ordered">{children}</ol>,
  strong: ({ children }) => <strong className="flow-md-strong">{children}</strong>,
  h1: ({ children }) => <p className="flow-md-heading">{children}</p>,
  h2: ({ children }) => <p className="flow-md-heading">{children}</p>,
  h3: ({ children }) => <p className="flow-md-heading">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} className="flow-md-link" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="flow-md-table">
      <Table className="flow-table">{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell>{children}</TableCell>,
};

export function FlowMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('flow-md', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {keepLineBreaks(liftInlineTables(children))}
      </ReactMarkdown>
    </div>
  );
}
