import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/atoms/alert';
import { Copy } from 'lucide-react';
import { useTabs } from '@/contexts/tabs-context';

interface DuplicateDialogProps {
  children: ReactNode;
}

interface DuplicateCase {
  row_index: number;
  values: Record<string, string>;
  duplicate_group: number;
}

interface DuplicateDetectionResponse {
  duplicates: DuplicateCase[];
  total_duplicates: number;
  duplicate_groups: number;
  affected_rows: number[];
}

export const FindDuplicatesDialog = ({ children }: DuplicateDialogProps) => {
  const { state } = useTabs();
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [matchCase, setMatchCase] = useState(true);
  const [firstCaseOnly, setFirstCaseOnly] = useState(false);
  const [results, setResults] = useState<DuplicateDetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeTab = useMemo(
    () => state.tabs.find(tab => tab.id === state.activeTabId),
    [state.tabs, state.activeTabId]
  );

  const variables = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) {
      return [];
    }
    return Object.keys(activeTab.data.initialData[0]).filter(key => key !== 'id');
  }, [activeTab?.data?.initialData]);

  const toggleColumn = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]
    );
  };

  const findDuplicates = async () => {
    if (!activeTab?.data?.filePath || selectedColumns.length === 0) {
      setError('Invalid file path or no columns selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request = {
        request: {
          path: activeTab.data.filePath,
          columns: selectedColumns,
          match_case: matchCase,
          first_case_only: firstCaseOnly,
        },
      };

      const response = await invoke<DuplicateDetectionResponse>('find_duplicates', request);

      setResults(response);
    } catch (err) {
      let errorMessage = 'An unknown error occurred';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as { message: unknown }).message);
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isFileLoaded = Boolean(activeTab?.data?.filePath && activeTab?.data?.initialData);

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find Duplicate Cases</DialogTitle>
        </DialogHeader>

        {!isFileLoaded ? (
          <Alert>
            <AlertTitle>No File Selected</AlertTitle>
            <AlertDescription>Please open a file first to find duplicates.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Column Selection */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Define matching variables</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Cases are considered duplicates when they have matching values on all selected
                variables.
              </p>
              <div className="max-h-60 overflow-y-auto">
                {variables.map(variable => (
                  <div
                    key={variable}
                    onClick={() => toggleColumn(variable)}
                    className={`p-2 cursor-pointer rounded flex items-center space-x-2 ${
                      selectedColumns.includes(variable)
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(variable)}
                      onChange={() => {}}
                      className="h-4 w-4"
                    />
                    <span>{variable}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium mb-2">Options</h3>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="matchCase"
                  checked={matchCase}
                  onChange={e => setMatchCase(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="matchCase">Match case when comparing string values</label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="firstCaseOnly"
                  checked={firstCaseOnly}
                  onChange={e => setFirstCaseOnly(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="firstCaseOnly">Show only first case in each duplicate group</label>
              </div>
            </div>

            {/* Results */}
            {results && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <Copy className="h-5 w-5 text-blue-500" />
                  <h3 className="font-medium">Duplicate Cases Found</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-sm">
                    <span className="font-medium">Total Duplicates:</span>{' '}
                    {results.total_duplicates}
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-sm">
                    <span className="font-medium">Duplicate Groups:</span>{' '}
                    {results.duplicate_groups}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2">Row</th>
                        <th className="text-left p-2">Group</th>
                        {selectedColumns.map(col => (
                          <th key={col} className="text-left p-2">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.duplicates.map((dup, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{dup.row_index}</td>
                          <td className="p-2">{dup.duplicate_group + 1}</td>
                          {selectedColumns.map(col => (
                            <td key={col} className="p-2">
                              {dup.values[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <button
            onClick={findDuplicates}
            disabled={!isFileLoaded || selectedColumns.length === 0 || isLoading}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Finding Duplicates...' : 'Find Duplicates'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FindDuplicatesDialog;
