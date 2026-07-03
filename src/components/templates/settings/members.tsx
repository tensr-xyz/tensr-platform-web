'use client';

import { useState, useEffect } from 'react';
import { useOrganization, OrganizationMember } from '@/hooks/api/use-organisation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { toast } from '@/hooks/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/molecules/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Mail, UserPlus, Trash, Settings } from 'lucide-react';

export default function TeamMembers() {
  const {
    activeOrganization,
    members,
    fetchMembers,
    createInvitation,
    removeMember,
    updateMemberRole,
  } = useOrganization();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [isAdding, setIsAdding] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editRole, setEditRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

  // Load members when active organization changes
  useEffect(() => {
    if (activeOrganization) {
      fetchMembers(activeOrganization.id);
    }
  }, [activeOrganization, fetchMembers]);

  const handleAddButtonClick = () => {
    setShowAddDialog(true);
  };

  const handleAddMember = async () => {
    if (!activeOrganization || !newMemberEmail.trim()) return;

    setIsAdding(true);
    try {
      await createInvitation(activeOrganization.id, {
        email: newMemberEmail.trim(),
        role: newMemberRole,
      });

      toast({
        title: 'Invitation sent',
        description: `${newMemberEmail} can join once they sign up with this email.`,
      });

      setShowAddDialog(false);
      setNewMemberEmail('');
      setNewMemberRole('MEMBER');

      // Refresh the members list
      fetchMembers(activeOrganization.id);
    } catch (err: any) {
      toast({
        title: 'Failed to add team member',
        description: err.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!activeOrganization || !memberToRemove) return;

    setIsRemoving(true);
    try {
      await removeMember(activeOrganization.id, memberToRemove.userId);

      toast({
        title: 'Team member removed',
        description: `${memberToRemove.user?.email || 'Member'} has been removed from the organization`,
      });

      setShowConfirmRemove(false);
      setMemberToRemove(null);

      // Refresh the members list
      fetchMembers(activeOrganization.id);
    } catch (err: any) {
      toast({
        title: 'Failed to remove team member',
        description: err.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!activeOrganization || !editingMember) return;

    try {
      await updateMemberRole(activeOrganization.id, editingMember.userId, editRole);

      toast({
        title: 'Role updated',
        description: `${editingMember.user?.email || 'Member'}'s role has been updated to ${editRole}`,
      });

      setShowEditDialog(false);
      setEditingMember(null);

      // Refresh the members list
      fetchMembers(activeOrganization.id);
    } catch (err: any) {
      toast({
        title: 'Failed to update role',
        description: err.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'MEMBER':
        return 'bg-blue-100 text-blue-800';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!activeOrganization) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No organization selected</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-gray-500">Manage members of {activeOrganization.name}</p>
        </div>
        <Button onClick={handleAddButtonClick}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                  No team members found
                </TableCell>
              </TableRow>
            ) : (
              members.map(member => (
                <TableRow key={member.userId}>
                  <TableCell className="font-medium flex items-center">
                    {member.user?.profilePicture ? (
                      <img
                        src={member.user.profilePicture}
                        alt={member.user.email}
                        className="w-8 h-8 rounded-full mr-2"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                        <span className="text-sm font-medium">
                          {(member.user?.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium">
                        {member.user?.firstName && member.user?.lastName
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user?.email || member.userId}
                      </div>
                      {member.user?.email && (
                        <div className="text-xs text-gray-500">{member.user.email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(member.role)}`}
                    >
                      {member.role}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(member.joinedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingMember(member);
                        setEditRole(member.role);
                        setShowEditDialog(true);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMemberToRemove(member);
                        setShowConfirmRemove(true);
                      }}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex mt-1">
                <div className="bg-gray-50 border border-r-0 border-gray-300 rounded-l-md p-2 flex items-center">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                  className="rounded-l-none"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newMemberRole} onValueChange={(value: any) => setNewMemberRole(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {newMemberRole === 'ADMIN' &&
                  'Can manage team members and all organization settings.'}
                {newMemberRole === 'MEMBER' &&
                  'Can create and edit content but cannot manage team.'}
                {newMemberRole === 'VIEWER' && 'Can only view content, cannot make changes.'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!newMemberEmail || isAdding}>
              {isAdding ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <Label>Member</Label>
              <div className="flex items-center mt-1">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                  <span className="text-sm font-medium">
                    {(editingMember?.user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="font-medium">
                  {editingMember?.user?.firstName && editingMember?.user?.lastName
                    ? `${editingMember.user.firstName} ${editingMember.user.lastName}`
                    : editingMember?.user?.email || editingMember?.userId}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={(value: any) => setEditRole(value)}>
                <SelectTrigger className="mt-1" id="edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {editRole === 'ADMIN' && 'Can manage team members and all organization settings.'}
                {editRole === 'MEMBER' && 'Can create and edit content but cannot manage team.'}
                {editRole === 'VIEWER' && 'Can only view content, cannot make changes.'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={!editingMember || editingMember.role === editRole}
            >
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Dialog */}
      <Dialog open={showConfirmRemove} onOpenChange={setShowConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToRemove?.user?.email || 'this member'} from
              the organization? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmRemove(false)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemoveMember}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
