'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Input } from '@/components/atoms/input';
import { Search, Menu, X } from 'lucide-react';
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
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  // Close mobile menu when route changes
  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Get current page title for mobile header
  const getCurrentPageTitle = () => {
    for (const section of navigationItems) {
      const currentItem = section.items.find(item => item.url === pathname);
      if (currentItem) return currentItem.title;
    }
    return 'Settings';
  };

  return (
    <>
      {/* Mobile Menu Button - Only visible on mobile */}
      <div className="md:hidden flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">{getCurrentPageTitle()}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2"
        >
          <Menu size={16} />
          Menu
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        ${isOpen ? 'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-lg' : 'hidden'}
        md:block md:relative md:w-60 md:shadow-none md:bg-transparent
        flex-shrink-0
      `}
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium">Settings Menu</h2>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="p-4 md:p-0">
          <div className="flex flex-col gap-6 md:gap-8 mb-6 md:mb-8">
            {/* Search - Hidden on mobile by default, can be shown if needed */}
            <div className="hidden md:block relative flex items-center">
              <Input
                placeholder="Search..."
                className="bg-white pl-10 h-10 border border-gray-200"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={18} />
              </div>
            </div>

            {/* Navigation */}
            <div className="space-y-6 md:space-y-8">
              {navigationItems.map(section => (
                <div key={section.title} className="space-y-2">
                  <div className="text-xs text-gray-500 font-medium pl-3 uppercase tracking-wider">
                    {section.title}
                  </div>

                  <nav className="space-y-1">
                    {section.items.map(item => {
                      const isActive = pathname === item.url;
                      return (
                        <Link
                          key={item.title}
                          href={item.url}
                          className={`block px-3 py-2.5 md:py-1.5 text-sm rounded-md transition-colors ${
                            isActive
                              ? 'font-medium text-black bg-gray-100'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                          onClick={() => setIsOpen(false)} // Close mobile menu on selection
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

          {/* Logout Button */}
          <div className="border-t border-gray-200 pt-4 mt-6">
            <Button
              variant="outline"
              className="w-full bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:text-gray-900"
            >
              Log out
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
