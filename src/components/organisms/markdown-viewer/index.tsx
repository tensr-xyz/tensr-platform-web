import { useEffect, useState, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import Loading from '@/components/molecules/loading';
import { Button } from '@/components/atoms/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/molecules/accordion';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/atoms/collapsible';
import { ChevronRight, ChevronDown, Info, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

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

  // Parse markdown for interactive elements
  const parseInteractiveContent = (content: string) => {
    // Support collapsible sections with <!--collapse:title--> syntax
    const collapseRegex = /<!--collapse:([^>]+)-->\n([\s\S]*?)(?=<!--\/collapse-->|$)/g;
    // Support accordion sections
    const accordionRegex = /<!--accordion:([^>]+)-->\n([\s\S]*?)(?=<!--\/accordion-->|$)/g;
    // Support expandable details
    const detailsRegex = /<!--details:([^>]+)-->\n([\s\S]*?)(?=<!--\/details-->|$)/g;

    return content;
  };

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-3xl font-bold mb-6 pb-2 border-b border-border">{children}</h1>
    ),
    h2: ({ children, ...props }) => {
      // Check if this is a collapsible section header
      const isCollapsible = typeof children === 'string' && children.includes('[+]');
      const title =
        typeof children === 'string' ? children.replace(/\[\+\]/g, '').trim() : children;

      if (isCollapsible) {
        return (
          <Collapsible className="mt-8 mb-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-2xl font-semibold pb-1 hover:text-primary transition-colors">
              <ChevronRight className="h-5 w-5 transition-transform group-data-[state=open]:rotate-90" />
              {title}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {/* Content will be in next elements */}
            </CollapsibleContent>
          </Collapsible>
        );
      }
      return (
        <h2 className="text-2xl font-semibold mt-8 mb-4 pb-1 border-b border-border/50">
          {children}
        </h2>
      );
    },
    h3: ({ children }) => {
      const isCollapsible = typeof children === 'string' && children.includes('[+]');
      const title =
        typeof children === 'string' ? children.replace(/\[\+\]/g, '').trim() : children;

      if (isCollapsible) {
        return (
          <Collapsible className="mt-6 mb-3">
            <CollapsibleTrigger className="flex items-center gap-2 text-xl font-medium hover:text-primary transition-colors">
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
              {title}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {/* Content will be in next elements */}
            </CollapsibleContent>
          </Collapsible>
        );
      }
      return <h3 className="text-xl font-medium mt-6 mb-3">{children}</h3>;
    },
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
    table: ({ children, ...props }) => {
      // Check if table should be interactive (has data-interactive attribute)
      const isInteractive = (props as Record<string, unknown>)['data-interactive'] === 'true';

      if (isInteractive) {
        return (
          <div className="overflow-x-auto my-6 border border-border rounded-lg">
            <div className="bg-muted/30 p-2 text-xs text-muted-foreground">
              Interactive table - Click column headers to sort
            </div>
            <table className="min-w-full border-collapse">{children}</table>
          </div>
        );
      }

      return (
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse border border-border rounded-lg overflow-hidden shadow-sm">
            {children}
          </table>
        </div>
      );
    },
    thead: ({ children }) => (
      <thead className="bg-muted border-b-2 border-border">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-border hover:bg-muted/30 transition-colors">{children}</tr>
    ),
    th: ({ children, ...props }) => {
      const isSortable = (props as Record<string, unknown>)['data-sortable'] === 'true';

      if (isSortable) {
        // For sortable columns, we'll use a client component wrapper
        return (
          <th
            className="p-3 text-left font-semibold border-r border-border first:rounded-tl-lg last:rounded-tr-lg cursor-pointer select-none hover:bg-muted/70 transition-colors"
            data-sortable="true"
          >
            <div className="flex items-center gap-2">{children}</div>
          </th>
        );
      }

      return (
        <th className="p-3 text-left font-semibold border-r border-border first:rounded-tl-lg last:rounded-tr-lg">
          {children}
        </th>
      );
    },
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
    blockquote: ({ children, ...props }) => {
      const type = (props as Record<string, unknown>)['data-type'] as string;
      const iconMap = {
        info: <Info className="h-5 w-5 text-blue-500" />,
        warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
        success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        error: <XCircle className="h-5 w-5 text-red-500" />,
      };
      const icon = type ? iconMap[type as keyof typeof iconMap] : null;
      const bgColorMap = {
        info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
        warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
        success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
        error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
      };
      const bgColor = type
        ? bgColorMap[type as keyof typeof bgColorMap]
        : 'bg-muted/30 border-primary';

      return (
        <blockquote
          className={`border-l-4 pl-4 my-6 py-3 rounded-r ${bgColor} flex items-start gap-3`}
        >
          {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
          <div className="flex-1">{children}</div>
        </blockquote>
      );
    },
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
    // Support HTML details/summary for collapsible sections
    details: ({ children, ...props }) => {
      const isOpen = props.open !== undefined;
      return (
        <details className="my-4 border border-border rounded-lg overflow-hidden" open={isOpen}>
          {children}
        </details>
      );
    },
    summary: ({ children }) => (
      <summary className="p-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-2 list-none">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {children}
      </summary>
    ),
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
          <div className="p-8 max-w-4xl mx-auto">
            <style jsx global>{`
              details summary {
                list-style: none;
              }
              details summary::-webkit-details-marker {
                display: none;
              }
              details[open] summary svg {
                transform: rotate(90deg);
              }
              details summary svg {
                transition: transform 0.2s ease;
              }
              /* APA 7 Style Typography */
              .apa-report {
                font-family: 'Times New Roman', Times, serif;
                line-height: 1.5;
                color: #000;
              }
              .apa-report h1 {
                font-size: 18pt;
                font-weight: bold;
                text-align: center;
                margin-bottom: 12pt;
              }
              .apa-report h2 {
                font-size: 16pt;
                font-weight: bold;
                margin-top: 12pt;
                margin-bottom: 6pt;
              }
              .apa-report h3 {
                font-size: 14pt;
                font-weight: bold;
                margin-top: 10pt;
                margin-bottom: 4pt;
              }
              .apa-report p {
                margin-bottom: 6pt;
                text-align: justify;
              }
              .apa-report table {
                border-collapse: collapse;
                width: 100%;
                margin: 12pt 0;
                border: 1px solid #e5e7eb;
              }
              .apa-report table th,
              .apa-report table td {
                border: 1px solid #e5e7eb;
                padding: 8px 12px;
                text-align: left;
              }
              .apa-report table th {
                background-color: #f9fafb;
                font-weight: 600;
                border-bottom: 2px solid #e5e7eb;
              }
              .apa-report table td:first-child {
                font-weight: 500;
              }
              .apa-report table tr:nth-child(even) {
                background-color: #f9fafb;
              }
              .apa-report table tr:hover {
                background-color: #f3f4f6;
              }
              .apa-report table caption {
                font-weight: bold;
                margin-bottom: 6pt;
                text-align: left;
              }
              .apa-report figure {
                margin: 12pt 0;
                text-align: center;
              }
              .apa-report figure figcaption {
                margin-top: 6pt;
                font-size: 10pt;
                text-align: left;
              }
            `}</style>
            <article className="apa-report prose prose-sm max-w-none">
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
