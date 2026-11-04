// Jest stub: react-markdown ships ESM only. Tests that import screens get plain text.
import type { ReactNode } from 'react';

export type Components = Record<string, unknown>;

export default function ReactMarkdown({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
