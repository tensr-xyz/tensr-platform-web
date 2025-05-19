'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Input } from '@/components/atoms/input';
import { Search } from 'lucide-react';
import { Button } from '@/components/atoms/button';

// This is sample data
const navigationItems = [
  {
    title: 'Team',
    items: [
      {
        title: 'General',
        url: '/settings/general',
      },
      {
        title: 'Billing',
        url: '/settings/billing',
      },
      {
        title: 'Organisation',
        url: '/settings/organisation',
      },
      {
        title: 'Members',
        url: '/settings/members',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        title: 'Account',
        url: '/settings/account',
      },
    ],
  },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-full md:w-60 flex-shrink-0">
      <div className="flex flex-col gap-8 mb-8">
        <div className="relative flex items-center">
          <Input
            placeholder="Search..."
            className="bg-white pl-10 h-10 border border-gray-200" // Add left padding for the icon
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </div>
        </div>

        <div className="space-y-8">
          {navigationItems.map(section => (
            <div key={section.title} className="space-y-2">
              <div className="text-xs text-gray-500 font-medium pl-3">{section.title}</div>

              <nav className="space-y-1">
                {section.items.map(item => {
                  const isActive = pathname === item.url;
                  return (
                    <Link
                      key={item.title}
                      href={item.url}
                      className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                        isActive ? 'font-medium text-black' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-6">
        <Button
          variant="outline"
          className="w-full bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:text-gray-900"
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
