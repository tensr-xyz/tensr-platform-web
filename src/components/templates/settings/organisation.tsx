'use client';

import { useState, useEffect } from 'react';
import { useOrganization, Organization } from '@/hooks/api/use-organisation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { toast } from '@/hooks/ui/use-toast';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/molecules/dialog';

export default function OrganizationSettings() {
  const router = useRouter();
  const { activeOrganization, updateOrganization, deleteOrganization, isLoading, error } =
    useOrganization();

  const [editedOrg, setEditedOrg] = useState<Organization | null>(null);
  const [isEdited, setIsEdited] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Initialize form when active org changes
  useEffect(() => {
    if (activeOrganization) {
      setEditedOrg(activeOrganization);
    }
  }, [activeOrganization]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editedOrg) return;
    setEditedOrg({ ...editedOrg, name: e.target.value });
    setIsEdited(true);
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editedOrg) return;
    // Normalize slug - lowercase, no spaces, only alphanumeric and dashes
    const normalizedSlug = e.target.value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    setEditedOrg({ ...editedOrg, slug: normalizedSlug });
    setIsEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedOrg || !isEdited) return;

    try {
      const updatedOrg = await updateOrganization(editedOrg.id, {
        name: editedOrg.name,
        // Only include slug if you added it to your backend
        ...(editedOrg.slug && { settings: { ...editedOrg.settings, slug: editedOrg.slug } }),
      });

      toast({
        title: 'Organization updated',
        description: 'Your organization details have been updated successfully.',
      });

      setIsEdited(false);
    } catch (err: any) {
      toast({
        title: 'Failed to update organization',
        description: err.message || 'An error occurred while updating the organization',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!activeOrganization) return;

    setIsDeleting(true);
    try {
      await deleteOrganization(activeOrganization.id);
      toast({
        title: 'Organization deleted',
        description: 'Your organization has been deleted successfully.',
      });

      // Redirect to dashboard or another page
      router.push('/dashboard');
    } catch (err: any) {
      toast({
        title: 'Failed to delete organization',
        description: err.message || 'An error occurred while deleting the organization',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!editedOrg) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No organization selected</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-gray-500">Manage your organization details and members</p>
      </div>

      {/* Organization Details */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">General</h2>

            <div className="mb-6">
              <div className="flex items-center mb-4">
                {editedOrg.logoUrl ? (
                  <img
                    src={editedOrg.logoUrl}
                    alt={editedOrg.name}
                    className="w-16 h-16 rounded-md mr-4"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center mr-4">
                    <span className="text-2xl">{editedOrg.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <Button variant="outline" type="button" disabled>
                  Change Logo
                </Button>
              </div>

              <div className="mb-4">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={editedOrg.name}
                  onChange={handleNameChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="orgSlug">URL Slug</Label>
                <div className="flex mt-1">
                  <span className="inline-flex items-center px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    yourapp.com/
                  </span>
                  <Input
                    id="orgSlug"
                    value={editedOrg.slug || ''}
                    onChange={handleSlugChange}
                    className="rounded-l-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
            <Button type="submit" disabled={!isEdited || isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Once you delete an organization, there is no going back. Please be certain.
          </p>
          <Button
            variant="outline"
            className="text-red-600 border-red-600 hover:bg-red-50"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Organization'}
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your organization and all
              associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
