'use client';

import { useState } from 'react';

export default function Organisation() {
  const [org, setOrg] = useState<Organisation | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-gray-500">Manage your organization details and members</p>
      </div>

      {/* Organization Details */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <form>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">General</h2>

            <div className="mb-6">
              <div className="flex items-center mb-4">
                {org?.logoUrl ? (
                  <img src={org.logoUrl} alt={org.name} className="w-16 h-16 rounded-md mr-4" />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center mr-4">
                    <span className="text-2xl">{org?.name.charAt(0)}</span>
                  </div>
                )}
                <button className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                  Change Logo
                </button>
              </div>

              <div className="mb-4">
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  id="orgName"
                  value={org?.name || ''}
                  onChange={e => setOrg(org ? { ...org, name: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="orgSlug" className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    yourapp.com/
                  </span>
                  <input
                    type="text"
                    id="orgSlug"
                    value={org?.slug || ''}
                    onChange={e => setOrg(org ? { ...org, slug: e.target.value } : null)}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Billing Section would be similar to your existing billing page but at the org level */}

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Once you delete an organization, there is no going back. Please be certain.
          </p>
          <button className="px-4 py-2 bg-white border border-red-600 text-red-600 rounded-md hover:bg-red-50">
            Delete Organization
          </button>
        </div>
      </div>
    </div>
  );
}
