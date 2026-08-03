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
import posthog from 'posthog-js';

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

      posthog.capture('team_member_invited', { role: newMemberRole });

      toast({
        title: 'Invitation sent',
        description: `${newMemberEmail} can join once they sign up with this email.`,
      });

      setShowAddDialog(false);
      setNewMemberEmail('');
      setNewMemberRole('MEMBER');

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

      posthog.capture('team_member_removed', { role: memberToRemove.role });

      toast({
        title: 'Team member removed',
        description: `${memberToRemove.user?.email || 'Member'} has been removed from the organization`,
      });

      setShowConfirmRemove(false);
      setMemberToRemove(null);

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

      posthog.capture('team_member_role_updated', {
        previous_role: editingMember.role,
        new_role: editRole,
      });

      toast({
        title: 'Role updated',
        description: `${editingMember.user?.email || 'Member'}'s role has been updated to ${editRole}`,
      });

      setShowEditDialog(false);
      setEditingMember(null);

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
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (!activeOrganization) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">No organization selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-medium tracking-tight">Members</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage members of {activeOrganization.name}
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-base font-medium">Team members</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              People with access to this organization
            </p>
          </div>
          <Button onClick={handleAddButtonClick} size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </div>

        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No team members found
                  </TableCell>
                </TableRow>
              ) : (
                members.map(member => (
                  <TableRow key={member.userId}>
                    <TableCell className="flex items-center pl-6 font-medium">
                      {member.user?.profilePicture ? (
                        <img
                          src={member.user.profilePicture}
                          alt={member.user.email}
                          className="mr-2 h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
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
                          <div className="text-xs text-muted-foreground">{member.user.email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeClass(member.role)}`}
                      >
                        {member.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
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
      </section>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <Label htmlFor="email">Email Address</Label>
              <div className="mt-1 flex">
                <div className="flex items-center rounded-l-md border border-r-0 border-border bg-muted/30 p-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
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
              <p className="mt-1 text-xs text-muted-foreground">
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

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <Label>Member</Label>
              <div className="mt-1 flex items-center">
                <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
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
              <p className="mt-1 text-xs text-muted-foreground">
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
              className="bg-red-600 text-white hover:bg-red-700"
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
