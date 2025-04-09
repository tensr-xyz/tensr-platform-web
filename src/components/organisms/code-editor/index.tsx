import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '@/contexts/theme-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Button } from '@/components/atoms/button';
import { LuCirclePlay, LuCircleStop } from 'react-icons/lu';

interface ExecutionResult {
  output: string;
  stdout: string;
  error: string | null;
}

const CodeEditor = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState('');
  const { theme } = useTheme();

  const executeCode = async () => {
    if (language !== 'python') {
      setError('Only Python execution is currently supported');
      return;
    }

    setIsExecuting(true);
    setError('');

    try {
      const result = {};
      // const result = await invoke<ExecutionResult>('execute_python', {
      //   code,
      // });
      setOutput(result);
    } catch (err: unknown) {
      // Type guard to handle the error safely
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'An unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 p-2">
      <div className="flex items-center justify-between">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Select language" />
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

        <Button onClick={executeCode} disabled={isExecuting || !code.trim()} className="h-8">
          {isExecuting ? (
            <LuCircleStop className="w-4 h-4 mr-2" />
          ) : (
            <LuCirclePlay className="w-4 h-4 mr-2" />
          )}
          {isExecuting ? 'Running...' : 'Run Code'}
        </Button>
      </div>

      <div className="grid grid-rows-2 gap-4 flex-1">
        {/* Code Editor */}
        <div className="relative">
          <div className="absolute inset-0">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={value => setCode(value || '')}
              theme={theme === 'light' ? 'light' : 'vs-dark'}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                overviewRulerBorder: false,
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
              }}
            />
          </div>
        </div>

        {/* Output Panel */}
        <div className="bg-neutral-100 dark:bg-neutral-900 rounded-md p-4 overflow-auto">
          {error && <div className="text-red-500 mb-4">{error}</div>}
          {output && (
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {output.stdout && <div className="mb-4">{output.stdout}</div>}
              {output.output && <div className="text-blue-500">Result: {output.output}</div>}
            </pre>
          )}
          {!output && !error && <div className="text-gray-500">Output will appear here...</div>}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
