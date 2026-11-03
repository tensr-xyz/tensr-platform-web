'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { flowJson } from '@/lib/flow-api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { PersonMark, SettingsError, SkeletonCard } from './parts';
import { alphaToLevel, errorText, levelToAlpha, type MePage } from './settings-data';
import { useLoad } from './use-load';

type Org = { id?: string; low_base_threshold?: number | null; comparison_alpha?: number | null };

type GeneralData = { me: MePage; org: Org | null };

const LEVELS = [
  { value: '90', label: '90%' },
  { value: '95', label: '95%' },
  { value: '99', label: '99%' },
];

async function loadGeneral(): Promise<GeneralData> {
  const me = await flowJson<MePage>('/api/me');
  const orgId = me.active_organization?.id;
  const org = orgId
    ? await flowJson<{ organization?: Org }>(`/api/organizations/${orgId}`)
        .then(page => page.organization || null)
        .catch(() => null)
    : null;
  return { me, org };
}

export function SettingsGeneral() {
  const { state, retry, setData } = useLoad(loadGeneral, []);
  if (state.phase === 'loading') {
    return (
      <div className="st-stack st-narrow">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={2} />
        <SkeletonCard rows={1} />
      </div>
    );
  }
  if (state.phase === 'error') return <SettingsError message={state.error} onRetry={retry} />;
  const { me, org } = state.data;
  return (
    <div className="st-stack st-narrow">
      <ProfileCard me={me} onSaved={user => setData(d => ({ ...d, me: { ...d.me, user } }))} />
      {org ? (
        <DefaultsCard
          org={org}
          canEdit={me.active_organization?.role === 'owner'}
          onSaved={next => setData(d => ({ ...d, org: next }))}
        />
      ) : null}
      <DeleteAccountCard email={me.user?.email || ''} />
    </div>
  );
}

function ProfileCard({ me, onSaved }: { me: MePage; onSaved: (user: MePage['user']) => void }) {
  const [first, setFirst] = useState(me.user?.firstName || '');
  const [last, setLast] = useState(me.user?.lastName || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const email = me.user?.email || '';
  const changed =
    first.trim() !== (me.user?.firstName || '') || last.trim() !== (me.user?.lastName || '');
  const label = [first, last].filter(Boolean).join(' ') || email;

  const save = async () => {
    setStatus('saving');
    setError('');
    try {
      const page = await flowJson<{ user?: MePage['user'] }>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: first.trim(), lastName: last.trim() }),
      });
      onSaved(page.user || { ...me.user, firstName: first.trim(), lastName: last.trim() });
      setStatus('saved');
    } catch (err) {
      setError(errorText(err, 'Your name was not saved.'));
      setStatus('idle');
    }
  };

  return (
    <section className="st-card st-section">
      <header className="st-section-head">
        <h2 className="st-section-title">Profile</h2>
        <p className="st-section-sub">How you appear to people you share projects with.</p>
      </header>
      <div className="st-section-body">
        <PersonMark label={label} size="lg" />
        <div className="st-field-row">
          <label className="st-field">
            <span>First name</span>
            <Input
              value={first}
              onChange={event => {
                setFirst(event.target.value);
                setStatus('idle');
              }}
              autoComplete="given-name"
            />
          </label>
          <label className="st-field">
            <span>Last name</span>
            <Input
              value={last}
              onChange={event => {
                setLast(event.target.value);
                setStatus('idle');
              }}
              autoComplete="family-name"
            />
          </label>
        </div>
        <label className="st-field">
          <span>Email</span>
          <Input value={email} readOnly className="st-readonly" />
          <small>You sign in with a code sent here. Contact us to change it.</small>
        </label>
      </div>
      <footer className="st-section-foot">
        {error ? <span className="flow-error">{error}</span> : null}
        {status === 'saved' && !changed ? <span className="st-note">Saved</span> : null}
        <Button
          className="st-btn primary"
          type="button"
          disabled={!changed || status === 'saving'}
          onClick={save}
        >
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </Button>
      </footer>
    </section>
  );
}

