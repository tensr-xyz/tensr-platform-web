import React from 'react';
import { SettingsSidebar } from '@/components/templates/settings/settings-sidebar';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col mb-8">
      <div className="p-12 border-b border-border">
        <h1 className="text-3xl font-medium">Settings</h1>
      </div>
      <div className="flex flex-row flex-1 px-12 py-12 gap-16">
        <SettingsSidebar />
        <div className="flex-1 max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
