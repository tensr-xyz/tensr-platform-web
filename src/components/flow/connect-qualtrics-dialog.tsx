'use client';

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { PERSONAL_ACCOUNT_KEY } from '@/lib/active-organisation';
import {
  listQualtricsSurveys,
  pullQualtricsSurvey,
  requestSurveyConnector,
  type QualtricsPullResult,
  type QualtricsSurvey,
} from '@/lib/survey-connectors';

type Mode = 'qualtrics' | 'request';

export function ConnectQualtricsDialog({
  open,
  onOpenChange,
  onPulled,
  title = 'Connect Qualtrics',
  initialMode = 'qualtrics',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPulled: (result: QualtricsPullResult) => void | Promise<void>;
  title?: string;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [brandHost, setBrandHost] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [surveys, setSurveys] = useState<QualtricsSurvey[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [requestPlatform, setRequestPlatform] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setMode(initialMode);
    setBrandHost('');
    setApiToken('');
    setSurveys([]);
    setSurveyId('');
    setRequestPlatform('');
    setRequestNote('');
    setBusy(false);
    setMessage('');
    setError('');
  };

  const loadSurveys = async () => {
    const token = getStytchBearerForTensrApi();
    if (!token) {
      setError('Sign in again to connect Qualtrics.');
      return;
    }
    if (!brandHost.trim() || !apiToken.trim()) {
      setError('Enter the brand host and API token first.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const rows = await listQualtricsSurveys(token, brandHost.trim(), apiToken.trim());
      setSurveys(rows);
      setSurveyId(rows[0]?.id || '');
      if (!rows.length) setError('No surveys were returned for this token.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qualtrics could not list surveys.');
    } finally {
      setBusy(false);
    }
  };

  const pull = async () => {
    const token = getStytchBearerForTensrApi();
    if (!token) {
      setError('Sign in again to connect Qualtrics.');
      return;
    }
    if (!brandHost.trim() || !apiToken.trim() || !surveyId.trim()) {
      setError('Enter the brand host, API token, and survey.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const match = surveys.find(row => row.id === surveyId);
      const orgId =
        typeof window !== 'undefined' ? localStorage.getItem('activeOrganizationId') : null;
      const scope = orgId && orgId !== PERSONAL_ACCOUNT_KEY ? 'team' : 'personal';
      const result = await pullQualtricsSurvey(token, {
        brandHost: brandHost.trim(),
        apiToken: apiToken.trim(),
        surveyId: surveyId.trim(),
        surveyName: match?.name,
        scope,
      });
      await onPulled(result);
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qualtrics pull failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async () => {
    const token = getStytchBearerForTensrApi();
    if (!token) {
      setError('Sign in again to send a request.');
      return;
    }
    if (!requestPlatform.trim()) {
      setError('Say which survey platform you need.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const out = await requestSurveyConnector(token, requestPlatform.trim(), requestNote.trim());
      setMessage(out.message || 'Request sent.');
      setRequestPlatform('');
      setRequestNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request did not send.');
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
      <DialogContent className="sources-connect-dialog">
        <DialogHeader>
          <DialogTitle>{mode === 'qualtrics' ? title : 'Request a connector'}</DialogTitle>
          <DialogDescription>
            {mode === 'qualtrics'
              ? 'Pull responses and labels with a Qualtrics API token. Tensr does not store the token.'
              : 'Tell us which survey platform to add next. We use these requests to decide the order.'}
          </DialogDescription>
        </DialogHeader>

        <div className="sources-connect-tabs">
          <Button
            type="button"
            className="flow-btn"
            data-active={mode === 'qualtrics'}
            onClick={() => {
              setMode('qualtrics');
              setError('');
              setMessage('');
            }}
          >
            Qualtrics
          </Button>
          <Button
            type="button"
            className="flow-btn"
            data-active={mode === 'request'}
            onClick={() => {
              setMode('request');
              setError('');
              setMessage('');
            }}
          >
            Request another
          </Button>
        </div>

        {mode === 'qualtrics' ? (
          <div className="sources-connect-fields">
            <label className="new-project-field">
              <span>Brand host</span>
              <Input
                value={brandHost}
                onChange={event => setBrandHost(event.target.value)}
                aria-label="Qualtrics brand host"
                placeholder="acme.qualtrics.com"
                autoComplete="off"
              />
            </label>
            <label className="new-project-field">
              <span>API token</span>
              <Input
                type="password"
                value={apiToken}
                onChange={event => setApiToken(event.target.value)}
                aria-label="Qualtrics API token"
                placeholder="Paste your Qualtrics API token"
                autoComplete="off"
              />
            </label>
            <div className="flow-row">
              <Button
                className="flow-btn"
                type="button"
                disabled={busy}
                onClick={() => void loadSurveys()}
              >
                {busy && !surveys.length ? 'Listing…' : 'List surveys'}
              </Button>
            </div>
            {surveys.length ? (
              <label className="new-project-field">
                <span>Survey</span>
                <ChoiceSelect
                  aria-label="Qualtrics survey"
                  value={surveyId}
                  onValueChange={setSurveyId}
                  options={surveys.map(row => ({ value: row.id, label: row.name }))}
                />
              </label>
            ) : (
              <label className="new-project-field">
                <span>Survey id</span>
                <Input
                  value={surveyId}
                  onChange={event => setSurveyId(event.target.value)}
                  aria-label="Qualtrics survey id"
                  placeholder="SV_…"
                  autoComplete="off"
                />
              </label>
            )}
            <div className="flow-row">
              <Button
                className="flow-btn primary"
                type="button"
                disabled={busy}
                onClick={() => void pull()}
              >
                {busy ? 'Pulling…' : 'Pull into project'}
              </Button>
              <Button className="flow-btn" type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="sources-connect-fields">
            <label className="new-project-field">
              <span>Platform</span>
              <Input
                value={requestPlatform}
                onChange={event => setRequestPlatform(event.target.value)}
                aria-label="Survey platform to request"
                placeholder="SurveyMonkey, Forsta, Alchemer…"
              />
            </label>
            <label className="new-project-field">
              <span>Note (optional)</span>
              <Textarea
                value={requestNote}
                onChange={event => setRequestNote(event.target.value)}
                aria-label="Connector request note"
                placeholder="What you need from the connection"
              />
            </label>
            <div className="flow-row">
              <Button
                className="flow-btn primary"
                type="button"
                disabled={busy}
                onClick={() => void submitRequest()}
              >
                {busy ? 'Sending…' : 'Send request'}
              </Button>
              <Button className="flow-btn" type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
        {message ? <p className="flow-muted">{message}</p> : null}
        {error ? <p className="flow-error">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
