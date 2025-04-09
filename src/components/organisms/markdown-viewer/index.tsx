import { useEffect, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownViewerProps {
  filePath: string;
}

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const MarkdownViewer = ({ filePath }: MarkdownViewerProps) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const fileContent = {};
        // const fileContent = await invoke<string>('read_file', { path: filePath });
        setContent(fileContent);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
        setError(errorMessage);
      }
    };

    loadContent();
  }, [filePath]);

  if (error) {
    return <div className="p-4 text-red-500">Error loading file: {error}</div>;
  }

  const components: Components = {
    h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
    p: ({ children }) => {
      if (typeof children === 'string' && children.trim().startsWith('<svg')) {
        return (
          <div className="my-4">
            <div
              dangerouslySetInnerHTML={{ __html: children.trim() }}
              className="w-full flex justify-center"
            />
          </div>
        );
      }
      return <p className="mb-4">{children}</p>;
    },
    ul: ({ children }) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
    li: ({ children }) => <li className="mb-1">{children}</li>,
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 mb-4">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>,
    tr: ({ children }) => <tr className="border-b border-gray-300">{children}</tr>,
    th: ({ children }) => <th className="p-2 text-left border-r border-gray-300">{children}</th>,
    td: ({ children }) => <td className="p-2 border-r border-gray-300">{children}</td>,
    code: ({ inline, className, children }: CodeProps) => {
      if (
        className === 'language-svg' ||
        className?.includes('svg') ||
        (typeof children === 'string' && children.trim().startsWith('<svg'))
      ) {
        return (
          <div className="my-4">
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
        return (
          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">
            {children}
          </code>
        );
      }
      return (
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4">
          <code className="text-sm">{children}</code>
        </pre>
      );
    },
    img: ({ src, alt }) => <img alt={alt} src={src} className="max-w-full h-auto rounded my-4" />,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4">{children}</blockquote>
    ),
    hr: () => <hr className="my-8 border-t border-gray-300" />,
    svg: ({ children, ...props }) => (
      <div className="my-4 flex justify-center overflow-x-auto w-full">
        <svg {...props} className="w-full">
          {children}
        </svg>
      </div>
    ),
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
};

export default MarkdownViewer;
