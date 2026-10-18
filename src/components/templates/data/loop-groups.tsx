'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { confirmLoop, fetchLoopMetadata, renameLoop } from '@/lib/custom-tables/api';
import { loopMemberNames, loopProposalSentence, type LoopDefinition } from '@/lib/custom-tables/loops';
import { getSessionJwt } from '@/utils/auth';

type LoopGroupsProps = {
  datasetId?: string;
  onMembers?: (names: string[]) => void;
  onChange?: () => void;
};

export function LoopGroups({ datasetId, onMembers, onChange }: LoopGroupsProps) {
  const [proposals, setProposals] = useState<LoopDefinition[]>([]);
  const [loops, setLoops] = useState<LoopDefinition[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!datasetId) return;
    const token = getSessionJwt();
    if (!token) return;
    const meta = await fetchLoopMetadata(datasetId, token);
    const nextProposals = meta.loop_proposals || [];
    const nextLoops = meta.loops || [];
    setProposals(nextProposals);
    setLoops(nextLoops);
    onMembers?.(loopMemberNames([...nextProposals, ...nextLoops]));
    setError('');
  }, [datasetId, onMembers]);

  useEffect(() => {
    if (!datasetId) {
      onMembers?.([]);
      return;
    }
    void load().catch(() => setError('Could not load loops'));
  }, [datasetId, load, onMembers]);

  if (!datasetId || (proposals.length === 0 && loops.length === 0 && !error)) return null;

  const confirm = async (loop: LoopDefinition) => {
    const token = getSessionJwt();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await confirmLoop(datasetId, loop.id, token);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm the loop');
    } finally {
      setBusy(false);
    }
  };

  const rename = async (loop: LoopDefinition, title: string) => {
    const next = title.trim();
    if (!next || next === (loop.item_title || 'Brand')) return;
    const token = getSessionJwt();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await renameLoop(datasetId, loop.id, next, token);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename the loop');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section role="region" aria-label="Loops" className="flex flex-col gap-2 px-2.5 py-2">
      {proposals.map(loop => (
        <div key={loop.id} className="flex flex-col gap-1 rounded-md border border-border px-2 py-2">
          <p className="text-xs">{loopProposalSentence(loop)}</p>
          {loop.partial ? (
            <p className="text-[11px] text-muted-foreground">Partial match. It stays a proposal.</p>
          ) : (
            <Button type="button" size="sm" disabled={busy} onClick={() => void confirm(loop)}>
              Confirm
            </Button>
          )}
        </div>
      ))}
      {loops.map(loop => (
        <div key={`${loop.id}-${loop.item_title || 'Brand'}`} className="flex flex-col gap-1 rounded-md border border-border px-2 py-2">
          <label className="flex items-center gap-2 text-xs">
            Brand label
            <Input
              aria-label="Brand label"
              className="h-7 w-28 text-xs"
              defaultValue={loop.item_title || 'Brand'}
              onBlur={event => void rename(loop, event.target.value)}
            />
          </label>
          <p className="text-[11px] text-muted-foreground">{(loop.stems || []).join(', ')}</p>
        </div>
      ))}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </section>
  );
}
