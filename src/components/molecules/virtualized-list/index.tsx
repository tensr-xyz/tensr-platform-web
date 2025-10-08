import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState, useEffect } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  className?: string;
  containerHeight?: number;
  overscan?: number;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  className = '',
  containerHeight = 400,
  overscan = 5,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (parentRef.current) {
      setContainerWidth(parentRef.current.offsetWidth);
    }
  }, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        style={{
          height: `${totalHeight}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${itemHeight}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Specialized virtualized components
export function VirtualizedFilesList({
  files,
  renderFile,
}: {
  files: any[];
  renderFile: (file: any, index: number) => React.ReactNode;
}) {
  return (
    <VirtualizedList
      items={files}
      renderItem={renderFile}
      itemHeight={80}
      containerHeight={600}
      className="border rounded-lg"
    />
  );
}

export function VirtualizedProjectsList({
  projects,
  renderProject,
}: {
  projects: any[];
  renderProject: (project: any, index: number) => React.ReactNode;
}) {
  return (
    <VirtualizedList
      items={projects}
      renderItem={renderProject}
      itemHeight={120}
      containerHeight={500}
      className="border rounded-lg"
    />
  );
}
