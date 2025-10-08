'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, UserPlus, UserMinus, Crown } from 'lucide-react';
import { useOrganization } from '@/hooks/api/use-organisation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';

interface TeamMember {
  teamId: string;
  userId: string;
  role: 'MEMBER' | 'LEADER';
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface Team {
  id: string;
  name: string;
  description?: string;
  accessLevel: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';
}

export default function TeamMembers() {
  const {
    activeOrganization,
    teams,
    listTeams,
    listTeamMembers,
    addMemberToTeam,
    removeMemberFromTeam,
    updateTeamMemberRole,
  } = useOrganization();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'MEMBER' as 'MEMBER' | 'LEADER',
  });

  // Load teams when component mounts or organization changes
  useEffect(() => {
    if (activeOrganization) {
      listTeams(activeOrganization.id);
    }
  }, [activeOrganization, listTeams]);

  // Load team members when a team is selected
  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeamMembers = async (teamId: string) => {
    try {
      const members = await listTeamMembers(teamId);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !formData.email.trim()) return;

    try {
      await addMemberToTeam(selectedTeam.id, formData);

      // Reset form
      setFormData({ email: '', role: 'MEMBER' });
      setIsAddingMember(false);

      // Refresh team members
      await loadTeamMembers(selectedTeam.id);
    } catch (error) {
      console.error('Error adding team member:', error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam || !confirm('Are you sure you want to remove this member from the team?'))
      return;

    try {
      await removeMemberFromTeam(selectedTeam.id, userId);
      await loadTeamMembers(selectedTeam.id);
    } catch (error) {
      console.error('Error removing team member:', error);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'MEMBER' | 'LEADER') => {
    if (!selectedTeam) return;

    try {
      await updateTeamMemberRole(selectedTeam.id, userId, newRole);
      await loadTeamMembers(selectedTeam.id);
    } catch (error) {
      console.error('Error updating team member role:', error);
    }
  };

  if (!activeOrganization) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Please select an organization to manage team members.</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="p-8 text-center">
        <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No teams available</h3>
        <p className="text-gray-500">Create teams first to manage team members.</p>
      </div>
    );
  }

  if (!selectedTeam) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select a Team</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <div
              key={team.id}
              className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 hover:bg-gray-50"
              onClick={() => setSelectedTeam(team)}
            >
              <h4 className="font-medium text-gray-900">{team.name}</h4>
              {team.description && <p className="text-sm text-gray-500 mt-1">{team.description}</p>}
              <div className="mt-2">
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {team.accessLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-gray-500">
            Manage members of <span className="font-medium">{selectedTeam.name}</span>
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setSelectedTeam(null)}>
            Back to Teams
          </Button>
          <Button onClick={() => setIsAddingMember(true)} className="flex items-center">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {teamMembers.length === 0 ? (
        <div className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
          <p className="text-gray-500 mb-4">Add members to this team to start collaborating.</p>
          <Button onClick={() => setIsAddingMember(true)}>Add Your First Member</Button>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamMembers.map(member => (
                <tr key={member.userId}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {member.user?.firstName?.charAt(0) || member.user?.email.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {member.user?.firstName && member.user?.lastName
                            ? `${member.user.firstName} ${member.user.lastName}`
                            : member.user?.email || 'Unknown User'}
                        </div>
                        <div className="text-sm text-gray-500">{member.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {member.role === 'LEADER' && (
                        <Crown className="h-4 w-4 text-yellow-500 mr-2" />
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.role === 'LEADER'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {member.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {member.role !== 'LEADER' && (
                        <Select
                          value={member.role}
                          onValueChange={(value: 'MEMBER' | 'LEADER') =>
                            handleUpdateRole(member.userId, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="LEADER">Leader</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-red-600 hover:text-red-900"
                        disabled={member.role === 'LEADER'}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="max-w-md w-full p-6 bg-white rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Team Member</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'MEMBER' | 'LEADER') =>
                    setFormData(prev => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="LEADER">Leader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingMember(false);
                    setFormData({ email: '', role: 'MEMBER' });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Add Member</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
