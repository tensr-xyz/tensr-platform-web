import { useState, useEffect, useMemo, useRef } from 'react';
import { useNotebookWorkspaceStore } from '@/stores/notebook-workspace-store';
import { cn } from '@/utils';
import Editor from '@monaco-editor/react';
import { Play, StopCircle as CircleStop, FileText } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { useTabsStore } from '@/stores/tabs-store';
import { useTheme } from '@/contexts/theme-context';
import MarkdownViewer from '@/components/organisms/markdown-viewer';
import { getTensrApiBaseUrl } from '@/lib/tensr-api-url';
import { getDatasetIdFromTab } from '@/lib/workspace-dataset';
import { apiClient } from '@/lib/api-client';
import { ApiRequestError, formatApiErrorMessage } from '@/lib/api-error';
import { adoptDerivedDataset } from '@/lib/adopt-derived-dataset';
import type { DerivedDatasetPayload } from '@/lib/adopt-derived-dataset';
import { captureProductException } from '@/lib/product-analytics';
import { presentCellError } from '@/lib/notebook-cell';

export const CODE_EXECUTION_UNAVAILABLE = 'Code execution temporarily unavailable';

function cellHasRunnableCode(content: string): boolean {
  return content.split('\n').some(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#');
  });
}

function detailFromApiBody(message: string): string | null {
  const jsonMatch = message.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const body = JSON.parse(jsonMatch[0]) as { detail?: unknown };
    return typeof body.detail === 'string' && body.detail.trim() ? body.detail.trim() : null;
  } catch {
    return null;
  }
}

function executionErrorMessage(err: unknown, fallback: string): string {
  if (
    err instanceof ApiRequestError &&
    (err.status === 422 || err.message.includes('string_too_long'))
  ) {
    return 'That cell is too long to send. The dataset loads on the server, so run the cell again.';
  }
  if (err instanceof ApiRequestError && err.status === 403) {
    const detail = detailFromApiBody(err.message);
    if (detail === CODE_EXECUTION_UNAVAILABLE || err.message.includes(CODE_EXECUTION_UNAVAILABLE)) {
      return CODE_EXECUTION_UNAVAILABLE;
    }
    if (detail && !detail.includes('{') && detail.length < 240) return detail;
  }
  if (err instanceof Error && err.message.includes(CODE_EXECUTION_UNAVAILABLE)) {
    return CODE_EXECUTION_UNAVAILABLE;
  }
  const plain = formatApiErrorMessage(err);
  if (!plain || plain.includes('{') || plain.length > 400 || /API Error:/i.test(plain)) {
    return fallback;
  }
  return plain;
}

interface Cell {
  id: number;
  type: 'code' | 'markdown';
  content: string;
  stdout: string | null;
  output: OutputContent | null;
  error: string | null;
  errorDetail: string | null;
  executionCount: number | null;
  runId: string | null;
}

interface ExecutionResult {
  stdout: string | null;
  output: OutputContent | null;
  error: string | null;
  traceback?: string | null;
  suggestion?: string | null;
}

interface OutputContent {
  type_?: string;
  type?: string;
  data: any;
}

// Component to render different types of output
const OutputRenderer: React.FC<{ output: OutputContent }> = ({ output }) => {
  const outputType = output.type_ || output.type;

  switch (outputType) {
    case 'plot':
      return (
        <div className="w-full">
          <img
            src={`data:image/png;base64,${output.data?.data ?? output.data}`}
            alt="Plot"
            className="max-w-full"
          />
        </div>
      );
    case 'table':
      return <TableRenderer data={output.data} />;
    case 'text':
      return <div className="font-mono whitespace-pre-wrap">{output.data}</div>;
    default:
      return <div className="font-mono whitespace-pre-wrap">Unknown output type: {outputType}</div>;
  }
};

