import { useEffect, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import Loading from '@/components/molecules/loading';
import { Button } from '@/components/atoms/button';

interface MarkdownViewerProps {
  filePath?: string;
  content?: string; // Direct markdown content
  editable?: boolean; // New prop to enable editing
  onContentChange?: (content: string) => void; // Callback for content changes
}

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const MarkdownViewer = ({
  filePath,
  content,
  editable = true,
  onContentChange,
}: MarkdownViewerProps) => {
  const [markdownContent, setMarkdownContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      // If content is provided directly, use it
      if (content) {
        setMarkdownContent(content);
        setError(null);
        return;
      }

      // Otherwise, load from file path
      if (!filePath) {
        setMarkdownContent('');
        return;
      }

      setIsLoading(true);
      try {
        // Here you would normally load from file system
        // For now, setting empty content since the invoke is commented out
        const fileContent = '';
        // const fileContent = await invoke<string>('read_file', { path: filePath });
        setMarkdownContent(fileContent);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [filePath, content]);

  const handleContentChange = (value: string = '') => {
    setMarkdownContent(value);
    onContentChange?.(value);
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading file: {error}</div>;
  }

  const components: Components = {
    h1: ({ children }) => <h1 className="text-3xl font-bold mb-6 pb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-2xl font-semibold mt-8 mb-4 pb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xl font-medium mt-6 mb-3">{children}</h3>,
    h4: ({ children }) => <h4 className="text-lg font-medium mt-4 mb-2">{children}</h4>,
    p: ({ children }) => {
      if (typeof children === 'string' && children.trim().startsWith('<svg')) {
        return (
          <div className="my-6">
            <div
              dangerouslySetInnerHTML={{ __html: children.trim() }}
              className="w-full flex justify-center"
            />
          </div>
        );
      }
      return <p className="mb-4 leading-relaxed">{children}</p>;
    },
    ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="mb-1">{children}</li>,
    table: ({ children }) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-border rounded-lg">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    tr: ({ children }) => <tr className="border-b border-border hover:bg-muted/50">{children}</tr>,
    th: ({ children }) => (
      <th className="p-3 text-left font-semibold border-r border-border first:rounded-tl-lg last:rounded-tr-lg">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="p-3 border-r border-border">{children}</td>,
    code: ({ inline, className, children }: CodeProps) => {
      if (
        className === 'language-svg' ||
        className?.includes('svg') ||
        (typeof children === 'string' && children.trim().startsWith('<svg'))
      ) {
        return (
          <div className="my-6">
            <div
              dangerouslySetInnerHTML={{
                __html: (typeof children === 'string' ? children : String(children)).trim(),
              }}
              className="w-full flex justify-center"
            />
          </div>
        );
      }

      if (inline) {
        return <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{children}</code>;
      }
      return (
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-6">
          <code className="text-sm font-mono">{children}</code>
        </pre>
      );
    },
    img: ({ src, alt }) => (
      <img alt={alt} src={src} className="max-w-full h-auto rounded-lg my-6 shadow-sm" />
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary pl-4 italic my-6 bg-muted/30 py-2 rounded-r">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-8 border-t border-border" />,
    svg: ({ children, ...props }) => (
      <div className="my-6 flex justify-center overflow-x-auto w-full">
        <svg {...props} className="max-w-full h-auto">
          {children}
        </svg>
      </div>
    ),
    // Enhanced styling for statistical content
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  };

  return (
    <div className="max-w-5xl mx-auto overflow-hidden bg-background">
      {/* Unified Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">{filePath ? `${filePath}` : 'Document'}</div>
          {isEditing && (
            <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
              Editing
            </span>
          )}
        </div>
        {editable && (
          <div className="flex items-center gap-2">
            <Button className="px-6" variant="outline" onClick={toggleEdit}>
              {isEditing ? 'Save & Exit' : 'Edit'}
            </Button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="transition-all duration-300 ease-in-out">
        {isEditing ? (
          <div className="[&_.w-md-editor]:border-0 [&_.w-md-editor]:shadow-none">
            <style jsx global>{`
              .w-md-editor {
                background-color: transparent !important;
              }
              .w-md-editor-text-container,
              .w-md-editor-text,
              .w-md-editor-text-textarea {
                background-color: hsl(var(--background)) !important;
                color: hsl(var(--foreground)) !important;
                border: none !important;
              }
              .w-md-editor-bar {
                background-color: hsl(var(--muted)) !important;
                border-bottom: 1px solid hsl(var(--border)) !important;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
              }
              .w-md-editor-bar svg {
                color: hsl(var(--muted-foreground)) !important;
              }
              .w-md-editor-bar button:hover {
                background-color: hsl(var(--muted) / 0.8) !important;
              }
              .w-md-editor-bar button[data-active='true'] {
                background-color: hsl(var(--primary)) !important;
                color: hsl(var(--primary-foreground)) !important;
              }
              .w-md-editor-preview {
                background-color: hsl(var(--background)) !important;
                color: hsl(var(--foreground)) !important;
              }
            `}</style>
            <MDEditor
              value={markdownContent}
              onChange={handleContentChange}
              height={500}
              preview="edit"
              hideToolbar={false}
              visibleDragbar={false}
            />
          </div>
        ) : (
          <div className="p-6">
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={components}
              >
                {markdownContent || '*No content to display*'}
              </ReactMarkdown>
            </article>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownViewer;
