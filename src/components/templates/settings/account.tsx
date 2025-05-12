'use client';

import { useState } from 'react';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';

// Mock user data
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

export default function Account() {
  const [user, setUser] = useState(userData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaveStatus('saving');
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to update profile', err);
      setSaveStatus('error');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Account Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your personal information</p>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        <form onSubmit={handleProfileUpdate}>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <Input
                  type="text"
                  id="firstName"
                  value={user.firstName || ''}
                  onChange={e => setUser({ ...user, firstName: e.target.value })}
                  className="border-gray-200 bg-white"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <Input
                  type="text"
                  id="lastName"
                  value={user.lastName || ''}
                  onChange={e => setUser({ ...user, lastName: e.target.value })}
                  className="border-gray-200 bg-white"
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                id="email"
                value={user.email}
                readOnly
                className="bg-gray-50 border-gray-200"
              />
              <p className="mt-1 text-xs text-gray-500">
                To change your email, please contact support.
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <Input
                type="text"
                id="username"
                value={user.username || ''}
                onChange={e => setUser({ ...user, username: e.target.value })}
                className="border-gray-200 bg-white"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
            <Button
              type="submit"
              disabled={saveStatus === 'saving'}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </Button>

            {saveStatus === 'success' && (
              <span className="ml-3 text-sm text-green-600 flex items-center">
                Changes saved successfully!
              </span>
            )}

            {saveStatus === 'error' && (
              <span className="ml-3 text-sm text-red-600 flex items-center">
                Failed to save changes. Please try again.
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
