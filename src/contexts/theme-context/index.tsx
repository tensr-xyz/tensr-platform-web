'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      {...props}
      themes={['light', 'dark', 'system']}
      enableSystem
      disableTransitionOnChange
      attribute="class"
      defaultTheme="light"
    >
      {children}
    </NextThemesProvider>
  );
}

// Custom hook that prevents hydration mismatches
export function useTheme() {
  const [mounted, setMounted] = React.useState(false);
  const theme = useNextTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Return default values during SSR to prevent hydration mismatch
  if (!mounted) {
    return {
      theme: 'system',
      setTheme: () => null,
      resolvedTheme: 'light',
      systemTheme: 'light',
    };
  }

  return theme;
}
