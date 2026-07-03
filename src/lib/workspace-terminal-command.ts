import type { Tab } from '@/stores/tabs-store';
import { ViewType } from '@/stores/tabs-store';
import { getDatasetIdFromTab } from '@/lib/workspace-dataset';
import { getTensrApiBaseUrl } from '@/lib/tensr-api-url';

export function runWorkspaceTerminalCommand(
  command: string,
  activeTab: Tab | undefined
): string | null {
  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? '';

  if (cmd === 'help') {
    return [
      'Workspace commands:',
      '  help              — this message',
      '  dataset           — active dataset id',
      '  columns           — column names in active sheet',
      '  api               — tensr-api base URL',
      '  analyze           — hint: use ⌘K for analyses',
      '',
      'Notebook Python runs via the Notebook tab (tensr-api execute).',
    ].join('\r\n');
  }

  if (cmd === 'dataset') {
    const id = getDatasetIdFromTab(activeTab);
    return id ? `dataset_id: ${id}` : 'No dataset tab active. Open a dataset from Home.';
  }

  if (cmd === 'columns') {
    if (activeTab?.type !== ViewType.SPREADSHEET || !activeTab.data?.initialColumns?.length) {
      return 'Open a spreadsheet tab with data first.';
    }
    return activeTab.data.initialColumns.map(c => c.id).join(', ');
  }

  if (cmd === 'api') {
    return getTensrApiBaseUrl();
  }

  if (cmd === 'analyze') {
    return 'Press ⌘K (or Ctrl+K) and pick an analysis. Requires an open dataset workspace.';
  }

  if (cmd === 'clear') {
    return '__CLEAR__';
  }

  return null;
}
