import React from 'react';
import { SettingsSidebar } from '@/components/templates/settings/settings-sidebar';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col mb-4 md:mb-8">
      {/* Header - responsive padding */}
      <div className="px-4 py-6 md:p-12 border-b border-border hidden md:block">
        <h1 className="text-2xl md:text-3xl font-medium">Settings</h1>
      </div>

      {/* Main content - responsive layout */}
      <div className="flex flex-col md:flex-row flex-1 px-4 py-6 md:px-12 md:py-12 gap-6 md:gap-16">
        <SettingsSidebar />
        <div className="flex-1 max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
