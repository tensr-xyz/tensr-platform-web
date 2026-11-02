'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/rest';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { MoveToProjectDialog, moveDatasetToProject } from '@/components/flow/move-dataset';
import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from '@/lib/accepted-upload-types';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import { uploadDatasetFile } from '@/lib/upload-dataset';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { useAuth } from '@/hooks/api/use-auth';

export type ShellDataset = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
  n_cols?: number;
  project_id?: string;
  updated_at?: string;
  created_at?: string;
  parent_dataset_id?: string | null;
  lineage_label?: string | null;
};

export type ShellFolder = { id: string; name: string };

/** Internal staff only: the env flag, or a tensr.xyz account. */
export function isInternalUser(email?: string | null): boolean {
  if (process.env.NEXT_PUBLIC_TENSR_INTERNAL === '1') return true;
  return /@tensr\.xyz$/i.test(String(email || '').trim());
}

export function shellDatasetId(row: ShellDataset): string {
  return String(row.dataset_id || row.id || '');
}

/** Recent projects first, capped, filtered by a query. */
export function recentProjects(projects: FlowProject[], query: string, cap: number): FlowProject[] {
  const needle = query.trim().toLowerCase();
  return projects
    .filter(item => (item.status || 'active') !== 'archived')
    .filter(item => !needle || item.name.toLowerCase().includes(needle))
    .sort(
      (left, right) =>
        new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    )
    .slice(0, cap);
}

export function PanelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="1.5"
        y="2"
        width="11"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M5 2v10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function SwitchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M3.5 4.5L6 2l2.5 2.5M3.5 7.5L6 10l2.5-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <span className="flow-logo" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 48 48">
        <rect x="4" y="5" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="18" y="5" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="32" y="5" width="12" height="12" rx="2.5" fill="#6FC2A6" />
        <rect x="18" y="19" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="18" y="33" width="12" height="12" rx="2.5" fill="#FFFFFF" />
      </svg>
    </span>
  );
}

type NavKind = 'plus' | 'search' | 'home' | 'data' | 'plugin' | 'folder';

