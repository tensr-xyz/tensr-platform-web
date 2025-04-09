'use client';

import { useEffect, useState } from 'react';

// Default breakpoint for mobile devices (768px matches the md: breakpoint in Tailwind)
const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  // Initialize with null to avoid hydration mismatch
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    // Function to check if window width is less than breakpoint
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Run initial check
    checkMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [breakpoint]);

  // Return false during SSR to match the desktop-first approach
  return isMobile ?? false;
}
