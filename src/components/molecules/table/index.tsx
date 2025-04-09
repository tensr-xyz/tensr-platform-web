import * as React from 'react';
import { cn } from '@/utils';
import { Resizable, ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { Input } from '@/components/atoms/input';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-xs', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'transition-colors data-[state=selected]:bg-muted', // Removed border-b
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'align-middle [&:has([role=checkbox])]:pr-0 border-r last:border-r-0 hover:bg-muted/50',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-xs text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export interface EditableCellRef {
  focus: () => void;
}

interface EditableCellProps {
  value: string | number | null;
  onEdit: (value: string) => void;
  className?: string;
  isFocused?: boolean;
  onFocus?: () => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

const EditableCell = React.forwardRef<EditableCellRef, EditableCellProps>(
  ({ value: initialValue, onEdit, className, isFocused, onFocus }, ref) => {
    const [value, setValue] = React.useState<string>(initialValue?.toString() ?? '');
    const [isEditing, setIsEditing] = React.useState(false);
    const divRef = React.useRef<HTMLDivElement>(null);

    React.useImperativeHandle(ref, () => ({
      focus: () => {
        divRef.current?.focus();
        setIsEditing(true);
      },
    }));

    // Handle Tab key in the cell itself to prevent default browser behavior
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault(); // This is crucial
        return;
      }

      if (isEditing) {
        if (e.key === 'Enter') {
          setIsEditing(false);
          if (value !== initialValue?.toString()) {
            onEdit(value);
          }
          e.preventDefault();
        } else if (e.key === 'Escape') {
          setValue(initialValue?.toString() ?? '');
          setIsEditing(false);
          e.preventDefault();
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        setIsEditing(true);
        e.preventDefault();
      }
    };

    // Focus handling
    React.useEffect(() => {
      if (isFocused && divRef.current) {
        divRef.current.focus();
      }
    }, [isFocused]);

    if (isEditing) {
      return (
        <div
          className={cn(isFocused && ['outline outline-2 outline-primary', 'relative z-10'])}
          style={{
            outlineOffset: isFocused ? '-2px' : undefined,
          }}
        >
          <Input
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => {
              setIsEditing(false);
              if (value !== initialValue?.toString()) {
                onEdit(value);
              }
            }}
            onKeyDown={handleKeyDown}
            variant="ghost"
            className={cn(
              'h-7 w-full text-xs',
              'align-middle [&:has([role=checkbox])]:pr-0',
              className
            )}
            autoFocus
          />
        </div>
      );
    }

    const mergeRefs = <T extends any>(
      refs: Array<React.MutableRefObject<T> | React.LegacyRef<T> | null | undefined>
    ): React.RefCallback<T> => {
      return value => {
        refs.forEach(ref => {
          if (typeof ref === 'function') {
            ref(value);
          } else if (ref !== null && ref !== undefined) {
            (ref as React.MutableRefObject<T | null>).current = value;
          }
        });
      };
    };

    const setRefs = React.useCallback(mergeRefs([ref, divRef]), [ref]);

    return (
      <div
        ref={setRefs}
        role="textbox"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={e => {
          e.preventDefault();
          onFocus?.();
        }}
        onFocus={e => {
          e.preventDefault();
          onFocus?.();
        }}
        onDoubleClick={() => setIsEditing(true)}
        className={cn(
          'py-1 w-full h-full',
          'flex items-center',
          'truncate outline-none',
          isFocused && ['outline outline-2 outline-primary', 'relative z-10'],
          className
        )}
        style={{
          outlineOffset: isFocused ? '-2px' : undefined,
        }}
      >
        <span className="truncate">{value}</span>
      </div>
    );
  }
);

EditableCell.displayName = 'EditableCell';

interface ResizableCellProps {
  width: number;
  height?: number;
  onResize: (width: number) => void;
  children: React.ReactNode;
  className?: string;
}

const ResizableCell = React.forwardRef<HTMLDivElement, ResizableCellProps>(
  ({ width, height = 28, onResize, children, className }, ref) => {
    const handleResize = (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
      onResize(size.width);
    };

    return (
      <Resizable
        width={width}
        height={height}
        onResize={handleResize}
        draggableOpts={{ enableUserSelectHack: false }}
        handle={
          <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50" />
        }
      >
        <div ref={ref} className={cn('relative', className)}>
          {children}
        </div>
      </Resizable>
    );
  }
);
ResizableCell.displayName = 'ResizableCell';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  EditableCell,
  ResizableCell,
  type EditableCellProps,
  type ResizableCellProps,
};