export function NavIcon({ kind }: { kind: NavKind }) {
  const stroke = kind === 'plus' ? '#1B1C1A' : '#6A6B66';
  if (kind === 'plus') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 3.5v9M3.5 8h9"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'search') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke={stroke} strokeWidth="1.4" />
        <path
          d="M10.5 10.5L13.5 13.5"
          fill="none"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'home') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect
          x="2.5"
          y="2.5"
          width="11"
          height="11"
          rx="2"
          fill="none"
          stroke={stroke}
          strokeWidth="1.4"
        />
        <path d="M2.5 6.5h11M6.5 6.5v7" fill="none" stroke={stroke} strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === 'data') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <ellipse cx="8" cy="4" rx="5" ry="1.8" fill="none" stroke={stroke} strokeWidth="1.2" />
        <path
          d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"
          fill="none"
          stroke={stroke}
          strokeWidth="1.2"
        />
      </svg>
    );
  }
  if (kind === 'folder') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M2.5 4.5a1 1 0 011-1h3l1.5 1.5h4.5a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1z"
          fill="none"
          stroke={stroke}
          strokeWidth="1.2"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 2.5h4v2a1.3 1.3 0 102.6 0h.9v4h-2a1.3 1.3 0 100 2.6h2v2.4H2.5V10.5h2a1.3 1.3 0 100-2.6h-2V4.5H6z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function RailTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function FlowSidebar({
  collapsed,
  onCollapse,
  section,
  datasetCount,
  folders,
  folderName,
  account,
  email,
  workspace,
  onFolder,
  onNewProject,
  onSearch,
  onFoldersChanged,
}: {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  section: string;
  datasetCount: number;
  folders: ShellFolder[];
  folderName: string | null;
  account: string;
  email: string;
  workspace: string;
  onFolder: (name: string | null) => void;
  onNewProject: () => void;
  onSearch: () => void;
  onFoldersChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const displayName = account.includes('@') ? account.split('@')[0] : account;
  const initials = (displayName || account)
    .split(/[\s._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
  const openFolder = (name: string) => {
    onFolder(name);
    router.push('/flow');
  };

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <aside className="flow-side flow-side-rail" aria-label="Sidebar">
          <RailTip label="Show sidebar">
            <Button
              className="rail-logo"
              type="button"
              aria-label="Show sidebar"
              onClick={() => onCollapse(false)}
            >
              <LogoMark />
            </Button>
          </RailTip>
          <RailTip label="Expand sidebar">
            <Button
              className="rail-expand"
              type="button"
              aria-label="Expand sidebar"
              onClick={() => onCollapse(false)}
            >
              <PanelIcon />
            </Button>
          </RailTip>
          <nav className="rail-nav">
            <RailTip label="New project  ⌘N">
              <Button type="button" aria-label="New project" onClick={onNewProject}>
                <NavIcon kind="plus" />
              </Button>
            </RailTip>
            <RailTip label="Search  ⌘K">
              <Button type="button" aria-label="Search" onClick={onSearch}>
                <NavIcon kind="search" />
              </Button>
            </RailTip>
            <RailTip label="Home">
              <Link
                href="/flow"
                aria-label="Home"
                data-active={section === 'projects'}
                onClick={() => onFolder(null)}
              >
                <NavIcon kind="home" />
              </Link>
            </RailTip>
            <RailTip label={`Datasets · ${datasetCount}`}>
              <Link
                href="/flow/datasets"
                aria-label="Datasets"
                data-active={section === 'datasets'}
              >
                <NavIcon kind="data" />
              </Link>
            </RailTip>
            <RailTip label="Plugins">
              <Link href="/flow/plugins" aria-label="Plugins" data-active={section === 'plugins'}>
                <NavIcon kind="plugin" />
              </Link>
            </RailTip>
          </nav>
          <div className="rail-folders">
            {folders.map(folder => (
              <RailTip key={folder.id} label={folder.name}>
                <Button
                  type="button"
                  aria-label={`Folder ${folder.name}`}
                  data-active={folderName === folder.name}
                  onClick={() => openFolder(folder.name)}
                >
                  <NavIcon kind="folder" />
                </Button>
              </RailTip>
            ))}
          </div>
          <UserMenu
            account={displayName || account}
            email={email}
            initials={initials}
            workspace={workspace}
            compact
          />
        </aside>
      </TooltipProvider>
    );
  }

  return (
    <aside className="flow-side">
      <div className="flow-brand">
        <LogoMark />
        <div className="flow-brand-name">
          <strong>Tensr</strong>
          <em>{workspace ? ` · ${workspace}` : ''}</em>
        </div>
        <Button
          className="flow-brand-collapse"
          type="button"
          aria-label="Collapse sidebar"
          onClick={() => onCollapse(true)}
        >
          <PanelIcon />
        </Button>
      </div>
      <nav className="flow-nav">
        <Button className="flow-new" type="button" onClick={onNewProject}>
          <span className="nav-label">
            <NavIcon kind="plus" /> New project
          </span>
          <span className="flow-k">⌘N</span>
        </Button>
        <Button type="button" onClick={onSearch}>
          <span className="nav-label">
            <NavIcon kind="search" /> Search
          </span>
          <span className="flow-k">⌘K</span>
        </Button>
        <Link href="/flow" data-active={section === 'projects'} onClick={() => onFolder(null)}>
          <span className="nav-label">
            <NavIcon kind="home" /> Home
          </span>
        </Link>
        <Link href="/flow/datasets" data-active={section === 'datasets'}>
          <span className="nav-label">
            <NavIcon kind="data" /> Datasets
          </span>
          <span className="flow-k">{datasetCount}</span>
        </Link>
        <Link href="/flow/plugins" data-active={section === 'plugins'}>
          <span className="nav-label">
            <NavIcon kind="plugin" /> Plugins
          </span>
        </Link>
      </nav>
      <div className="flow-folders">
        <FolderList
          folders={folders}
          folderName={folderName}
          onOpen={openFolder}
          onCreated={onFoldersChanged}
        />
      </div>
      <div className="flow-user">
        <span className="flow-avatar">{initials || '·'}</span>
        <div>
          <strong>{displayName || 'Signed in'}</strong>
          <span>{workspace || 'Workspace'}</span>
        </div>
        <UserMenu
          account={displayName || account}
          email={email}
          initials={initials}
          workspace={workspace}
        />
      </div>
    </aside>
  );
}

export function FolderList({
  folders,
  folderName,
  onOpen,
  onCreated,
}: {
  folders: ShellFolder[];
  folderName: string | null;
  onOpen: (name: string) => void;
  onCreated: () => Promise<void>;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = () => {
    const value = name.trim();
    if (!value) {
      setNaming(false);
      return;
    }
    setBusy(true);
    setError('');
    void flowJson('/api/project-folders', {
      method: 'POST',
      body: JSON.stringify({ name: value }),
    })
      .then(() => onCreated())
      .then(() => {
        setName('');
        setNaming(false);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The folder did not save.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <div className="folder-head">
        <h2>Folders</h2>
        <Button type="button" aria-label="New folder" onClick={() => setNaming(true)}>
          +
        </Button>
      </div>
      {folders.map((folder, index) => (
        <Button
          key={folder.id}
          type="button"
          data-active={folderName === folder.name}
          onClick={() => onOpen(folder.name)}
        >
          <i data-tone={index === 0 ? 'accent' : 'mute'} />
          {folder.name}
        </Button>
      ))}
      {naming ? (
        <div className="folder-new">
          <Input
            autoFocus
            className="flow-input"
            value={name}
            disabled={busy}
            aria-label="Folder name"
            placeholder="Folder name"
            onChange={event => setName(event.target.value)}
            onBlur={() => {
              if (!name.trim()) setNaming(false);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') {
                setName('');
                setNaming(false);
              }
            }}
          />
          {error ? <span className="flow-error">{error}</span> : null}
        </div>
      ) : folders.length === 0 ? (
        <p className="folder-empty">Group projects into folders.</p>
      ) : null}
    </>
  );
}

export function UserMenu({
  account,
  email,
  initials,
  workspace,
  compact,
}: {
  account: string;
  email: string;
  initials: string;
  workspace: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { handleLogout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const internal = isInternalUser(email);
  const signOut = () => {
    setSigningOut(true);
    void Promise.resolve(handleLogout()).catch(() => {
      setSigningOut(false);
      router.replace('/login');
    });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={compact ? 'rail-user' : 'flow-user-more'}
          type="button"
          aria-label="Account menu"
        >
          {compact ? <span className="flow-avatar">{initials || '·'}</span> : '···'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? 'start' : 'end'}
        side={compact ? 'right' : 'top'}
        className="flow-user-menu"
      >
        <div className="flow-user-menu-head">
          <strong>{account || 'Signed in'}</strong>
          <span>{email || workspace || 'Workspace'}</span>
        </div>
        <DropdownMenuItem asChild>
          <Link href="/settings/general">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing">Workspace and billing</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/members">Invite people</Link>
        </DropdownMenuItem>
        {internal ? (
          <DropdownMenuItem
            onSelect={() => {
              window.localStorage.setItem('tensr-classic', '1');
              router.push('/dashboard?classic=1');
            }}
          >
            Classic workspace
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={signingOut} onSelect={signOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectSwitcher({
  current,
  projects,
  section,
  hasMore,
  onLoadMore,
}: {
  current?: FlowProject;
  projects: FlowProject[];
  section: string;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cap, setCap] = useState(8);
  const [loading, setLoading] = useState(false);
  const shown = recentProjects(projects, query, cap);
  const more = hasMore || recentProjects(projects, query, cap + 1).length > shown.length;
  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setCap(8);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button className="proj-switch" type="button" aria-label="Switch project">
          <strong>{current?.name || 'Project'}</strong>
          <SwitchIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="proj-switcher">
        <div className="proj-switcher-search">
          <SearchIcon />
          <Input
            autoFocus
            value={query}
            aria-label="Find a project"
            placeholder="Find a project"
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="proj-switcher-label">{query ? 'Matches' : 'Recent'}</div>
        <div className="proj-switcher-list">
          {shown.length === 0 ? (
            <p className="proj-switcher-empty">No project matches.</p>
          ) : (
            shown.map(item => (
              <Link
                key={item.id}
                href={`/flow/p/${item.id}/${section}`}
                data-active={item.id === current?.id}
                onClick={() => setOpen(false)}
              >
                <i />
                {item.name}
              </Link>
            ))
          )}
        </div>
        <div className="proj-switcher-foot">
          {more ? (
            <Button
              className="flow-btn"
              type="button"
              disabled={loading}
              onClick={() => {
                setCap(value => value + 8);
                if (hasMore && recentProjects(projects, query, cap + 8).length <= cap + 8) {
                  setLoading(true);
                  void onLoadMore().finally(() => setLoading(false));
                }
              }}
            >
              {loading ? 'Loading…' : 'Load more'}
            </Button>
          ) : (
            <span />
          )}
          <Link className="proj-switcher-all" href="/flow" onClick={() => setOpen(false)}>
            All projects →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type DataChoice = 'upload' | 'existing' | 'skip';

export function NewProjectDialog({
  open,
  onOpenChange,
  folders,
  datasets,
  defaultFolder,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ShellFolder[];
  datasets: ShellDataset[];
  defaultFolder: string | null;
  onCreated: () => Promise<void>;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(defaultFolder || '');
  const [choice, setChoice] = useState<DataChoice>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [existing, setExisting] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pickable = useMemo(
    () =>
      datasets
        .filter(row => shellDatasetId(row) && !row.parent_dataset_id)
        .map(row => ({
          value: shellDatasetId(row),
          label: row.original_filename || shellDatasetId(row),
        })),
    [datasets]
  );

  const reset = () => {
    setStep(1);
    setName('');
    setFolder(defaultFolder || '');
    setChoice('upload');
    setFile(null);
    setExisting('');
    setError('');
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      let datasetId = '';
      if (choice === 'upload') {
        if (!file) throw new Error('Choose a file to upload, or skip for now.');
        if (!isAcceptedUploadExtension(file.name)) {
          throw new Error('Use a .sav, .dta, CSV, Excel, Triple-S, or Parquet file.');
        }
      }
      if (choice === 'existing' && !existing) throw new Error('Pick a dataset, or skip for now.');
      const page = await flowJson<{ project?: { id?: string } }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), folder: folder || null, keep_empty: true }),
      });
      const id = page.project?.id;
      if (!id) throw new Error('The project did not save.');
      if (choice === 'upload' && file) {
        const token = getStytchBearerForTensrApi();
        if (!token) throw new Error('Sign in again to upload a file.');
        const uploaded = await uploadDatasetFile(file, token, 'workspace');
        datasetId = uploaded.dataset_id;
      } else if (choice === 'existing') {
        datasetId = existing;
      }
      if (datasetId) {
        await moveDatasetToProject(id, datasetId);
        await flowJson(`/api/projects/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_dataset_id: datasetId }),
        });
      }
      await onCreated();
      onOpenChange(false);
      reset();
      router.push(`/flow/p/${id}/${datasetId ? 'responses' : 'sources'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The project did not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="new-project-dialog">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'New project' : 'Add data'}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Name the study. You can rename it or move it to a folder later.'
              : `Bring data into ${name.trim() || 'the project'}. You can add more files from Sources.`}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="new-project-fields">
            <label className="new-project-field">
              <span>Name</span>
              <Input
                autoFocus
                value={name}
                placeholder="e.g. Brand tracker wave 4"
                aria-label="Project name"
                onChange={event => setName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && name.trim()) setStep(2);
                }}
              />
            </label>
            <label className="new-project-field">
              <span>Folder (optional)</span>
              <ChoiceSelect
                aria-label="Folder"
                value={folder}
                onValueChange={setFolder}
                options={[
                  { value: '', label: 'No folder' },
                  ...folders.map(item => ({ value: item.name, label: item.name })),
                ]}
              />
            </label>
          </div>
        ) : (
          <div className="new-project-data">
            {(
              [
                ['upload', 'Upload a file', '.sav, .dta, CSV, Excel, Triple-S or Parquet'],
                ['existing', 'Use a dataset you have', 'Moves it into this project'],
                ['skip', 'Skip for now', 'Add data later from Sources'],
              ] as const
            ).map(([value, title, note]) => (
              <Button
                key={value}
                type="button"
                className="new-project-choice"
                data-active={choice === value}
                onClick={() => setChoice(value)}
              >
                <strong>{title}</strong>
                <span>{note}</span>
              </Button>
            ))}
            {choice === 'upload' ? (
              <div className="new-project-file">
                <Button
                  className="flow-btn"
                  type="button"
                  onClick={() => fileInput.current?.click()}
                >
                  {file ? 'Choose another file' : 'Choose file'}
                </Button>
                <span className="flow-muted">{file ? file.name : 'No file chosen'}</span>
                <Input
                  ref={fileInput}
                  className="sources-file-input"
                  type="file"
                  accept={ACCEPTED_UPLOAD_ACCEPT}
                  aria-label="Upload file"
                  onChange={event => {
                    setFile(event.target.files?.[0] || null);
                    event.target.value = '';
                  }}
                />
              </div>
            ) : choice === 'existing' ? (
              pickable.length ? (
                <ChoiceSelect
                  aria-label="Dataset"
                  value={existing}
                  onValueChange={setExisting}
                  placeholder="Choose a dataset"
                  options={pickable}
                />
              ) : (
                <p className="flow-muted">You have no datasets yet. Upload one instead.</p>
              )
            ) : null}
          </div>
        )}
        {error ? <p className="flow-error">{error}</p> : null}
        <div className="new-project-foot">
          {step === 2 ? (
            <Button className="flow-btn" type="button" disabled={busy} onClick={() => setStep(1)}>
              Back
            </Button>
          ) : (
            <Button className="flow-btn" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === 1 ? (
            <Button
              className="flow-btn primary"
              type="button"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          ) : (
            <Button
              className="flow-btn primary"
              type="button"
              disabled={busy}
              onClick={() => void create()}
            >
              {busy
                ? choice === 'upload'
                  ? 'Uploading…'
                  : 'Creating…'
                : choice === 'skip'
                  ? 'Create project'
                  : 'Create and open'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DatasetsScreen({
  phase,
  datasets,
  projects,
  onChanged,
}: {
  phase: 'loading' | 'ready' | 'error';
  datasets: ShellDataset[];
  projects: FlowProject[];
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [moving, setMoving] = useState<ShellDataset | null>(null);
  const [error, setError] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const projectName = (id?: string) =>
    (id && (projects.find(item => item.id === id)?.name || names[id])) || '';
  const missing = useMemo(
    () =>
      [...new Set(datasets.map(row => row.project_id).filter(Boolean) as string[])].filter(
        id => !projects.some(item => item.id === id)
      ),
    [datasets, projects]
  );
  const missingKey = missing.join('|');
  useEffect(() => {
    if (!missingKey) return;
    void Promise.all(
      missingKey.split('|').map(id =>
        flowJson<{ project?: FlowProject }>(`/api/projects/${id}`)
          .then(page => [id, page.project?.name || ''] as const)
          .catch(() => [id, ''] as const)
      )
    ).then(rows => setNames(current => ({ ...current, ...Object.fromEntries(rows) })));
  }, [missingKey]);

  const needle = query.trim().toLowerCase();
  const shown = datasets
    .filter(row => shellDatasetId(row))
    .filter(
      row =>
        !needle ||
        (row.original_filename || '').toLowerCase().includes(needle) ||
        projectName(row.project_id).toLowerCase().includes(needle)
    )
    .sort(
      (left, right) =>
        new Date(right.updated_at || right.created_at || 0).getTime() -
        new Date(left.updated_at || left.created_at || 0).getTime()
    );

  const open = (row: ShellDataset) => {
    const id = shellDatasetId(row);
    if (!row.project_id) {
      setMoving(row);
      return;
    }
    setError('');
    void flowJson(`/api/projects/${row.project_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active_dataset_id: id }),
    })
      .then(() => router.push(`/flow/p/${row.project_id}/responses`))
      .catch(err => setError(err instanceof Error ? err.message : 'The file did not open.'));
  };

  return (
    <div className="home-page datasets-page">
      <div className="home-head">
        <div>
          <div className="flow-muted">Every file in your workspace</div>
          <h1 className="flow-page-title">Datasets</h1>
        </div>
        <div className="home-head-actions">
          <label className="home-search">
            <SearchIcon />
            <Input
              value={query}
              placeholder="Search files or projects"
              aria-label="Search datasets"
              onChange={event => setQuery(event.target.value)}
            />
          </label>
        </div>
      </div>
      {phase === 'loading' ? (
        <div className="project-table" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="datasets-skeleton" />
          ))}
        </div>
      ) : phase === 'error' ? (
        <p className="flow-error">Could not load your datasets. Refresh to try again.</p>
      ) : shown.length === 0 ? (
        <div className="datasets-empty">
          <strong>{needle ? 'No file matches' : 'No datasets yet'}</strong>
          <span className="flow-muted">
            {needle
              ? 'Try a different file or project name.'
              : 'Upload a file from a project’s Sources tab, or start a new project.'}
          </span>
        </div>
      ) : (
        <div className="project-table">
          <Table className="flow-table datasets-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Project</th>
                <th>Rows</th>
                <th className="edited">Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map(row => {
                const id = shellDatasetId(row);
                const project = projectName(row.project_id);
                return (
                  <tr key={id}>
                    <td>
                      <span className="project-name">{row.original_filename || id}</span>
                      <div className="project-sub">
                        {row.parent_dataset_id
                          ? row.lineage_label || 'Working version'
                          : 'Uploaded file'}
                        {row.n_cols ? ` · ${row.n_cols} columns` : ''}
                      </div>
                    </td>
                    <td>
                      {row.project_id ? (
                        <Link
                          className="datasets-project"
                          href={`/flow/p/${row.project_id}/sources`}
                        >
                          {project || 'Project'}
                        </Link>
                      ) : (
                        <span className="flow-muted">Not in a project</span>
                      )}
                    </td>
                    <td>{row.n_rows ? row.n_rows.toLocaleString('en-GB') : '—'}</td>
                    <td className="edited">
                      {row.updated_at || row.created_at
                        ? new Date(row.updated_at || row.created_at || '').toLocaleDateString(
                            'en-GB',
                            { day: 'numeric', month: 'short' }
                          )
                        : '—'}
                    </td>
                    <td className="datasets-actions">
                      <Button className="flow-btn" type="button" onClick={() => open(row)}>
                        Open
                      </Button>
                      <Button className="flow-btn" type="button" onClick={() => setMoving(row)}>
                        Move
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
      {error ? <p className="flow-error">{error}</p> : null}
      <MoveToProjectDialog
        datasetId={moving ? shellDatasetId(moving) : ''}
        datasetName={moving?.original_filename}
        open={Boolean(moving)}
        onOpenChange={next => {
          if (!next) setMoving(null);
        }}
        onMoved={() => void onChanged()}
      />
    </div>
  );
}
