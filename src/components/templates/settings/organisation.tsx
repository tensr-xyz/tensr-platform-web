'use client';

import { useState, useEffect } from 'react';
import { useOrganization, Organization } from '@/hooks/api/use-organisation';
import { useOptionalOrganizationContext } from '@/contexts/organisation-context';
import { storedAgentVersion } from '@/lib/agent-version';
import { updateProfile } from '@/lib/business-api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/atoms/button';
import { Checkbox } from '@/components/atoms/checkbox';
import { Input } from '@/components/atoms/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
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
  const organisationContext = useOptionalOrganizationContext();
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const isPersonal = Boolean(organisationContext?.isPersonalAccount);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedOrg || !isEdited) return;

    try {
      await updateOrganization(editedOrg.id, { name: editedOrg.name });

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
        title: 'Organisation deleted',
        description: 'Its datasets are being removed.',
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
    if (isPersonal && !isLoading) {
      return (
        <PersonalAgentVersion
          version={storedAgentVersion(user?.agentVersion)}
          disabled={!user}
          onChange={async agentVersion => {
            try {
              const updated = await updateProfile({ agentVersion });
              setUser(updated);
              toast({
                title: agentVersion === 'v2' ? 'Agent version is v2' : 'Agent version is v1',
                description: 'The next assistant turn uses this version.',
              });
            } catch (err: any) {
              toast({
                title: 'Failed to update agent version',
                description: err.message || 'An error occurred while updating your account',
                variant: 'destructive',
              });
            }
          }}
        />
      );
    }
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
                className="mb-1 block text-sm font-medium text-muted-foreground"
              >
                Organization Name
              </label>
              <Input
                id="orgName"
                value={editedOrg.name}
                onChange={handleNameChange}
                disabled={isLoading}
              />
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
          <h3 className="text-base font-medium">Schema only</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            When this is on, the assistant receives column names, types, missing counts, and numeric
            ranges. Category levels, sample rows, and full tables stay on screen for you and are
            left out of what is sent to the model.
          </p>
        </div>
        <div className="flex items-center justify-between p-6">
          <label htmlFor="schema-only" className="text-sm font-medium">
            Schema only privacy
          </label>
          <Checkbox
            id="schema-only"
            className="h-4 w-4"
            checked={(editedOrg?.privacyMode ?? 'full') === 'schema_only'}
            disabled={isLoading || !activeOrganization}
            onCheckedChange={async checked => {
              if (!activeOrganization) return;
              const privacy_mode = checked === true ? 'schema_only' : 'full';
              try {
                const updated = await updateOrganization(activeOrganization.id, { privacy_mode });
                setEditedOrg(updated);
                toast({
                  title:
                    privacy_mode === 'schema_only' ? 'Schema only is on' : 'Schema only is off',
                  description: 'This setting is recorded on each assistant turn.',
                });
              } catch (err: any) {
                toast({
                  title: 'Failed to update privacy setting',
                  description: err.message || 'An error occurred while updating the organization',
                  variant: 'destructive',
                });
              }
            }}
          />
        </div>
      </section>

      {editedOrg.role === 'ADMIN' ? (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium">Agent version</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Which assistant loop this organisation uses. New organisations use v2. An admin can
              switch this organisation to v1.
            </p>
          </div>
          <div className="flex items-center justify-between p-6">
            <label htmlFor="agent-version" className="text-sm font-medium">
              Agent version
            </label>
            <Select
              value={storedAgentVersion(editedOrg.agentVersion)}
              disabled={isLoading || !activeOrganization}
              onValueChange={async value => {
                if (!activeOrganization) return;
                const agent_version = value === 'v2' ? 'v2' : 'v1';
                try {
                  const updated = await updateOrganization(activeOrganization.id, {
                    agent_version,
                  });
                  setEditedOrg(updated);
                  await organisationContext?.refreshCurrentOrganization();
                  toast({
                    title: agent_version === 'v2' ? 'Agent version is v2' : 'Agent version is v1',
                    description: 'The next assistant turn uses this version.',
                  });
                } catch (err: any) {
                  toast({
                    title: 'Failed to update agent version',
                    description: err.message || 'An error occurred while updating the organization',
                    variant: 'destructive',
                  });
                }
              }}
            >
              <SelectTrigger id="agent-version" className="h-9 w-auto min-w-24 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">v1</SelectItem>
                <SelectItem value="v2">v2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      ) : null}

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

function PersonalAgentVersion({
  version,
  disabled,
  onChange,
}: {
  version: 'v1' | 'v2';
  disabled: boolean;
  onChange: (version: 'v1' | 'v2') => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-medium tracking-tight">Organisation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Agent version for your personal workspace
        </p>
      </div>
      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-medium">Agent version</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Which assistant loop your personal workspace uses.
          </p>
        </div>
        <div className="flex items-center justify-between p-6">
          <label htmlFor="agent-version" className="text-sm font-medium">
            Agent version
          </label>
          <Select
            value={version}
            disabled={disabled}
            onValueChange={value => {
              const next = value === 'v2' ? 'v2' : 'v1';
              void onChange(next);
            }}
          >
            <SelectTrigger id="agent-version" className="h-9 w-auto min-w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="v1">v1</SelectItem>
              <SelectItem value="v2">v2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
