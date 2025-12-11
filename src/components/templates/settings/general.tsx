'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { useAuthStore } from '@/stores/auth-store';
import { getAccessToken } from '@/utils/auth';
import { User } from '@/types/user';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { Separator } from '@/components/atoms/separator';
import { Save, User as UserIcon, Mail, AtSign, Sun, Monitor, Moon } from 'lucide-react';

interface ApiError {
  message: string;
  code: string;
  errors?: string[];
}

export default function GeneralSettings() {
  const { user: contextUser, isLoading: authLoading } = useAuthStore();
  const { theme, setTheme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [mounted, setMounted] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Ensure component doesn't render until mounted to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize user state from context
  useEffect(() => {
    if (contextUser) {
      setUser(contextUser);
      setOriginalUser(contextUser);
    }
  }, [contextUser]);

  const updateUser = async (updates: Partial<User>): Promise<User> => {
    const token = getAccessToken();

    if (!token) {
      throw new Error('No authentication token found');
    }

    if (!user?.userId) {
      throw new Error('User ID not available');
    }

    if (!API_BASE_URL) {
      throw new Error('API base URL not configured');
    }

    const response = await fetch(`${API_BASE_URL}/users/${user.userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json();
      throw new Error(errorData.message || 'Failed to update user');
    }

    return response.json();
  };

  const hasChanges = (): boolean => {
    if (!user || !originalUser) return false;

    return (
      user.firstName !== originalUser.firstName ||
      user.lastName !== originalUser.lastName ||
      user.username !== originalUser.username
    );
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !originalUser || !hasChanges()) {
      return;
    }

    try {
      setSaveStatus('saving');

      // Prepare the updates - only send changed fields
      const updates: Partial<User> = {};

      if (user.firstName !== originalUser.firstName) {
        updates.firstName = user.firstName;
      }
      if (user.lastName !== originalUser.lastName) {
        updates.lastName = user.lastName;
      }
      if (user.username !== originalUser.username) {
        updates.username = user.username;
      }

      const updatedUser = await updateUser(updates);

      // Update both local state and context
      setUser(updatedUser);
      setOriginalUser(updatedUser);
      setSaveStatus('success');

      // Show success toast - using console for now as toast is not imported
      console.log('Profile updated successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setSaveStatus('error');

      // Show error toast - using console for now as toast is not imported
      console.error('Failed to update profile:', errorMessage);
    }
  };

  const handleInputChange = (field: keyof User, value: string) => {
    if (!user) return;

    setUser(prev =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : null
    );

    // Clear error status when user starts typing
    if (saveStatus === 'error') {
      setSaveStatus('idle');
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleRetry = () => {
    window.location.reload();
  };

  // Show loading state while auth is loading or not mounted
  if (authLoading || !mounted) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  // Show error if no user is available from context
  if (!contextUser) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Error Loading Settings</h3>
          <p className="text-sm text-red-600 mt-1">
            Unable to load user information. Please try logging in again.
          </p>
          <button
            onClick={handleRetry}
            className="mt-3 text-sm text-red-600 underline hover:text-red-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-xl font-medium">General Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and display preferences</p>
      </div>

      {/* Account Information Section */}
      <div className="border border-gray-200 rounded-md overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Account Information</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Update your personal details
          </p>
        </div>

        <form onSubmit={handleProfileUpdate}>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  First Name
                </label>
                <Input
                  type="text"
                  id="firstName"
                  value={user?.firstName || ''}
                  onChange={e => handleInputChange('firstName', e.target.value)}
                  className="border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-600"
                  disabled={saveStatus === 'saving'}
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Last Name
                </label>
                <Input
                  type="text"
                  id="lastName"
                  value={user?.lastName || ''}
                  onChange={e => handleInputChange('lastName', e.target.value)}
                  className="border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-600"
                  disabled={saveStatus === 'saving'}
                />
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email Address
              </label>
              <Input
                type="email"
                id="email"
                value={user?.email || ''}
                readOnly
                className="bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                To change your email, please contact support.
              </p>
            </div>

            <div className="mb-6">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Username
              </label>
              <Input
                type="text"
                id="username"
                value={user?.username || ''}
                onChange={e => handleInputChange('username', e.target.value)}
                className="border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-600"
                disabled={saveStatus === 'saving'}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {hasChanges() && 'You have unsaved changes'}
            </div>

            <Button
              type="submit"
              disabled={saveStatus === 'saving' || !hasChanges()}
              className="bg-black hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Theme Settings Section */}
      <div className="border border-gray-200 rounded-md overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Display Preferences</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose your preferred theme
          </p>
        </div>

        <div className="p-6">
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
            {/* Light Theme Option */}
            <div
              className={`flex items-center p-3 rounded-md cursor-pointer border transition-colors ${
                theme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
              }`}
              onClick={() => handleThemeChange('light')}
            >
              <div className="mr-3">
                <div
                  className={`h-4 w-4 rounded-full border ${
                    theme === 'light'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {theme === 'light' && <div className="h-2 w-2 rounded-full bg-white m-0.5"></div>}
                </div>
              </div>
              <div className="flex items-center">
                <Sun className="h-4 w-4 text-yellow-500 mr-2" />
                <span className="text-sm text-gray-900 dark:text-white">Light</span>
              </div>
            </div>

            {/* System Theme Option */}
            <div
              className={`flex items-center p-3 rounded-md cursor-pointer border transition-colors ${
                theme === 'system'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
              }`}
              onClick={() => handleThemeChange('system')}
            >
              <div className="mr-3">
                <div
                  className={`h-4 w-4 rounded-full border ${
                    theme === 'system'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {theme === 'system' && (
                    <div className="h-2 w-2 rounded-full bg-white m-0.5"></div>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <Monitor className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-sm text-gray-900 dark:text-white">System</span>
              </div>
            </div>

            {/* Dark Theme Option */}
            <div
              className={`flex items-center p-3 rounded-md cursor-pointer border transition-colors ${
                theme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
              }`}
              onClick={() => handleThemeChange('dark')}
            >
              <div className="mr-3">
                <div
                  className={`h-4 w-4 rounded-full border ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {theme === 'dark' && <div className="h-2 w-2 rounded-full bg-white m-0.5"></div>}
                </div>
              </div>
              <div className="flex items-center">
                <Moon className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-sm text-gray-900 dark:text-white">Dark</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
