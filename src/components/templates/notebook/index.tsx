import { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { LuPlay, LuPlus, LuCircleStop } from 'react-icons/lu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useTabsStore } from '@/stores/tabs-store';
import { useTheme } from '@/contexts/theme-context';

interface Cell {
  id: number;
  type: 'code';
  content: string;
  stdout: string | null;
  output: OutputContent | null;
  error: string | null;
  executionCount: number | null;
}

interface ExecutionResult {
  stdout: string | null;
  output: OutputContent | null;
  error: string | null;
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
  onExecute: (cellId: number) => void;
  isExecuting: boolean;
  isSelected: boolean;
  onSelect: (cellId: number) => void;
}

const NotebookCell: React.FC<NotebookCellProps> = ({
  cell,
  language,
  onContentChange,
  onExecute,
  isExecuting,
  isSelected,
  onSelect,
}) => {
  const { theme } = useTheme();

  const isDarkMode = theme === 'dark';

  return (
    <div
      className={`relative group ${isSelected ? 'bg-background' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
      onClick={() => onSelect(cell.id)}
    >
      <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-gray-500 dark:text-gray-400 select-none text-xs">
        {`[${cell.executionCount !== null ? cell.executionCount : ' '}]:`}
      </div>

      <div className="ml-12 border-l border-border group-hover:border-l-2 group-hover:border-accent pl-2 pr-10">
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
          </div>
        )}
      </div>

      <div className="absolute right-0 top-0 h-full w-8 flex items-center justify-center invisible group-hover:visible">
        <button
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          onClick={e => {
            e.stopPropagation();
            onExecute(cell.id);
          }}
          disabled={isExecuting}
        >
          {isExecuting ? <LuCircleStop className="w-3 h-3" /> : <LuPlay className="w-3 h-3" />}
        </button>
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
      executionCount: null,
    },
  ]);
  const [selectedCell, setSelectedCell] = useState<number>(1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [language, setLanguage] = useState<'python' | 'r'>('python');

  // API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

  const generateSetupCode = (lang: 'python' | 'r'): string => {
    if (!activeTab?.data?.initialData) return '';

    const data = activeTab.data.initialData;

    if (lang === 'python') {
      return `import pandas as pd
import json
import io
import matplotlib.pyplot as plt
import base64
from io import BytesIO

# Create DataFrame from the tab's data
data_dict = ${JSON.stringify(data)}
df = pd.DataFrame(data_dict)

# Note: The backend already sets up __output__ capture system`;
    } else {
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

  const addCell = () => {
    const newCell: Cell = {
      id: Date.now(),
      type: 'code',
      content: '',
      stdout: null,
      output: null,
      error: null,
      executionCount: null,
    };
    setCells([...cells, newCell]);
  };

  const updateCellContent = (cellId: number, newContent: string) => {
    setCells(cells.map(cell => (cell.id === cellId ? { ...cell, content: newContent } : cell)));
  };

  // Remove mockExecuteCode and replace with real API call
  const executeCode = async (code: string, language: 'python' | 'r'): Promise<ExecutionResult> => {
    const endpoint =
      language === 'python'
        ? `${API_BASE_URL}/api/execute/python`
        : `${API_BASE_URL}/api/execute/r`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        return {
          stdout: null,
          output: null,
          error: errorText || 'Failed to execute code',
        };
      }
      return await response.json();
    } catch (err) {
      return {
        stdout: null,
        output: null,
        error: err instanceof Error ? err.message : 'Failed to execute code',
      };
    }
  };

  const executeCell = async (cellId: number) => {
    setIsExecuting(true);
    try {
      const cell = cells.find(c => c.id === cellId);
      if (!cell) return;

      const setupCode = generateSetupCode(language);
      const fullCode = setupCode + '\n' + cell.content;

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
                error: result.error || null,
                executionCount: (c.executionCount || 0) + 1,
              }
            : c
        )
      );
    } catch (err) {
      setCells(prevCells =>
        prevCells.map(c =>
          c.id === cellId
            ? {
                ...c,
                error: err instanceof Error ? err.message : String(err),
                stdout: null,
                output: null,
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
      setIsExecuting(true);
      try {
        const setupCode = generateSetupCode(language);
        const fullCode = setupCode + '\n' + cell.content;

        // Use real API call
        const result = await executeCode(fullCode, language);

        setCells(prevCells =>
          prevCells.map(c =>
            c.id === cell.id
              ? {
                  ...c,
                  stdout: result.stdout,
                  output: result.output,
                  error: result.error,
                  executionCount: (c.executionCount || 0) + 1,
                }
              : c
          )
        );
      } catch (err) {
        setCells(prevCells =>
          prevCells.map(c =>
            c.id === cell.id
              ? {
                  ...c,
                  error: err instanceof Error ? err.message : String(err),
                  stdout: null,
                  output: null,
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex items-center px-1 h-8 border-b border-border bg-background flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-gray-200 rounded text-xs"
            onClick={executeAllCells}
            disabled={isExecuting || !activeTab?.data?.initialData}
          >
            Run All
          </button>
          <button
            className="p-1 hover:bg-gray-200 rounded"
            onClick={() => selectedCell && executeCell(selectedCell)}
            disabled={isExecuting || !activeTab?.data?.initialData}
          >
            <LuPlay className="w-3 h-3" />
          </button>
          <Select value={language} onValueChange={value => setLanguage(value as 'python' | 'r')}>
            <SelectTrigger className="h-6 text-xs w-24">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python" className="text-xs">
                Python
              </SelectItem>
              <SelectItem value="r" className="text-xs">
                R
              </SelectItem>
            </SelectContent>
          </Select>
          <button className="p-1 hover:bg-gray-200 rounded" onClick={addCell}>
            <LuPlus className="w-3 h-3" />
          </button>
        </div>
      </div>

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
            />
          ))}
        </div>
      </div>
    </div>
  );
};
