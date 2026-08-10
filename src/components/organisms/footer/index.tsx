import { Terminal } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { useWorkspaceSheetStatusStore } from '@/stores/workspace-sheet-status-store';
import { cn } from '@/utils';

interface FooterProps {
  isLoading: boolean;
  activeTab?: { type: string; name?: string; isDirty?: boolean };
  rowCount: number;
}

const Footer = ({ isLoading, activeTab, rowCount }: FooterProps) => {
  const { terminalOpen, toggleTerminal } = useProjectStore();
  const sheetStatus = useWorkspaceSheetStatusStore(s => s.status);
  const showSheetStats = activeTab?.type === 'spreadsheet';
  const isSaved = showSheetStats && activeTab && !activeTab.isDirty;

  return (
    <footer
      className="flex h-7 min-h-7 shrink-0 items-center gap-3 border-t border-border bg-background px-3.5 font-mono text-[11px] text-muted-foreground"
      aria-label="Sheet status"
    >
      {isLoading ? (
        <span>Loading…</span>
      ) : showSheetStats ? (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                isSaved ? 'bg-emerald-500' : 'bg-amber-500'
              )}
              aria-hidden
            />
            <span>{isSaved ? 'Saved' : 'Unsaved'}</span>
          </span>
          <span className="text-border/80" aria-hidden>
            ·
          </span>
          <span className="tabular-nums">
            {sheetStatus?.visibleRows != null && sheetStatus?.totalRows != null
              ? sheetStatus.visibleRows === sheetStatus.totalRows
                ? `Total rows: ${sheetStatus.totalRows.toLocaleString()}`
                : `${sheetStatus.visibleRows.toLocaleString()} / ${sheetStatus.totalRows.toLocaleString()} rows`
              : `Total rows: ${rowCount.toLocaleString()}`}
          </span>
          {sheetStatus ? (
            <>
              <span className="text-border/80" aria-hidden>
                ·
              </span>
              <span className="tabular-nums">
                {sheetStatus.visibleColumns}/{sheetStatus.totalColumns} cols
              </span>
            </>
          ) : null}
          {sheetStatus?.selectionCount != null && sheetStatus.selectionCount > 0 ? (
            <>
              <span className="text-border/80" aria-hidden>
                ·
              </span>
              <span className="tabular-nums">
                Count: {sheetStatus.selectionCount.toLocaleString()}
                {sheetStatus.selectionSum != null
                  ? ` · Sum: ${sheetStatus.selectionSum.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}`
                  : ''}
                {sheetStatus.selectionAvg != null
                  ? ` · Avg: ${sheetStatus.selectionAvg.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}`
                  : ''}
              </span>
            </>
          ) : null}
          <span className="flex-1" />
          {sheetStatus?.cellRef ? (
            <span className="tabular-nums text-foreground/80">{sheetStatus.cellRef}</span>
          ) : null}
          <span className="text-border/80" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => toggleTerminal(!terminalOpen)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground',
              terminalOpen ? 'bg-muted text-foreground' : 'text-muted-foreground'
            )}
            title={terminalOpen ? 'Hide terminal' : 'Show terminal'}
          >
            <Terminal className="size-2.5" aria-hidden />
            <span>Terminal</span>
            <span className="font-mono text-[9px] opacity-70">⌘`</span>
          </button>
        </>
      ) : activeTab ? (
        <>
          <span className="truncate">{activeTab.name}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => toggleTerminal(!terminalOpen)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground',
              terminalOpen ? 'bg-muted text-foreground' : 'text-muted-foreground'
            )}
            title={terminalOpen ? 'Hide terminal' : 'Show terminal'}
          >
            <Terminal className="size-2.5" aria-hidden />
            <span>Terminal</span>
            <span className="font-mono text-[9px] opacity-70">⌘`</span>
          </button>
        </>
      ) : (
        <span>Ready</span>
      )}
    </footer>
  );
};

export default Footer;
