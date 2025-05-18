'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';

// Mock user data for maintaining the original structure
const userData = {
  userId: 'abc123',
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  username: 'johndoe',
  subscriptionTier: 'PROFESSIONAL',
  subscriptionStatus: 'ACTIVE',
  subscriptionEndsAt: '2025-12-31T23:59:59Z',
  lastLoginAt: '2025-04-17T15:30:22Z',
  lastActiveAt: '2025-04-18T09:15:45Z',
  currentVersion: '1.2.3',
  preferences: {
    theme: 'LIGHT',
    notifications: true,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2025-03-15T00:00:00Z',
  status: 'ACTIVE',
};

export default function GeneralTemplate() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(userData);

  // Ensure component doesn't render until mounted to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Set theme and update user preferences
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    // Update user preferences to match theme choice
    setUser({
      ...user,
      preferences: {
        ...user.preferences,
        theme: newTheme.toUpperCase(),
      },
    });
  };

  if (!mounted) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Theme Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your display preferences</p>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Theme Preference
            </h2>

            <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
              {/* Light Theme Option */}
              <div
                className={`flex items-center p-3 rounded-md cursor-pointer border ${
                  theme === 'light'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                }`}
                onClick={() => handleThemeChange('light')}
              >
                <div className="mr-3">
                  <div
                    className={`h-4 w-4 rounded-full border ${
                      theme === 'light' ? 'border-primary bg-primary' : 'border-gray-300'
                    }`}
                  >
                    {theme === 'light' && (
                      <div className="h-2 w-2 rounded-full bg-white m-0.5"></div>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <Sun className="h-4 w-4 text-yellow-500 mr-2" />
                  <span className="text-sm">Light</span>
                </div>
              </div>

              {/* Minimal Theme Option */}
              <div
                className={`flex items-center p-3 rounded-md cursor-pointer border ${
                  theme === 'minimal'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                }`}
                onClick={() => handleThemeChange('minimal')}
              >
                <div className="mr-3">
                  <div
                    className={`h-4 w-4 rounded-full border ${
                      theme === 'minimal' ? 'border-primary bg-primary' : 'border-gray-300'
                    }`}
                  >
                    {theme === 'minimal' && (
                      <div className="h-2 w-2 rounded-full bg-white m-0.5"></div>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <Monitor className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm">Minimal</span>
                </div>
              </div>

              {/* Dark Theme Option */}
              <div
                className={`flex items-center p-3 rounded-md cursor-pointer border ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                }`}
                onClick={() => handleThemeChange('dark')}
              >
                <div className="mr-3">
                  <div
                    className={`h-4 w-4 rounded-full border ${
                      theme === 'dark' ? 'border-primary bg-primary' : 'border-gray-300'
                    }`}
                  >
                    {theme === 'dark' && (
                      <div className="h-2 w-2 rounded-full bg-white m-0.5"></div>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <Moon className="h-4 w-4 text-blue-500 mr-2" />
                  <span className="text-sm">Dark</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
