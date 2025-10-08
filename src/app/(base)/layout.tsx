'use client';

import Footer from '@/components/organisms/base-footer';
import { AppSidebar } from '@/components/organisms/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/organisms/sidebar';
import { X, Zap } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/atoms/button';

export default function BaseLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showBanner, setShowBanner] = useState(true);

  return (
    <SidebarProvider>
      <AppSidebar variant="sidebar" />
      <SidebarInset>
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
          {showBanner && (
            <div className="relative flex items-center justify-center gap-2 md:gap-4 p-4 md:h-12 bg-[#C7BEFC] border-y border-black">
              <div className="flex flex-col md:flex-row gap-0 md:gap-2 text-sm md:text-base font-medium text-center md:text-left">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="size-5 md:size-6 flex-shrink-0" />
                  <div className="font-semibold">Welcome to our beta!</div>
                </div>
                <div>
                  You may encounter features under development as we enhance the platform. Your
                  feedback helps us improve.
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowBanner(false)}
                className="absolute top-2 right-2 md:top-1/2 md:-translate-y-1/2 md:right-4 flex-shrink-0 hover:bg-[#C7BEFC]"
              >
                <X />
              </Button>
            </div>
          )}
          <main className="p-10 w-full max-w-full overflow-hidden">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
