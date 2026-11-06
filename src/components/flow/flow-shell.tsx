'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type ReactNode } from 'react';
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
import { moveDatasetToProject } from '@/components/flow/move-dataset';
import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from '@/lib/accepted-upload-types';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import { uploadDatasetFile } from '@/lib/upload-dataset';
import { formatApiErrorMessage } from '@/lib/api-error';
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
  /** The upload a working version came from. */
  origin_dataset_id?: string | null;
  lineage_label?: string | null;
};

export type ShellFolder = { id: string; name: string };

/** Internal staff only: the env flag, or a tensr.xyz account. */
export function isInternalUser(email?: string | null): boolean {
  if (process.env.NEXT_PUBLIC_TENSR_INTERNAL === '1') return true;
  return /@tensr\.xyz$/i.test(String(email || '').trim());
}

/** Two initials from a name or an email, never from an id. */
export function memberInitials(label: string): string {
  const text = label.trim();
  if (!text) return '·';
  const base = text.includes('@') ? text.split('@')[0] : text;
  const parts = base
    .replace(/[0-9]+/g, ' ')
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || base).slice(0, 2).toUpperCase();
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
        <aside className="flow-side flow-rail" aria-label="Sidebar">
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
                data-active={section === 'projects' && !folderName}
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
        <Link
          href="/flow"
          data-active={section === 'projects' && !folderName}
          onClick={() => onFolder(null)}
        >
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

/** A taken name gets the next free number, so folders never share a name. */
export function uniqueFolderName(name: string, folders: { name: string }[]): string {
  const base = name.trim();
  const taken = new Set(folders.map(folder => folder.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let index = 2;
  while (taken.has(`${base} ${index}`.toLowerCase())) index += 1;
  return `${base} ${index}`;
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
      body: JSON.stringify({ name: uniqueFolderName(value, folders) }),
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
          <Link href="/flow/settings/general">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/flow/settings/billing">Workspace and billing</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/flow/settings/members">Invite people</Link>
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
  fallbackName = '',
  projects,
  section,
  hasMore,
  onLoadMore,
}: {
  current?: FlowProject;
  fallbackName?: string;
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
          <strong data-loading={(!current?.name && !fallbackName) || undefined}>
            {current?.name || fallbackName || '\u00a0'}
          </strong>
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
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const createdProjectId = useRef<string | null>(null);
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
    setProgress(null);
    createdProjectId.current = null;
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
      let id = createdProjectId.current;
      if (!id) {
        const page = await flowJson<{ project?: { id?: string } }>('/api/projects', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), folder: folder || null, keep_empty: true }),
        });
        id = page.project?.id || null;
        if (!id) throw new Error('The project did not save.');
        createdProjectId.current = id;
      }
      if (choice === 'upload' && file) {
        const token = getStytchBearerForTensrApi();
        if (!token) throw new Error('Sign in again to upload a file.');
        const uploaded = await uploadDatasetFile(file, token, 'workspace', setProgress);
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
      setError(formatApiErrorMessage(err));
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
        {progress !== null && busy ? <p className="flow-muted">Uploading… {progress}%</p> : null}
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
                  ? `Uploading… ${progress ?? 0}%`
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
