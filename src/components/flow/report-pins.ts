'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { flowJson } from '@/lib/flow-api';
import { pinKey, type ReportPin } from '@/components/flow/run-document';

/** Report pins live on the run record. This store shares them across Report, Outputs, and Export. */

type ServerPin = {
  headline?: string;
  support?: string;
  citation?: string;
  after_id?: string;
  deck?: boolean;
  topline?: boolean;
  keep_live?: boolean;
  bars?: { label?: string; percent?: number }[];
};

export type RunSummary = {
  id?: string;
  dataset_id?: string;
  in_report?: boolean;
  report_pin?: ServerPin | null;
};

const inflight = new Map<string, Promise<unknown>>();

/** Collapse two callers that start the same read before the first one finishes. */
export function shareRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const promise = load().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

const store = new Map<string, ReportPin[]>();
const loaded = new Set<string>();
const listeners = new Set<() => void>();
const EMPTY: ReportPin[] = [];

function emit() {
  listeners.forEach(listener => listener());
}

export function pinsFromRuns(runs: RunSummary[]): ReportPin[] {
  return runs
    .filter(run => run.in_report && run.report_pin && run.id)
    .map(run => {
      const pin = run.report_pin as ServerPin;
      return {
        id: `pin-${run.id}`,
        runId: String(run.id),
        datasetId: String(run.dataset_id || ''),
        headline: pin.headline || '',
        support: pin.support || '',
        citation: pin.citation || '',
        afterId: pin.after_id || 'end',
        deck: pin.deck !== false,
        topline: pin.topline !== false,
        keepLive: pin.keep_live !== false,
        bars: Array.isArray(pin.bars)
          ? pin.bars
              .filter(bar => bar && typeof bar.label === 'string')
              .map(bar => ({ label: String(bar.label), percent: Number(bar.percent) || 0 }))
          : [],
      };
    });
}

const runCache = new Map<string, RunSummary[]>();

export function rememberReportRuns(projectId: string, runs: RunSummary[]) {
  runCache.set(projectId, runs);
}

export function cachedReportRuns(projectId: string): RunSummary[] | null {
  if (!runCache.has(projectId)) return null;
  return runCache.get(projectId) || [];
}

export function setProjectPins(projectId: string, pins: ReportPin[]) {
  store.set(projectId, pins);
  loaded.add(projectId);
  emit();
}

export function projectPins(projectId: string): ReportPin[] {
  return store.get(projectId) || EMPTY;
}

function legacyPins(projectId: string): ReportPin[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pinKey(projectId)) || '[]') as unknown;
    return Array.isArray(parsed) ? (parsed as ReportPin[]) : [];
  } catch {
    return [];
  }
}

function serverBody(pin: ReportPin): ServerPin {
  return {
    headline: pin.headline,
    support: pin.support,
    citation: pin.citation,
    after_id: pin.afterId,
    deck: pin.deck,
    topline: pin.topline,
    keep_live: pin.keepLive,
    bars: (pin.bars || []).map(bar => ({ label: bar.label, percent: bar.percent })),
  };
}

/** Load the pins for a project's files. Pins saved in this browser before are uploaded once. */
export async function loadProjectPins(projectId: string, fileIds: string[]): Promise<ReportPin[]> {
  const pages = await Promise.all(
    fileIds.map(id =>
      flowJson<{ runs?: RunSummary[] }>(`/datasets/${id}/runs`)
        .then(page => page.runs || [])
        .catch(() => [] as RunSummary[])
    )
  );
  const runs = pages.flat();
  let pins = pinsFromRuns(runs);
  const legacy = legacyPins(projectId).filter(pin => !pins.some(item => item.runId === pin.runId));
  if (legacy.length) {
    const datasetOf = new Map(runs.map(run => [String(run.id), String(run.dataset_id || '')]));
    const moved = await Promise.all(
      legacy.map(async pin => {
        const datasetId = datasetOf.get(pin.runId);
        if (!datasetId) return null;
        try {
          await flowJson(`/datasets/${datasetId}/analysis-runs/${pin.runId}/report-pin`, {
            method: 'PUT',
            body: JSON.stringify(serverBody(pin)),
          });
          return { ...pin, datasetId };
        } catch {
          return null;
        }
      })
    );
    pins = [...pins, ...(moved.filter(Boolean) as ReportPin[])];
    try {
      window.localStorage.removeItem(pinKey(projectId));
    } catch {
      // Storage can be unavailable; the server copy is what counts.
    }
  }
  setProjectPins(projectId, pins);
  return pins;
}

export async function savePin(projectId: string, datasetId: string, pin: ReportPin) {
  await flowJson(`/datasets/${datasetId}/analysis-runs/${pin.runId}/report-pin`, {
    method: 'PUT',
    body: JSON.stringify(serverBody(pin)),
  });
  setProjectPins(projectId, [
    ...projectPins(projectId).filter(item => item.runId !== pin.runId),
    { ...pin, datasetId },
  ]);
}

export async function clearPin(projectId: string, datasetId: string, runId: string) {
  await flowJson(`/datasets/${datasetId}/analysis-runs/${runId}/report-pin`, { method: 'DELETE' });
  setProjectPins(
    projectId,
    projectPins(projectId).filter(item => item.runId !== runId)
  );
}

/** Pins for a project, loaded once per project and shared by every screen. */
export function useProjectPins(projectId: string, fileIds: string[]): ReportPin[] {
  const key = fileIds.join('|');
  useEffect(() => {
    if (!projectId || loaded.has(projectId) || !key) return;
    loaded.add(projectId);
    void loadProjectPins(projectId, key.split('|'));
  }, [projectId, key]);
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => projectPins(projectId),
    () => EMPTY
  );
}
