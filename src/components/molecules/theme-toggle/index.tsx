'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('size-8 shrink-0', className)}
        disabled
        aria-hidden
      >
        <Sun className="size-[18px] opacity-0" />
      </Button>
    );
  }

  const active = theme ?? 'system';
  const darkish = resolvedTheme === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-8 shrink-0 text-muted-foreground hover:text-foreground', className)}
          aria-label="Theme"
        >
          <Sun className={cn('size-[18px]', darkish && 'hidden')} />
          <Moon className={cn('hidden size-[18px]', darkish && 'inline')} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={active} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="text-xs">
            <Sun className="mr-2 size-4 opacity-70" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="text-xs">
            <Moon className="mr-2 size-4 opacity-70" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="text-xs">
            <Monitor className="mr-2 size-4 opacity-70" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
