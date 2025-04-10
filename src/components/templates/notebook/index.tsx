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
import { useTabs } from '@/contexts/tabs-context';

interface Cell {
  id: number;
  type: 'code';
  content: string;
  stdout: string | null;
  output: string | null;
  error: string | null;
  executionCount: number | null;
}

interface NotebookCellProps {
  cell: Cell;
  onContentChange: (cellId: number, content: string) => void;
  onExecute: (cellId: number) => void;
  isExecuting: boolean;
  isSelected: boolean;
  onSelect: (cellId: number) => void;
}

interface ExecutionResult {
  stdout: string | null;
  output: string | null;
  error: string | null;
}

const NotebookCell: React.FC<NotebookCellProps> = ({
  cell,
  onContentChange,
  onExecute,
  isExecuting,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      className={`relative group ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onClick={() => onSelect(cell.id)}
    >
      <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-gray-500 select-none text-xs">
        {`[${cell.executionCount !== null ? cell.executionCount : ' '}]:`}
      </div>

      <div className="ml-12 border-l group-hover:border-l-2 group-hover:border-blue-200 pl-2 pr-10">
        <div
          className="w-full"
          style={{
            height: `${cell.content.split('\n').length * 20 + 20}px`,
            minHeight: '60px',
            maxHeight: '400px',
          }}
        >
          <Editor
            defaultLanguage="python"
            value={cell.content}
            onChange={value => onContentChange(cell.id, value || '')}
            theme="light"
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

        {(cell.stdout || cell.output) && (
          <div className="py-1 pl-2 font-mono text-xs text-gray-700 whitespace-pre-wrap border-l-2 border-green-200 bg-gray-50 my-1">
            {cell.stdout && <div>{cell.stdout}</div>}
            {cell.output && <div>{cell.output}</div>}
          </div>
        )}

        {cell.error && (
          <div className="py-1 pl-2 font-mono text-xs text-red-600 whitespace-pre-wrap border-l-2 border-red-200 bg-red-50 my-1">
            {cell.error}
          </div>
        )}
      </div>

      <div className="absolute right-0 top-0 h-full w-8 flex items-center justify-center invisible group-hover:visible">
        <button
          className="p-1 hover:bg-gray-200 rounded-sm"
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
  const { state } = useTabs();
  const activeTab = useMemo(
    () => state.tabs.find(tab => tab.id === state.activeTabId),
    [state.tabs, state.activeTabId]
  );

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

  const generateSetupCode = (): string => {
    if (!activeTab?.data?.initialData) return '';

    const dataStr = JSON.stringify(activeTab.data.initialData);

    return `
try:
    import pandas as pd
    import json
    import io
    
    # Initialize the dataframe from the tab's data
    df = pd.read_json(io.StringIO('''${dataStr}'''))
except ImportError as e:
    if "pandas" in str(e):
        print("ERROR: pandas is not installed. Please install it using:")
        print("pip install pandas")
        raise ImportError("pandas is required but not installed")
    else:
        raise e
`;
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

  const executeCell = async (cellId: number) => {
    setIsExecuting(true);
    try {
      const cell = cells.find(c => c.id === cellId);
      if (!cell) return;

      const setupCode = generateSetupCode();
      const fullCode = setupCode + '\n' + cell.content;

      const result = {};
      // const result = await invoke<ExecutionResult>('execute_python', { code: fullCode });

      setCells(
        cells.map(c =>
          c.id === cellId
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
      setCells(
        cells.map(c =>
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
    const setupCode = generateSetupCode();

    for (const cell of cells) {
      setIsExecuting(true);
      try {
        const fullCode = setupCode + '\n' + cell.content;
        const result = {};
        // const result = await invoke<ExecutionResult>('execute_python', { code: fullCode });

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
              content: '# Access the active tab data using "df" variable\nprint(df.head())',
            },
          ];
        }
        return prevCells;
      });
    }
  }, [activeTab?.id]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="flex items-center px-1 h-8 border-b bg-gray-50 shrink-0">
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-gray-200 rounded-sm text-xs"
            onClick={executeAllCells}
            disabled={isExecuting || !activeTab?.data?.initialData}
          >
            Run All
          </button>
          <button
            className="p-1 hover:bg-gray-200 rounded-sm"
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
          <button className="p-1 hover:bg-gray-200 rounded-sm" onClick={addCell}>
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
