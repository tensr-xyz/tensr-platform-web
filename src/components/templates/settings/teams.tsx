'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Edit, Trash2 } from 'lucide-react';
import { useOrganization } from '@/hooks/api/use-organisation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Textarea } from '@/components/atoms/text-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';

interface Team {
  id: string;
  name: string;
  description?: string;
  accessLevel: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

export default function Teams() {
  const { activeOrganization, teams, createTeam, updateTeam, deleteTeam, listTeams, isLoading } =
    useOrganization();
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accessLevel: 'READ_WRITE' as const,
  });

  // Load teams when component mounts or organization changes
  useEffect(() => {
    if (activeOrganization) {
      listTeams(activeOrganization.id);
    }
  }, [activeOrganization, listTeams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization || !formData.name.trim()) return;

    try {
      if (editingTeam) {
        await updateTeam(activeOrganization.id, editingTeam.id, formData);
        setEditingTeam(null);
      } else {
        await createTeam(activeOrganization.id, formData);
      }

      // Reset form
      setFormData({ name: '', description: '', accessLevel: 'READ_WRITE' });
      setIsAddingTeam(false);

      // Refresh teams
      await listTeams(activeOrganization.id);
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      accessLevel: team.accessLevel,
    });
    setIsAddingTeam(true);
  };

  const handleDelete = async (teamId: string) => {
    if (!activeOrganization || !confirm('Are you sure you want to delete this team?')) return;

    try {
      await deleteTeam(activeOrganization.id, teamId);
      await listTeams(activeOrganization.id);
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  const handleCancel = () => {
    setIsAddingTeam(false);
    setEditingTeam(null);
    setFormData({ name: '', description: '', accessLevel: 'READ_WRITE' });
  };

  if (!activeOrganization) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Please select an organization to manage teams.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-gray-500">Manage your organization&apos;s teams</p>
        </div>
        <Button
          onClick={() => setIsAddingTeam(true)}
          disabled={isLoading}
          className="flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Team
        </Button>
      </div>

      {teams.length === 0 && !isAddingTeam ? (
        <div className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No teams created yet</h3>
          <p className="text-gray-500 mb-4">
            Teams help you organize your organization&apos;s members and manage access to projects.
          </p>
          <Button onClick={() => setIsAddingTeam(true)}>Create Your First Team</Button>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access Level
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.map(team => (
                <tr key={team.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-md flex items-center justify-center text-blue-500">
                        {team.name.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{team.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {team.description || 'No description'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {team.accessLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(team)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(team.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Team Modal */}
      {isAddingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="max-w-md w-full p-6 bg-white rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingTeam ? 'Edit Team' : 'Create New Team'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name
                </label>
                <Input
                  type="text"
                  id="teamName"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Engineering, Design, Marketing, etc."
                  required
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="teamDescription"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description (Optional)
                </label>
                <Textarea
                  id="teamDescription"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this team do?"
                  rows={3}
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="accessLevel"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Default Access Level
                </label>
                <Select
                  value={formData.accessLevel}
                  onValueChange={(value: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN') =>
                    setFormData(prev => ({ ...prev, accessLevel: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="READ_ONLY">Read Only</SelectItem>
                    <SelectItem value="READ_WRITE">Read & Write</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {editingTeam ? 'Update Team' : 'Create Team'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
