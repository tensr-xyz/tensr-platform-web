import React from 'react';
import { SettingsNav } from '@/components/templates/settings/settings-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 sm:px-0">
      <div className="w-full pt-10 text-center">
        <h1 className="font-normal text-xl tracking-tighter md:text-3xl">Settings</h1>
      </div>
      <SettingsNav className="w-full justify-center" />
      <div className="mt-8 w-full">{children}</div>
    </div>
  );
}