function DefaultsCard({
  org,
  canEdit,
  onSaved,
}: {
  org: Org;
  canEdit: boolean;
  onSaved: (org: Org) => void;
}) {
  const [level, setLevel] = useState(alphaToLevel(org.comparison_alpha));
  const [base, setBase] = useState(String(org.low_base_threshold ?? 30));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = async (body: Record<string, number>) => {
    setError('');
    setNote('');
    try {
      const page = await flowJson<{ organization?: Org }>(`/api/organizations/${org.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      onSaved(page.organization || { ...org, ...body });
      setNote('Saved');
    } catch (err) {
      setError(errorText(err, 'That setting was not saved.'));
    }
  };

  const saveBase = () => {
    const value = Number(base);
    if (!Number.isInteger(value) || value < 1 || value > 500) {
      setError('Use a whole number from 1 to 500.');
      return;
    }
    if (value !== (org.low_base_threshold ?? 30)) void save({ low_base_threshold: value });
  };

  return (
    <section className="st-card st-section">
      <header className="st-section-head">
        <h2 className="st-section-title">Analysis defaults</h2>
        <p className="st-section-sub">
          {canEdit
            ? 'Used when the agent tests significance and checks bases in this workspace.'
            : 'Used when the agent tests significance and checks bases. Your workspace owner sets these.'}
        </p>
      </header>
      <div className="st-line">
        <div>
          <p className="st-line-title">Significance level</p>
          <p className="st-line-sub">Confidence the agent uses for column tests</p>
        </div>
        <ChoiceSelect
          className="st-select"
          aria-label="Significance level"
          value={level}
          options={LEVELS}
          disabled={!canEdit}
          onValueChange={value => {
            setLevel(value);
            void save({ comparison_alpha: levelToAlpha(value) });
          }}
        />
      </div>
      <div className="st-line">
        <div>
          <p className="st-line-title">Low base warning</p>
          <p className="st-line-sub">Flag columns under this base</p>
        </div>
        <Input
          className="st-number"
          aria-label="Low base warning"
          inputMode="numeric"
          value={base}
          disabled={!canEdit}
          onChange={event => setBase(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={saveBase}
          onKeyDown={event => {
            if (event.key === 'Enter') saveBase();
          }}
        />
      </div>
      {error || note ? (
        <p className={error ? 'st-line-status flow-error' : 'st-line-status st-note'}>
          {error || note}
        </p>
      ) : null}
    </section>
  );
}

function DeleteAccountCard({ email }: { email: string }) {
  const { handleLogout } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && Boolean(email);

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await flowJson('/api/me', { method: 'DELETE' });
      await handleLogout();
    } catch (err) {
      setError(errorText(err, 'Your account was not deleted.'));
      setBusy(false);
    }
  };

  return (
    <div className="st-card st-rowcard">
      <div className="st-rowcard-text">
        <p className="st-row-title">Delete account</p>
        <p className="st-row-sub">
          Deletes the files you own and cancels your plan straight away. Files in shared workspaces
          stay with that workspace.
        </p>
      </div>
      <Button className="st-btn danger" type="button" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (busy) return;
          setOpen(next);
          setTyped('');
          setError('');
        }}
      >
        <DialogContent className="st-dialog">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your own files and projects are deleted now and your plan is cancelled. This can’t be
              undone. Type your email to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Your email"
            placeholder={email}
            value={typed}
            onChange={event => setTyped(event.target.value)}
          />
          {error ? <p className="flow-error">{error}</p> : null}
          <DialogFooter className="st-dialog-foot">
            <Button className="st-btn" type="button" disabled={busy} onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button
              className="st-btn danger-solid"
              type="button"
              disabled={!matches || busy}
              onClick={remove}
            >
              {busy ? 'Deleting…' : 'Delete account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
