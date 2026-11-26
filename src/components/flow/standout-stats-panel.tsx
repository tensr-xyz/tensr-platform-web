'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

export type StandoutStatItem = {
  theme?: string;
  audience_percent?: number;
  index?: number;
  subject?: string;
  percent_label?: string;
  index_phrase?: string;
  line?: string;
  low_base?: boolean;
  significant?: boolean;
  stub_label?: string;
  row_label?: string;
};

export type StandoutThemeGroup = {
  theme: string;
  stats: StandoutStatItem[];
};

export type StandoutPanelData = {
  themes: StandoutThemeGroup[];
  lead?: string;
  audience_label?: string;
  audience_definition?: string;
  audience_n?: number;
  comparison_label?: string;
  weight_phrase?: string;
  n_stats?: number;
  n_above_average?: number;
  low_base_mark?: number;
  min_base?: number;
};

/** Format index as Paper 14a "2.7× the average". */
export function formatStandoutIndexPhrase(index: number | undefined, fallback = ''): string {
  if (typeof index !== 'number' || !Number.isFinite(index) || index <= 0) {
    return fallback;
  }
  const multiple = Math.abs(index / 100);
  const text =
    Math.abs(multiple - Math.round(multiple)) < 0.05
      ? `${Math.round(multiple)}`
      : multiple.toFixed(1);
  return `${text}× the average`;
}

function percentLabel(stat: StandoutStatItem): string {
  if (stat.percent_label && String(stat.percent_label).trim()) {
    return String(stat.percent_label).trim();
  }
  if (typeof stat.audience_percent === 'number' && Number.isFinite(stat.audience_percent)) {
    return `${Math.round(stat.audience_percent)}%`;
  }
  return '';
}

function subjectLine(stat: StandoutStatItem): string {
  const subject = String(stat.subject || '').trim();
  if (subject) return subject;
  const line = String(stat.line || '').trim();
  if (!line) return String(stat.row_label || stat.stub_label || '').trim();
  // Strip leading share / percent and trailing index from the plain line.
  return line
    .replace(/^(?:Half|A quarter|A third|Two thirds|Three quarters|\d+%)\s+/i, '')
    .replace(/\s*\(\d+%\)\s*,\s*[\d.]+x the average\.?$/i, '')
    .replace(/,\s*[\d.]+x the average\.?$/i, '')
    .trim();
}

function indexLine(stat: StandoutStatItem): string {
  const phrase = String(stat.index_phrase || '').trim();
  if (phrase) {
    // Engine stamps "2.7x the average"; Paper 14a shows a multiplication sign.
    return phrase.replace(/x(?=\s+the average)/gi, '×');
  }
  return formatStandoutIndexPhrase(stat.index);
}

function metaLine(panel: StandoutPanelData): string {
  const audience = (panel.audience_label || 'Audience').trim();
  const comparison = (panel.comparison_label || 'all respondents').trim();
  const vs = comparison.toLowerCase() === 'total' ? 'all respondents' : comparison;
  const bits = [`${audience} vs ${vs}`];
  if (typeof panel.audience_n === 'number' && Number.isFinite(panel.audience_n)) {
    bits.push(`n = ${panel.audience_n.toLocaleString('en-GB')}`);
  }
  const weight = String(panel.weight_phrase || '')
    .replace(/\.$/, '')
    .trim();
  if (weight) bits.push(weight);
  return bits.join(' · ');
}

/** Paper 14a · themed standout stats answer in chat. */
export function StandoutStatsPanel({
  panel,
  onAddProfileSlide,
  onCompare,
}: {
  panel: StandoutPanelData;
  onAddProfileSlide?: () => void;
  onCompare?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const themes = useMemo(() => {
    const groups = (panel.themes || []).filter(
      group => group && Array.isArray(group.stats) && group.stats.length
    );
    if (showAll) return groups;
    // Default card: up to 3 themes, a few stats each (matches the artboard density).
    return groups.slice(0, 3).map(group => ({
      ...group,
      stats: group.stats.slice(0, 3),
    }));
  }, [panel.themes, showAll]);
  const above = panel.n_above_average ?? panel.n_stats ?? 0;
  const lowMark = panel.low_base_mark ?? 100;
  const minBase = panel.min_base ?? 50;
  const rules =
    `Only answers significantly above the average at 95% are shown, ranked by index within each theme. ` +
    `Themes come from the questionnaire. Items in a set use the item label, never the question stem. ` +
    `Answers with an audience base under ${minBase} are dropped; under ${lowMark} marked “low base”.`;

  if (!themes.length) return null;

  return (
    <div className="standout-stats-panel" data-testid="standout-stats-panel">
      <div className="standout-stats-themes">
        {themes.map(group => (
          <div key={group.theme} className="standout-stats-theme">
            <h3 className="standout-stats-theme-title">{group.theme}</h3>
            <div className="standout-stats-list">
              {group.stats.map((stat, index) => {
                const pct = percentLabel(stat);
                const subject = subjectLine(stat);
                const lift = indexLine(stat);
                return (
                  <div
                    key={`${group.theme}-${pct}-${subject}-${index}`}
                    className="standout-stats-item"
                  >
                    {pct ? <div className="standout-stats-percent">{pct}</div> : null}
                    {subject ? <div className="standout-stats-subject">{subject}</div> : null}
                    {lift ? <div className="standout-stats-index">{lift}</div> : null}
                    {stat.low_base ? <div className="standout-stats-low-base">low base</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="standout-stats-footer">
        <p className="standout-stats-rules">{rules}</p>
        <div className="standout-stats-actions">
          <Button
            type="button"
            className="flow-btn standout-stats-action"
            onClick={() => onAddProfileSlide?.()}
            disabled={!onAddProfileSlide}
          >
            Add profile slide to deck
          </Button>
          <Button
            type="button"
            className="flow-btn standout-stats-action"
            onClick={() => setShowAll(open => !open)}
          >
            {showAll
              ? 'Show top standouts'
              : `Show all ${above > 0 ? above : ''} above average`.replace(/\s+/g, ' ').trim()}
          </Button>
          <Button
            type="button"
            className="flow-btn standout-stats-action"
            onClick={() => onCompare?.()}
            disabled={!onCompare}
          >
            Compare with another audience
          </Button>
        </div>
      </div>
    </div>
  );
}

export function standoutMetaLine(panel: StandoutPanelData): string {
  return metaLine(panel);
}
