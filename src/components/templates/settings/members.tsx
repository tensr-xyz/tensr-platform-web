'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';

export default function Members() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-gray-500">Manage your organization&apos;s members and their roles</p>
        </div>
        <button
          onClick={() => setIsInviting(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </button>
      </div>

      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Member
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Role
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Teams
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map(member => (
              <tr key={member.userId}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 bg-gray-200 rounded-full"></div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">
                        {/* Would need to get user details */}
                        John Doe
                      </div>
                      <div className="text-sm text-gray-500">
                        {member.inviteEmail || 'john@example.com'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    className="text-sm border-gray-300 rounded-md"
                    value={member.role}
                    onChange={e => {
                      // Update member role
                    }}
                  >
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="GUEST">Guest</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.teamIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {member.teamIds.map(teamId => (
                        <span
                          key={teamId}
                          className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                        >
                          Engineering
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">No teams</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      member.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                  <button className="text-red-600 hover:text-red-900">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {isInviting && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Team Members</h3>
            <form>
              <div className="mb-4">
                <label htmlFor="emails" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Addresses
                </label>
                <textarea
                  id="emails"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter email addresses (one per line)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Separate multiple email addresses with commas or new lines
                </p>
              </div>
              <div className="mb-4">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select id="role" className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest</option>
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="teams" className="block text-sm font-medium text-gray-700 mb-1">
                  Add to Teams (Optional)
                </label>
                <select
                  id="teams"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="team1">Engineering</option>
                  <option value="team2">Design</option>
                  <option value="team3">Marketing</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsInviting(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Send Invites
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
