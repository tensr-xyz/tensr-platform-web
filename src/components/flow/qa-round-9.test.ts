import { tableBaseCopy } from './table-base';
import { codingVersionStatus, isCodingVersion, shouldAdoptCodingVersion } from './coding-versions';
import {
  applyScaleFlags,
  compareManyWaves,
  defaultStackDecision,
  overlapsAny,
} from './stack-waves';
import { loadBilling, loadInvoices, loadUsage, peekBilling } from './settings/billing-load';
import { settingsCache } from './settings/settings-cache';

const pending: { path: string; resolve: (value: unknown) => void }[] = [];
jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn((path: string) => new Promise(resolve => pending.push({ path, resolve }))),
}));

describe('QA round 9: shared table base', () => {
  test.each([
    [
      'weighted book',
      {
        base_label: 'base 120 weighted (unweighted 100)',
        weight: { weight_aware: true, weighted_n: 120, unweighted_n: 100 },
      },
    ],
    [
      'unweighted book',
      {
        base_label: 'Unweighted, n = 88',
        weight: { weight_aware: false, weighted_n: 88, unweighted_n: 88 },
        respondent_n: 88,
      },
    ],
    ['weight fields only', { weight: { weight_aware: true, weighted_n: 54.2, unweighted_n: 50 } }],
  ])('%s uses the engine base, not a separate unweighted count', (_name, book) => {
    const copy = tableBaseCopy(book);
    expect(copy.line.length).toBeGreaterThan(0);
    expect(copy.foot.length).toBeGreaterThan(0);
    if (book.weight?.weight_aware) {
      expect(copy.line.toLowerCase()).toContain('weighted');
      expect(copy.foot).toMatch(/weighted/i);
      expect(copy.foot).toContain(String(book.weight.unweighted_n));
      expect(copy.line).not.toMatch(/all respondents \(\d+, weighted\)/);
    } else {
      expect(copy.line).toMatch(/unweighted/i);
    }
  });
});

describe('QA round 9: stack opposite-end default', () => {
  test.each([
    ['means sit at opposite ends', 'Q7'],
    ['scale may run the other way', 'agree'],
    ['flagged for reverse', 'satisfaction'],
  ])('%s defaults to reverse, not stack together', (_phrase, column) => {
    const files = ['a', 'b'].map(id => ({
      name: id,
      columns: [{ name: column, value_labels: { '1': 'Low', '5': 'High' } }, { name: 'region' }],
    }));
    const rows = applyScaleFlags(
      compareManyWaves(files),
      [{ column, low: 1, high: 5, means: { a: 4.5, b: 1.4 }, flip_ids: ['b'] }],
      id => id
    );
    const flagged = rows.find(row => row.left === column)!;
    expect(flagged.scaleFlip).toEqual(['b']);
    expect(defaultStackDecision(flagged)).toBe('recode');
    expect(defaultStackDecision(rows.find(row => row.left === 'region')!)).toBe('accept');
  });
});

describe('QA round 9: stack overlap filter', () => {
  test('other-project files need shared columns before they appear', () => {
    const here = [{ name: 'region' }, { name: 'age' }, { name: 'brand' }];
    expect(overlapsAny([{ name: 'region' }, { name: 'age' }, { name: 'brand' }], [here])).toBe(
      true
    );
    expect(overlapsAny([{ name: 'sku' }, { name: 'price' }, { name: 'qty' }], [here])).toBe(false);
    expect(overlapsAny([{ name: 'sku' }, { name: 'price' }], [here])).toBe(false);
  });
});

describe('QA round 9: coding version in use', () => {
  const files = [
    {
      id: 'up',
      name: 'comments.sav',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'old',
      name: 'comments.sav',
      lineageLabel: 'coded comments',
      producingOperation: 'open_end_coding',
      parentId: 'up',
      originId: 'up',
      createdAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'new',
      name: 'comments.sav',
      lineageLabel: 'coded comments',
      producingOperation: 'open_end_coding',
      parentId: 'up',
      originId: 'up',
      createdAt: '2026-01-03T00:00:00Z',
    },
  ];

  test('flags a newer coding when an older coded file is in use', () => {
    expect(isCodingVersion(files[1])).toBe(true);
    expect(codingVersionStatus(files, 'old')).toEqual({
      inUseLabel: 'coded comments',
      newerAvailable: true,
    });
    expect(codingVersionStatus(files, 'new').newerAvailable).toBe(false);
  });

  test('Done only adopts when the new version is at least as new as the one in use', () => {
    expect(shouldAdoptCodingVersion('new', 'old', files)).toBe(false);
    expect(shouldAdoptCodingVersion('old', 'new', files)).toBe(true);
    expect(shouldAdoptCodingVersion(undefined, 'new', files)).toBe(true);
  });
});

describe('QA round 9: settings billing defers invoices', () => {
  beforeEach(() => {
    pending.length = 0;
    settingsCache.forget(() => true);
  });

  test('billing loads without Stripe invoices; invoices fetch when asked', async () => {
    const billing = loadBilling();
    const paths = pending.map(item => item.path).sort();
    expect(paths).toEqual(['/api/billing/plans', '/api/billing/subscription', '/api/me'].sort());
    expect(paths).not.toContain('/api/billing/invoices');
    pending.splice(0).forEach(item => {
      const answers: Record<string, unknown> = {
        '/api/me': { entitlements: { plan_code: 'pro' } },
        '/api/billing/subscription': { subscription: { tier: 'pro' } },
        '/api/billing/plans': { currency: 'gbp', plans: [] },
      };
      item.resolve(answers[item.path]);
    });
    await billing;
    expect(peekBilling()?.invoices).toBeUndefined();

    const invoices = loadInvoices();
    expect(pending.map(item => item.path)).toEqual(['/api/billing/invoices']);
    pending.splice(0).forEach(item => item.resolve({ invoices: [{ invoiceId: '1' }] }));
    await expect(invoices).resolves.toEqual([{ invoiceId: '1' }]);

    const usage = loadUsage();
    expect(pending.map(item => item.path).sort()).toEqual(
      ['/api/billing/usage', '/datasets/?scope=all'].sort()
    );
    pending.splice(0).forEach(item => {
      item.resolve(item.path.includes('usage') ? { usage: { reports: 1 } } : [{ n_rows: 3 }]);
    });
    await usage;
  });
});
