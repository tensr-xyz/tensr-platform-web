'use client';

import * as React from 'react';
import Link from 'next/link';
import { Input } from '@/components/atoms/input';
import { Search } from 'lucide-react';
import { Button } from '@/components/atoms/button';

// This is sample data.
const data = {
  versions: ['1.0.1', '1.1.0-alpha', '2.0.0-beta1'],
  navMain: [
    {
      title: 'Account',
      url: '/settings/account',
    },
    {
      title: 'Billing',
      url: '/settings/billing',
    },
    // {
    //   title: 'Organisation',
    //   url: '/settings/organisation',
    // },
    // {
    //   title: 'Members',
    //   url: '/settings/members',
    // },
    // {
    //   title: 'Teams',
    //   url: '/settings/teams',
    // },
  ],
};

export function SettingsSidebar() {
  const [activeItem, setActiveItem] = React.useState(data.navMain[0].title);

  return (
    <div className="w-xs border-gray-200">
      <div className="flex flex-col gap-12 mb-8">
        <div className="relative flex items-center">
          <Input
            className="bg-background pl-10" // Add left padding to make room for the icon
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search size={18} />
          </div>
        </div>
        <nav className="space-y-1">
          {data.navMain.map(item => (
            <Link
              key={item.title}
              href={item.url}
              onClick={() => {
                setActiveItem(item.title);
              }}
              className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeItem === item.title
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-6">
        <Button variant="outline" className="bg-background w-full">
          Log out
        </Button>
      </div>
    </div>
  );
}