// Component to render tables
const TableRenderer: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map(header => (
              <th
                key={header}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, i) => (
            <tr key={i}>
              {headers.map(header => (
                <td key={header} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface NotebookCellProps {
  cell: Cell;
  language: 'python' | 'r';
  onContentChange: (cellId: number, content: string) => void;
  onExecute: (cellId: number, source?: string) => void;
  isExecuting: boolean;
  isSelected: boolean;
  onSelect: (cellId: number) => void;
  onTypeChange?: (cellId: number, type: 'code' | 'markdown') => void;
  onSaveDataset?: (cellId: number) => void;
}

const NotebookCell: React.FC<NotebookCellProps> = ({
  cell,
  language,
  onContentChange,
  onExecute,
  isExecuting,
  isSelected,
  onSelect,
  onTypeChange,
  onSaveDataset,
}) => {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(cell.type === 'markdown' && !cell.content.trim());
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

  const isDarkMode = theme === 'dark';

  // For markdown cells, show editor when editing or empty, otherwise show rendered markdown
  if (cell.type === 'markdown') {
    return (
      <div
        className={`relative group ${isSelected ? 'bg-background' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        onClick={() => onSelect(cell.id)}
      >
        <div className="absolute left-0 top-0 bottom-0 flex w-11 shrink-0 items-start justify-end border-r border-border bg-muted/25 pt-2 pr-1.5">
          <FileText className="size-3.5 text-muted-foreground/70" aria-hidden />
        </div>

        <div className="ml-11 border-l border-border/80 pl-2 pr-10 group-hover:border-primary/30">
          {isEditing || !cell.content.trim() ? (
            <div
              className="w-full"
              style={{
                height: `${Math.max(cell.content.split('\n').length * 20 + 20, 100)}px`,
                minHeight: '100px',
              }}
            >
              <Editor
                defaultLanguage="markdown"
                value={cell.content}
                onChange={value => onContentChange(cell.id, value || '')}
                theme={isDarkMode ? 'vs-dark' : 'vs-light'}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'off',
                  folding: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  overviewRulerBorder: false,
                  lineDecorationsWidth: 0,
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  padding: { top: 4, bottom: 4 },
                  glyphMargin: false,
                }}
                onMount={(editor, monaco) => {
                  editor.onKeyDown(event => {
                    const enter = event.keyCode === monaco.KeyCode.Enter;
                    if (!enter || !(event.shiftKey || event.metaKey || event.ctrlKey)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onExecuteRef.current(cell.id, editor.getValue());
                  });
                }}
              />
            </div>
          ) : (
            <div className="py-2 cursor-text" onDoubleClick={() => setIsEditing(true)}>
              <MarkdownViewer content={cell.content} />
            </div>
          )}
        </div>

        <div className="absolute right-0 top-0 h-full w-8 flex items-center justify-center invisible group-hover:visible">
          {onTypeChange && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className="mb-8 size-6 rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={e => {
                e.stopPropagation();
                onTypeChange(cell.id, 'code');
              }}
              title="Convert to code cell"
            >
              <Play className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Code cell (existing implementation)
  return (
    <div
      className={`relative group ${isSelected ? 'bg-background' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
      onClick={() => onSelect(cell.id)}
    >
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 flex w-11 shrink-0 flex-col items-end justify-start border-r border-border bg-muted/25 pt-2 pr-2 font-mono text-[11px] tabular-nums leading-none',
          cell.executionCount !== null ? 'text-muted-foreground' : 'text-muted-foreground/40'
        )}
        aria-label={
          cell.executionCount !== null ? `Execution ${cell.executionCount}` : 'Not executed'
        }
      >
        <span>[{cell.executionCount !== null ? cell.executionCount : ' '}]</span>
      </div>

      <div className="ml-11 border-l border-border/80 pl-2 pr-10 group-hover:border-primary/30">
        <div
          className="w-full"
          style={{
            height: `${cell.content.split('\n').length * 20 + 20}px`,
            minHeight: '60px',
            maxHeight: '400px',
          }}
        >
          <Editor
            defaultLanguage={language}
            value={cell.content}
            onChange={value => onContentChange(cell.id, value || '')}
            theme={isDarkMode ? 'vs-dark' : 'vs-light'}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'off',
              folding: false,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              overviewRulerBorder: false,
              lineDecorationsWidth: 0,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              padding: { top: 4, bottom: 4 },
              glyphMargin: false,
            }}
            onMount={(editor, monaco) => {
              editor.onKeyDown(event => {
                const enter = event.keyCode === monaco.KeyCode.Enter;
                if (!enter || !(event.shiftKey || event.metaKey || event.ctrlKey)) return;
                event.preventDefault();
                event.stopPropagation();
                onExecuteRef.current(cell.id, editor.getValue());
              });
            }}
          />
        </div>

        {cell.output && (
          <div className="py-1 pl-2 my-1 dark:text-gray-200">
            <OutputRenderer output={cell.output} />
          </div>
        )}

        {cell.stdout && !cell.output && (
          <div className="py-1 pl-2 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap border-l-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 my-1">
            {cell.stdout}
          </div>
        )}

        {cell.error && (
          <div className="py-1 pl-2 font-mono text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap border-l-2 border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900 my-1">
            {cell.error}
            {cell.errorDetail ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-muted-foreground">Details</summary>
                <pre className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
                  {cell.errorDetail}
                </pre>
              </details>
            ) : null}
          </div>
        )}

        {language === 'python' && onSaveDataset && cell.runId && !cell.error ? (
          <div className="py-1 pl-2">
            <Button
              size="compact"
              type="button"
              variant="link"
              data-testid="notebook-save-dataset"
              className="h-auto px-0 text-xs font-medium text-primary"
              disabled={isExecuting}
              onClick={event => {
                event.stopPropagation();
                onSaveDataset(cell.id);
              }}
            >
              Save as new dataset
            </Button>
          </div>
        ) : null}
      </div>

      <div className="absolute right-0 top-0 h-full w-8 flex items-center justify-center invisible group-hover:visible">
        {onTypeChange && (
          <Button
            type="button"
            variant="ghost"
            size="compact"
            className="mb-8 size-6 rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={e => {
              e.stopPropagation();
              onTypeChange(cell.id, 'markdown');
            }}
            title="Convert to markdown cell"
          >
            <FileText className="w-3 h-3" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="compact"
          className="size-6 rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
          onClick={e => {
            e.stopPropagation();
            onExecute(cell.id);
          }}
          disabled={isExecuting}
        >
          {isExecuting ? <CircleStop className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
};

export const Notebook: React.FC = () => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  const [cells, setCells] = useState<Cell[]>([
    {
      id: 1,
      type: 'code',
      content: '# Access the active tab data using "df" variable\nprint(df.head())',
      stdout: null,
      output: null,
      error: null,
      errorDetail: null,
      executionCount: null,
      runId: null,
    },
  ]);
  const [selectedCell, setSelectedCell] = useState<number>(1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [language, setLanguage] = useState<'python' | 'r'>('python');

  const API_BASE_URL = getTensrApiBaseUrl();

  const generateSetupCode = (lang: 'python' | 'r'): string => {
    if (!activeTab?.data?.initialData) return '';

    const data = activeTab.data.initialData;

    if (lang === 'python') {
      // The server loads df, with its real types, when a dataset is open.
      // Importing matplotlib here made a head() take about 15 seconds.
      if (getDatasetIdFromTab(activeTab)) {
        return '';
      }

      // No dataset_id — inline the data, but cap at 200 rows so the request
      // body stays well under the API's 50 000-character limit.
      const MAX_INLINE_ROWS = 200;
      const inlineData = Array.isArray(data) ? data.slice(0, MAX_INLINE_ROWS) : data;
      const truncated = Array.isArray(data) && data.length > MAX_INLINE_ROWS;

      return `import pandas as pd
import json
import io
import matplotlib.pyplot as plt
import base64
from io import BytesIO

# Create DataFrame from the tab's data
data_dict = ${JSON.stringify(inlineData)}
df = pd.DataFrame(data_dict)${truncated ? `\n# Note: showing first ${MAX_INLINE_ROWS} of ${data.length} rows` : ''}

# Note: The backend already sets up __output__ capture system`;
    } else {
      if (getDatasetIdFromTab(activeTab)) {
        return '';
      }
      // For R, write the data to a JSON string and parse it properly
      if (!Array.isArray(data) || data.length === 0) {
        return `# No data available
df <- data.frame()`;
      }

      // Create a safe JSON string and let R parse it
      const jsonData = JSON.stringify(data);

      return `# Load required libraries
library(jsonlite)
library(ggplot2)
library(base64enc)

# Parse JSON data safely
json_string <- '${jsonData.replace(/'/g, "\\'")}'
df <- fromJSON(json_string)

# Convert columns with numeric-looking data to numeric
# This handles the percentage columns and other numeric fields
numeric_pattern_cols <- names(df)[sapply(df, function(x) {
  # Check if column looks numeric (ignoring NA values)
  non_na_vals <- x[!is.na(x) & x != "null" & x != ""]
  if(length(non_na_vals) == 0) return(FALSE)
  # Check if most values can be converted to numeric
  converted <- suppressWarnings(as.numeric(non_na_vals))
  sum(!is.na(converted)) >= length(non_na_vals) * 0.7
})]

# Convert the identified columns to numeric
for(col in numeric_pattern_cols) {
  df[[col]] <- suppressWarnings(as.numeric(df[[col]]))
}

# Clean up column names for R (replace problematic characters)
names(df) <- make.names(names(df))`;
    }
  };

  const [newCellType, setNewCellType] = useState<'code' | 'markdown'>('code');

  const addCell = () => {
    const newCell: Cell = {
      id: Date.now(),
      type: newCellType,
      content: newCellType === 'markdown' ? '' : '',
      stdout: null,
      output: null,
      error: null,
      errorDetail: null,
      executionCount: null,
      runId: null,
    };
    setCells([...cells, newCell]);
  };

  const changeCellType = (cellId: number, newType: 'code' | 'markdown') => {
    setCells(cells.map(cell => (cell.id === cellId ? { ...cell, type: newType } : cell)));
  };

  const updateCellContent = (cellId: number, newContent: string) => {
    setCells(cells.map(cell => (cell.id === cellId ? { ...cell, content: newContent } : cell)));
  };

  // Remove mockExecuteCode and replace with real API call
  const executeCode = async (
    code: string,
    language: 'python' | 'r'
  ): Promise<ExecutionResult & { run_id?: string | null }> => {
    try {
      if (language === 'r') {
        return apiClient.execute.r({
          code,
          dataset_id: getDatasetIdFromTab(activeTab),
        });
      }
      const datasetId = getDatasetIdFromTab(activeTab);
      return apiClient.execute.python({
        code,
        dataset_id: datasetId,
      });
    } catch (err) {
      return {
        stdout: null,
        output: null,
        error: executionErrorMessage(err, 'Failed to execute code'),
      };
    }
  };

  const saveCellAsDataset = async (cellId: number) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || cell.type !== 'code' || language !== 'python' || !cell.runId) return;
    setIsExecuting(true);
    try {
      const datasetId = getDatasetIdFromTab(activeTab);
      const result = await apiClient.execute.python({
        dataset_id: datasetId,
        save_as_dataset: true,
        run_id: cell.runId,
      });
      if (result.derived_dataset) {
        adoptDerivedDataset(result.derived_dataset);
      }
      setCells(prev =>
        prev.map(c =>
          c.id === cellId
            ? {
                ...c,
                error: result.error || (result.derived_dataset ? null : 'Nothing was saved'),
              }
            : c
        )
      );
    } catch (err) {
      setCells(prev =>
        prev.map(c =>
          c.id === cellId
            ? { ...c, error: executionErrorMessage(err, 'Failed to save dataset') }
            : c
        )
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const executeCell = async (cellId: number, source?: string) => {
    setIsExecuting(true);
    try {
      const cell = cells.find(c => c.id === cellId);
      if (!cell) return;
      const content = typeof source === 'string' ? source : cell.content;

      // Skip execution for markdown cells
      if (cell.type === 'markdown') {
        setIsExecuting(false);
        return;
      }

      if (!cellHasRunnableCode(content)) {
        setCells(prevCells =>
          prevCells.map(c =>
            c.id === cellId
              ? {
                  ...c,
                  error: 'This cell has no code to run.',
                  stdout: null,
                  output: null,
                  runId: null,
                }
              : c
          )
        );
        setIsExecuting(false);
        return;
      }

      const setupCode = generateSetupCode(language);
      const fullCode = setupCode ? `${setupCode}\n${content}` : content;

      // Use real API call
      const result = await executeCode(fullCode, language);

      // Process stdout to find JSON objects
      let output = result.output;
      if (!output && result.stdout) {
        try {
          // Find the last JSON object in the output
          const jsonMatch = result.stdout.match(/\{.*\}/g);
          if (jsonMatch) {
            const lastJson = jsonMatch[jsonMatch.length - 1];
            const parsedOutput = JSON.parse(lastJson);
            if (parsedOutput.type && parsedOutput.data) {
              output = {
                type_: parsedOutput.type,
                data: parsedOutput.data,
              };
            }
          }
        } catch (e) {}
      }

      // Handle backend output format (type vs type_)
      if (output && output.type && !output.type_) {
        output = {
          type_: output.type,
          data: output.data,
        };
      }

      setCells(prevCells =>
        prevCells.map(c =>
          c.id === cellId
            ? {
                ...c,
                stdout: result.stdout || null,
                output: output,
                ...presentCellError(
                  result.error || (!result.stdout && !output ? 'Ran. No output.' : null),
                  result.traceback,
                  result.suggestion
                ),
                executionCount: (c.executionCount || 0) + 1,
                runId: result.run_id || null,
              }
            : c
        )
      );
    } catch (err) {
      captureProductException(err, { where: 'notebook_cell' });
      setCells(prevCells =>
        prevCells.map(c =>
          c.id === cellId
            ? {
                ...c,
                error: executionErrorMessage(err, 'Failed to execute code'),
                errorDetail: null,
                stdout: null,
                output: null,
                runId: null,
              }
            : c
        )
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const executeAllCells = async () => {
    for (const cell of cells) {
      // Skip markdown cells
      if (cell.type === 'markdown') continue;

      if (!cellHasRunnableCode(cell.content)) {
        setCells(prevCells =>
          prevCells.map(c =>
            c.id === cell.id
              ? {
                  ...c,
                  error: 'This cell has no code to run.',
                  stdout: null,
                  output: null,
                  runId: null,
                }
              : c
          )
        );
        continue;
      }

      setIsExecuting(true);
      try {
        const setupCode = generateSetupCode(language);
        const fullCode = setupCode + '\n' + cell.content;

        // Use real API call
        const result = await executeCode(fullCode, language);
        const output = result.output;

        setCells(prevCells =>
          prevCells.map(c =>
            c.id === cell.id
              ? {
                  ...c,
                  stdout: result.stdout,
                  output,
                  error: result.error || (!result.stdout && !output ? 'Ran. No output.' : null),
                  executionCount: (c.executionCount || 0) + 1,
                  runId: result.run_id || null,
                }
              : c
          )
        );
      } catch (err) {
        captureProductException(err, { where: 'notebook_cell' });
        setCells(prevCells =>
          prevCells.map(c =>
            c.id === cell.id
              ? {
                  ...c,
                  error: executionErrorMessage(err, 'Failed to execute code'),
                  stdout: null,
                  output: null,
                  runId: null,
                }
              : c
          )
        );
      } finally {
        setIsExecuting(false);
      }
    }
  };

  useEffect(() => {
    if (activeTab?.data?.initialData) {
      setCells(prevCells => {
        if (prevCells.length === 1 && !prevCells[0].content.trim()) {
          return [
            {
              ...prevCells[0],
              content:
                language === 'python'
                  ? '# Access the active tab data using "df" variable\nprint(df.head())'
                  : '# Access the active tab data using "df" variable\nhead(df)',
            },
          ];
        }
        return prevCells;
      });
    }
  }, [activeTab?.id, language]);

  const canRun = !!activeTab?.data?.initialData;
  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;
  const handlersRef = useRef({ executeAllCells, executeCell, addCell });
  handlersRef.current = { executeAllCells, executeCell, addCell };

  const setControls = useNotebookWorkspaceStore(s => s.setControls);
  const resetNotebookControls = useNotebookWorkspaceStore(s => s.reset);

  useEffect(() => {
    setControls({
      language,
      newCellType,
      isExecuting,
      canRun,
      runAll: () => handlersRef.current.executeAllCells(),
      runSelected: () => {
        const id = selectedCellRef.current;
        if (id) handlersRef.current.executeCell(id);
      },
      addCell: () => handlersRef.current.addCell(),
      setLanguage,
      setNewCellType,
    });
  }, [language, newCellType, isExecuting, canRun, setControls]);

  useEffect(() => () => resetNotebookControls(), [resetNotebookControls]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full">
          {cells.map(cell => (
            <NotebookCell
              key={cell.id}
              cell={cell}
              language={language}
              onContentChange={updateCellContent}
              onExecute={executeCell}
              isExecuting={isExecuting}
              isSelected={selectedCell === cell.id}
              onSelect={setSelectedCell}
              onTypeChange={changeCellType}
              onSaveDataset={saveCellAsDataset}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
