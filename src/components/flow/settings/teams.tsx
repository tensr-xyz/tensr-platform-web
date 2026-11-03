'use client';

import { useState } from 'react';
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
import { Skeleton } from '@/components/ui/rest';
import { PersonMark, SettingsError } from './parts';
import { errorText, parseInviteEmails, personFromApi, type Person } from './settings-data';
import { useLoad } from './use-load';

export type Team = { id: string; name: string; role: string; people: Person[] };

type TeamRow = { id?: string; name?: string; role?: string };

async function loadTeams(): Promise<{ teams: Team[]; activeId: string; selfId: string }> {
  const [page, me] = await Promise.all([
    flowJson<{ teams?: TeamRow[]; active_team_id?: string }>('/api/teams'),
    flowJson<{ user?: { id?: string } }>('/api/me'),
  ]);
  const rows = (page.teams || []).filter(row => row.id);
  const teams = await Promise.all(
    rows.map(async row => {
      const members = await flowJson<{ members?: Record<string, unknown>[] }>(
        `/api/teams/${row.id}/members`
      )
        .then(res => (res.members || []).map(personFromApi))
        .catch(() => [] as Person[]);
      return {
        id: String(row.id),
        name: String(row.name || 'Team'),
        role: String(row.role || 'member'),
        people: members,
      };
    })
  );
  return { teams, activeId: page.active_team_id || '', selfId: me.user?.id || '' };
}

/** Selected team first: the one in the URL state, else the active workspace, else the first. */
export function pickTeam(teams: Team[], chosen: string, activeId: string): Team | null {
  return (
    teams.find(team => team.id === chosen) ||
    teams.find(team => team.id === activeId) ||
    teams[0] ||
    null
  );
}

/**
 * 7f. In the API a team is a shared workspace (an organisation that is not personal), so this
 * lists the team workspaces you belong to and their people.
 */
export function SettingsTeams() {
  const { state, retry, reload } = useLoad(loadTeams, []);
  const [chosen, setChosen] = useState('');
  const [dialog, setDialog] = useState<'new' | 'rename' | 'add' | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (state.phase === 'loading') {
    return (
      <div className="st-teams" aria-busy="true">
        <div className="st-team-list">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="st-card st-skeleton st-team-panel">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }
  if (state.phase === 'error') return <SettingsError message={state.error} onRetry={retry} />;

  const { teams, activeId, selfId } = state.data;
  const team = pickTeam(teams, chosen, activeId);
  const isOwner = team?.role === 'owner';

  const open = (kind: 'new' | 'rename' | 'add') => {
    setText(kind === 'rename' ? team?.name || '' : '');
    setError('');
    setDialog(kind);
  };

  const act = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await work();
      setDialog(null);
      await reload();
    } catch (err) {
      setError(errorText(err, 'That did not go through.'));
    } finally {
      setBusy('');
    }
  };

  const submit = () => {
    if (dialog === 'new') {
      void act('new', async () => {
        const page = await flowJson<{ team?: { id?: string } }>('/api/teams', {
          method: 'POST',
          body: JSON.stringify({ name: text.trim() }),
        });
        if (page.team?.id) setChosen(page.team.id);
      });
    } else if (dialog === 'rename' && team) {
      void act('rename', async () => {
        await flowJson(`/api/teams/${team.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: text.trim() }),
        });
      });
    } else if (dialog === 'add' && team) {
      const { valid, invalid } = parseInviteEmails(text);
      if (invalid.length) {
        setError(`Check ${invalid.join(', ')}. That isn’t an email address.`);
        return;
      }
      void act('add', async () => {
        for (const email of valid) {
          await flowJson(`/api/teams/${team.id}/members`, {
            method: 'POST',
            body: JSON.stringify({ email, role: 'member' }),
          });
        }
      });
    }
  };

  return (
    <div className="st-teams">
      <div className="st-team-list">
        <div className="st-team-list-head">
          <span>
            {teams.length} {teams.length === 1 ? 'team' : 'teams'}
          </span>
          <Button className="st-btn small" type="button" onClick={() => open('new')}>
            + New team
          </Button>
        </div>
        {teams.map(item => (
          <Button
            key={item.id}
            className="st-team-item"
            type="button"
            data-active={item.id === team?.id || undefined}
            onClick={() => setChosen(item.id)}
          >
            <span className="st-team-name">{item.name}</span>
            <span className="st-row-sub">
              {item.people.length} {item.people.length === 1 ? 'person' : 'people'}
              {item.id === activeId ? ' · this workspace' : ''}
            </span>
          </Button>
        ))}
        {!teams.length ? (
          <p className="st-note st-team-empty">
            You are not in a team yet. A team is a shared workspace with its own projects and
            people.
          </p>
        ) : null}
      </div>

      {team ? (
        <section className="st-card st-team-panel">
          <header className="st-team-panel-head">
            <div>
              <h2 className="st-section-title">{team.name}</h2>
              <p className="st-row-sub">
                Everyone here can open the projects in this team’s workspace.
              </p>
            </div>
            {isOwner ? (
              <div className="st-actions">
                <Button className="st-btn" type="button" onClick={() => open('rename')}>
                  Rename
                </Button>
                <Button className="st-btn primary" type="button" onClick={() => open('add')}>
                  Add people
                </Button>
              </div>
            ) : null}
          </header>
          <div className="st-band">People</div>
          {team.people.map(person => (
            <div key={person.userId} className="st-team-person">
              <div className="st-person">
                <PersonMark label={person.name || person.email} />
                <span>
                  {person.name}
                  {person.userId === selfId ? <span className="st-muted"> (you)</span> : null}
                  {person.role === 'owner' ? <span className="st-muted"> · Owner</span> : null}
                </span>
              </div>
              {isOwner && person.userId !== selfId ? (
                <Button
                  className="st-link"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void act(`remove-${person.userId}`, async () => {
                      await flowJson(`/api/teams/${team.id}/members/${person.userId}`, {
                        method: 'DELETE',
                      });
                    })
                  }
                >
                  {busy === `remove-${person.userId}` ? 'Removing…' : 'Remove'}
                </Button>
              ) : null}
            </div>
          ))}
          {error && !dialog ? <p className="flow-error st-team-error">{error}</p> : null}
        </section>
      ) : null}

      <Dialog
        open={dialog !== null}
        onOpenChange={next => (!next && !busy ? setDialog(null) : null)}
      >
        <DialogContent className="st-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'new' ? 'New team' : dialog === 'rename' ? 'Rename team' : 'Add people'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'new'
                ? 'A team gets its own workspace for projects and people. You can switch to it from the sidebar.'
                : dialog === 'rename'
                  ? 'Everyone in the team sees this name.'
                  : 'Enter emails, separated by commas. People without an account get an invite and join when they sign in.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label={dialog === 'add' ? 'Emails' : 'Team name'}
            placeholder={dialog === 'add' ? 'name@company.com' : 'Team name'}
            value={text}
            onChange={event => setText(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') submit();
            }}
          />
          {error ? <p className="flow-error">{error}</p> : null}
          <DialogFooter className="st-dialog-foot">
            <Button
              className="st-btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
            <Button
              className="st-btn primary"
              type="button"
              disabled={Boolean(busy) || (dialog === 'add' ? !text.trim() : text.trim().length < 2)}
              onClick={submit}
            >
              {busy
                ? 'Saving…'
                : dialog === 'new'
                  ? 'Create team'
                  : dialog === 'rename'
                    ? 'Save'
                    : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
