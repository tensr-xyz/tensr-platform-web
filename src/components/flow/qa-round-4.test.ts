import { fileCounts } from './column-spark';
import { memberInitials, recentProjects, uniqueFolderName } from './flow-shell';
import { outputCounts, type OutputRun } from './report-output-runs';
import { settingsSection } from './settings-screen';
import {
  scaleCodesFromValues,
  splitColumns,
  tableWeightChoices,
  themeRows,
} from './survey-screens';

describe('QA round 4', () => {
  it('3: Tables offers every weight column and finds top 2 codes in the file', () => {
    expect(tableWeightChoices(['weight', 'wt'], '')).toEqual(['weight', 'wt']);
    expect(tableWeightChoices(['weight'], 'weight')).toEqual(['weight']);
    expect(scaleCodesFromValues(['1', '2', '3', '4', '5'], 'top')).toEqual(['4', '5']);
    expect(scaleCodesFromValues(['1', '2', '3', '4', '5'], 'bottom')).toEqual(['1', '2']);
    expect(scaleCodesFromValues(['Yes', 'No'], 'top')).toEqual([]);
  });

  it('4: themes sort by count and uncoded answers are their own row', () => {
    const cell = (n: number) => ({ banner_id: 'total', unweighted_n: n, column_unweighted_n: 100 });
    const rows = themeRows(
      [
        { id: 'a', label: 'Price', cells: [cell(10)] },
        { id: 'b', label: 'Service', cells: [cell(40)] },
      ] as never,
      42
    );
    expect(rows.map(row => row.label)).toEqual(['Service', 'Price', 'Not yet coded']);
    const last = rows[2].cells?.[0] as { percent?: number };
    expect(last.percent).toBe(42);
  });

  it('5: the Variable panel reads whole-file counts with value labels', () => {
    expect(
      fileCounts({ counts: { '1': 270, '2': 630 }, value_labels: { '1': 'South', '2': 'North' } })
    ).toEqual([
      { label: 'North', count: 630 },
      { label: 'South', count: 270 },
    ]);
  });

  it('6: All outputs equals Saved plus Draft, without duplicates', () => {
    const run = (id: string, status: string) =>
      ({ id, title: id, op: 'x', created_at: '', status }) as OutputRun;
    const tally = outputCounts(
      [run('a', 'complete'), run('a', 'complete'), run('b', 'complete'), run('c', 'running')],
      new Set(['b'])
    );
    expect(tally.all).toBe(3);
    const by = Object.fromEntries(tally.counts.map(item => [item.status, item.count]));
    expect(by).toEqual({ Saved: 2, 'In report': 1, Draft: 1 });
    expect(by.Saved + by.Draft).toBe(tally.all);
  });

  it('8: a folder name already taken gets a number', () => {
    expect(uniqueFolderName('New folder', [{ name: 'New folder' }])).toBe('New folder 2');
    expect(uniqueFolderName('Trackers', [{ name: 'trackers' }, { name: 'Trackers 2' }])).toBe(
      'Trackers 3'
    );
    expect(uniqueFolderName('Fresh', [])).toBe('Fresh');
  });

  it('9: settings sections fall back to Account', () => {
    expect(settingsSection('billing')).toBe('billing');
    expect(settingsSection('nope')).toBe('general');
  });

  it('12: initials come from the name or email, not the id', () => {
    expect(memberInitials('oliverdarby99@gmail.com')).toBe('OL');
    expect(memberInitials('Ollie Darby')).toBe('OD');
    expect(memberInitials('ollie.darby@tensr.xyz')).toBe('OD');
    expect(memberInitials('')).toBe('·');
  });

  it('4/15: Split by leaves out ids, open ends and the theme', () => {
    const columns = [
      { name: 'respondent_id', label: 'Respondent id', type: 'numeric' },
      { name: 'region', label: 'Region', type: 'string', measure: 'nominal' },
      { name: 'why', label: 'Why', type: 'string', measure: 'open_end' },
      { name: 'why_codes', label: 'Codes for Why', type: 'string' },
    ];
    const names = splitColumns(columns, 'why_codes').map(column => column.name);
    expect(names).toEqual(['region']);
  });

  it('4: switcher still caps recent projects', () => {
    const projects = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      name: `P${index}`,
      updated_at: `2026-01-${String(index + 1).padStart(2, '0')}`,
    }));
    expect(recentProjects(projects, '', 8)).toHaveLength(8);
  });
});

describe('QA round 4 deliverables', () => {
  it('calls the pipeline export where the API mounts it', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    const dir = 'src/components/flow';
    const wrong = fs
      .readdirSync(dir)
      .filter((name: string) => /\.tsx?$/.test(name) && !name.includes('.test.'))
      .filter((name: string) =>
        /[`'"]\/reports\/pipeline\/export/.test(fs.readFileSync(`${dir}/${name}`, 'utf8'))
      );
    expect(wrong).toEqual([]);
  });
});
