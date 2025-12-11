'use client';

import { useState, useEffect } from 'react';
import { Plus, Mail, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
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

interface OrganizationInvitation {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export default function Invitations() {
  const {
    activeOrganization,
    invitations,
    createInvitation,
    listInvitations,
    deleteInvitation,
    isLoading,
  } = useOrganization();
  const [isAddingInvitation, setIsAddingInvitation] = useState(false);
  const [formData, setFormData] = useState<{
    email: string;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  }>({
    email: '',
    role: 'MEMBER',
  });

  // Load invitations when component mounts or organization changes
  useEffect(() => {
    if (activeOrganization) {
      listInvitations(activeOrganization.id);
    }
  }, [activeOrganization, listInvitations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization || !formData.email.trim()) return;

    try {
      await createInvitation(activeOrganization.id, formData);

      // Reset form
      setFormData({ email: '', role: 'MEMBER' });
      setIsAddingInvitation(false);

      // Refresh invitations
      await listInvitations(activeOrganization.id);
    } catch (error) {
      console.error('Error creating invitation:', error);
    }
  };

  const handleDelete = async (token: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      await deleteInvitation(token);
      await listInvitations(activeOrganization!.id);
    } catch (error) {
      console.error('Error deleting invitation:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'EXPIRED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'CANCELLED':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'ACCEPTED':
        return 'Accepted';
      case 'EXPIRED':
        return 'Expired';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!activeOrganization) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Please select an organization to manage invitations.</p>
      </div>
    );
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'PENDING');

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Invitations</h1>
          <p className="text-gray-500">Manage invitations to your organization</p>
        </div>
        <Button
          onClick={() => setIsAddingInvitation(true)}
          disabled={isLoading}
          className="flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {pendingInvitations.length === 0 && !isAddingInvitation ? (
        <div className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending invitations</h3>
          <p className="text-gray-500 mb-4">
            Invite new members to join your organization by sending them an email invitation.
          </p>
          <Button onClick={() => setIsAddingInvitation(true)}>Send Your First Invitation</Button>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitations.map(invitation => (
                <tr key={invitation.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-400 mr-3" />
                      <div className="text-sm font-medium text-gray-900">{invitation.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {invitation.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(invitation.status)}
                      <span
                        className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(invitation.status)}`}
                      >
                        {getStatusText(invitation.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(invitation.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(invitation.expiresAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {invitation.status === 'PENDING' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(invitation.token)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Invitation Modal */}
      {isAddingInvitation && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="max-w-md w-full p-6 bg-white rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Invite New Member</h3>
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
                  onValueChange={(value: 'ADMIN' | 'MEMBER' | 'VIEWER') =>
                    setFormData(prev => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Viewer (Read Only)</SelectItem>
                    <SelectItem value="MEMBER">Member (Read & Write)</SelectItem>
                    <SelectItem value="ADMIN">Admin (Full Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingInvitation(false);
                    setFormData({ email: '', role: 'MEMBER' });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
