import * as React from 'react';
import { cn } from '@/utils';
import { Resizable, ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { Input } from '@/components/atoms/input';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b border-border', className)} {...props} />
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
    className={cn(
      'border-t  border-border bg-muted/50 font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
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
      'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
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
      'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
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
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export interface EditableCellRef {
  focus: () => void;
}

interface EditableCellProps {
  value: string | number | null;
  onEdit: (value: string) => void;
  className?: string;
  inputClassName?: string;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onKeyDown?: (
    e: React.KeyboardEvent<HTMLDivElement | HTMLInputElement | HTMLTextAreaElement>
  ) => void;
}

const EditableCell = React.forwardRef<EditableCellRef, EditableCellProps>(
  (
    {
      value: initialValue,
      onEdit,
      className,
      inputClassName,
      isFocused,
      onFocus,
      onBlur,
      onNavigate,
      onKeyDown,
    },
    ref
  ) => {
    const [value, setValue] = React.useState<string>(initialValue?.toString() ?? '');
    const [isEditing, setIsEditing] = React.useState(false);
    const [isMultiline, setIsMultiline] = React.useState(false);
    const divRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Update local value when prop changes
    React.useEffect(() => {
      setValue(initialValue?.toString() ?? '');
    }, [initialValue]);

    React.useImperativeHandle(ref, () => ({
      focus: () => {
        // When focusing programmatically, enter edit mode
        setIsEditing(true);

        // Use requestAnimationFrame to ensure the DOM is updated
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
          } else if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          } else if (divRef.current) {
            divRef.current.focus();
          }
        });
      },
    }));

    const handleKeyDown = (
      e: React.KeyboardEvent<HTMLDivElement | HTMLInputElement | HTMLTextAreaElement>
    ) => {
      if (onKeyDown) {
        onKeyDown(e);

        if (e.defaultPrevented) {
          return;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault(); // Prevent default tab behavior
        return;
      }

      if (isEditing) {
        if (e.key === 'Enter' && !e.altKey) {
          // Enter: Save and move down (unless Alt is held for new line)
          setIsEditing(false);
          if (value !== initialValue?.toString()) {
            onEdit(value);
          }
          onBlur?.();
          // Trigger navigation down after a brief delay to allow state to update
          if (onNavigate) {
            setTimeout(() => {
              onNavigate('down');
            }, 0);
          }
          e.preventDefault();
        } else if (e.key === 'Enter' && e.altKey) {
          // Alt+Enter: Insert newline (only for multiline mode)
          setIsMultiline(true);
          // Don't prevent default - allow textarea to handle it
        } else if (e.key === 'Escape') {
          setValue(initialValue?.toString() ?? '');
          setIsEditing(false);
          setIsMultiline(false);
          onBlur?.();
          e.preventDefault();
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        setIsEditing(true);
        e.preventDefault();
      }

      // Handle navigation if provided
      if (onNavigate && !isEditing) {
        if (e.key === 'ArrowUp') {
          onNavigate('up');
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          onNavigate('down');
          e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
          onNavigate('left');
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          onNavigate('right');
          e.preventDefault();
        }
      }
    };

    // When isFocused changes to true, focus the appropriate element
    React.useEffect(() => {
      if (isFocused) {
        if (isEditing) {
          if (isMultiline && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
          } else if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        } else if (divRef.current) {
          divRef.current.focus();
        }
      }
    }, [isFocused, isEditing, isMultiline]);

    return (
      <>
        {isEditing ? (
          <div
            className={cn(
              'relative z-10',
              isFocused && !inputClassName && 'outline outline-2 outline-primary',
              inputClassName // Apply custom input className if provided
            )}
            style={{
              outlineOffset: isFocused && !inputClassName ? '-2px' : undefined,
            }}
          >
            {isMultiline ? (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={() => {
                  setIsEditing(false);
                  setIsMultiline(false);
                  if (value !== initialValue?.toString()) {
                    onEdit(value);
                  }
                  onBlur?.();
                }}
                onKeyDown={handleKeyDown}
                className={cn(
                  'min-h-[28px] w-full text-xs resize-none',
                  'px-2 py-1 rounded-md border border-input bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'align-middle',
                  className
                )}
                autoFocus
                rows={Math.max(1, Math.min(5, value.split('\n').length))}
              />
            ) : (
              <Input
                ref={inputRef}
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={() => {
                  setIsEditing(false);
                  setIsMultiline(false);
                  if (value !== initialValue?.toString()) {
                    onEdit(value);
                  }
                  onBlur?.();
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
            )}
          </div>
        ) : (
          <div
            ref={divRef}
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
            onDoubleClick={() => {
              setIsEditing(true);
              // Focus and select input on next render
              requestAnimationFrame(() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                  inputRef.current.select();
                }
              });
            }}
            className={cn(
              'py-1 px-2 w-full h-full',
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
        )}
      </>
    );
  }
);

EditableCell.displayName = 'EditableCell';

// Memoize EditableCell to prevent unnecessary re-renders
// React Compiler will handle this automatically, but explicit memo helps with debugging
export const MemoizedEditableCell = React.memo(EditableCell);

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
