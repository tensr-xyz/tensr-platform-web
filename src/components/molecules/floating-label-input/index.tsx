'use client';
import { cn } from '@/utils';
import * as React from 'react';

export interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  containerClassName?: string;
  labelClassName?: string;
  focusedLabelClassName?: string;
  inputClassName?: string;
}

const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  (
    {
      className,
      type,
      label,
      containerClassName,
      labelClassName,
      focusedLabelClassName,
      inputClassName,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(
      value !== undefined
        ? String(value) !== ''
        : defaultValue !== undefined
          ? String(defaultValue) !== ''
          : false
    );
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Effect to update hasValue when the value prop changes
    React.useEffect(() => {
      if (value !== undefined) {
        setHasValue(String(value) !== '');
      }
    }, [value]);

    // Effect to check initial value from inputRef after mount
    React.useEffect(() => {
      if (inputRef.current) {
        setHasValue(inputRef.current.value !== '');
      }
    }, []);

    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(e.target.value !== '');
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value !== '');
      props.onChange?.(e);
    };

    const handleContainerClick = () => {
      inputRef.current?.focus();
    };

    return (
      <div
        className={cn('relative h-16 w-full cursor-text group', containerClassName)}
        onClick={handleContainerClick}
      >
        <input
          type={type}
          className={cn(
            'peer w-full h-full px-4 pt-6 pb-2 text-gray-700 bg-background border rounded-sm',
            'border-input hover:border-foreground',
            'focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-transparent',
            inputClassName,
            className
          )}
          ref={inputRef}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          {...props}
        />
        <label
          className={cn(
            'absolute left-4 transition-all duration-200 pointer-events-none',
            isFocused || hasValue ? 'top-2 text-xs' : 'top-5 text-base',
            isFocused
              ? cn('text-primary', focusedLabelClassName)
              : cn('text-muted-foreground', labelClassName)
          )}
        >
          {label}
        </label>
      </div>
    );
  }
);
FloatingLabelInput.displayName = 'FloatingLabelInput';

export { FloatingLabelInput };
