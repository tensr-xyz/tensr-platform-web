'use client';

import { useState, useEffect } from 'react';
import { useOrganization, Organization } from '@/hooks/api/use-organisation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
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
  const { activeOrganization, updateOrganization, deleteOrganization, isLoading } =
    useOrganization();

  const [editedOrg, setEditedOrg] = useState<Organization | null>(null);
  const [isEdited, setIsEdited] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      await updateOrganization(editedOrg.id, {
        name: editedOrg.name,
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
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">No organization selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-medium tracking-tight">Organisation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization details and preferences
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-medium">Organization details</h3>
          <p className="mt-1 text-sm text-muted-foreground">Update your organization information</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="mb-6 flex items-center">
              {editedOrg.logoUrl ? (
                <img
                  src={editedOrg.logoUrl}
                  alt={editedOrg.name}
                  className="mr-4 h-16 w-16 rounded-md"
                />
              ) : (
                <div className="mr-4 flex h-16 w-16 items-center justify-center rounded-md bg-muted">
                  <span className="text-2xl">{editedOrg.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <Button variant="outline" type="button" disabled>
                Change Logo
              </Button>
            </div>

            <div className="mb-6">
              <label
                htmlFor="orgName"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Organization Name
              </label>
              <Input
                id="orgName"
                value={editedOrg.name}
                onChange={handleNameChange}
                className="border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800"
                disabled={isLoading}
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="orgSlug"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                URL Slug
              </label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-200 bg-muted/30 px-3 py-2 text-sm text-muted-foreground dark:border-gray-600">
                  yourapp.com/
                </span>
                <Input
                  id="orgSlug"
                  value={editedOrg.slug || ''}
                  onChange={handleSlugChange}
                  className="rounded-l-none border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
            <p className="text-sm text-muted-foreground">
              {isEdited ? 'You have unsaved changes' : null}
            </p>
            <Button type="submit" disabled={!isEdited || isLoading}>
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-medium text-red-600">Danger zone</h3>
          <p className="mt-1 text-sm text-muted-foreground">Irreversible and destructive actions</p>
        </div>
        <div className="p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Once you delete an organization, there is no going back. Please be certain.
          </p>
          <Button
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Organization'}
          </Button>
        </div>
      </section>

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
              className="bg-red-600 text-white hover:bg-red-700"
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
