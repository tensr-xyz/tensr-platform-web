'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceSelect } from '@/components/ui/select';
import {
  MCC_OPTIONS,
  MEANS_POST_HOC_OPTIONS,
  type TableSignificanceSettings,
} from '@/lib/table-significance';

/** Right-hand significance options for the Tables screen (Paper 9b). */
export function TableSignificancePanel({
  settings,
  onChange,
  controlOptions,
}: {
  settings: TableSignificanceSettings;
  onChange: (next: TableSignificanceSettings) => void;
  controlOptions: { value: string; label: string }[];
}) {
  const set = (patch: Partial<TableSignificanceSettings>) => onChange({ ...settings, ...patch });
  const dunnett = settings.meansPostHoc === 'dunnett';

  return (
    <aside className="tables-sig-panel" aria-label="Significance">
      <h3 className="tables-sig-title">Significance</h3>

      <div className="tables-sig-field">
        <span className="tables-sig-label">Show as</span>
        <div className="tables-sig-pills" role="group" aria-label="Show as">
          {(
            [
              ['letters', 'Letters'],
              ['arrows', 'Arrows vs total'],
              ['off', 'Off'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              className="tables-sig-pill"
              data-active={settings.showAs === value}
              aria-pressed={settings.showAs === value}
              onClick={() => set({ showAs: value })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="tables-sig-field">
        <span className="tables-sig-label">Confidence</span>
        <div className="tables-sig-pills" role="group" aria-label="Confidence">
          {([90, 95, 99] as const).map(value => (
            <Button
              key={value}
              type="button"
              className="tables-sig-pill"
              data-active={settings.confidence === value}
              aria-pressed={settings.confidence === value}
              onClick={() => set({ confidence: value })}
            >
              {value}%
            </Button>
          ))}
        </div>
      </div>

      <div className="tables-sig-field">
        <span className="tables-sig-label">Many columns at once</span>
        <ChoiceSelect
          className="tables-sig-select"
          aria-label="Many columns at once"
          value={settings.multipleComparison}
          onValueChange={value =>
            set({
              multipleComparison: value as TableSignificanceSettings['multipleComparison'],
            })
          }
          options={MCC_OPTIONS}
        />
        <span className="tables-sig-hint">None · Bonferroni · False discovery rate</span>
      </div>

      <div className="tables-sig-field">
        <span className="tables-sig-label">Comparing means</span>
        <ChoiceSelect
          className="tables-sig-select"
          aria-label="Comparing means"
          value={settings.meansPostHoc}
          onValueChange={value =>
            set({ meansPostHoc: value as TableSignificanceSettings['meansPostHoc'] })
          }
          options={MEANS_POST_HOC_OPTIONS}
        />
        <span className="tables-sig-hint">
          Tukey · Fisher LSD · Dunnett (vs a control) · Duncan · SNK
        </span>
      </div>

      <div className="tables-sig-field">
        <span className="tables-sig-label">Control group (Dunnett only)</span>
        <ChoiceSelect
          className="tables-sig-select"
          aria-label="Control group"
          value={dunnett ? settings.dunnettControl : ''}
          disabled={!dunnett}
          placeholder="Pick a column"
          onValueChange={value => set({ dunnettControl: value })}
          options={[{ value: '', label: 'Pick a column' }, ...controlOptions]}
        />
      </div>

      <label className="tables-sig-default">
        <Checkbox
          checked={settings.asProjectDefault}
          onCheckedChange={checked => set({ asProjectDefault: checked === true })}
        />
        <span>Make this the project default</span>
      </label>
    </aside>
  );
}
