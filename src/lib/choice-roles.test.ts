import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  conjointBodyFromRoles,
  maxdiffAnalyzeBody,
  rolesFromSavedChoiceBody,
  suggestChoiceRoles,
} from './choice-roles';

describe('choice column roles', () => {
  it('maps qa_cbc_long.csv and treats other long-format columns as attributes', () => {
    const header = readFileSync(path.join(__dirname, 'fixtures', 'qa_cbc_long.csv'), 'utf8')
      .split(/\r?\n/, 1)[0]
      .split(',');
    const roles = suggestChoiceRoles(header);
    expect(roles).toEqual({
      respondent: 'respondent',
      task: 'task',
      alternative: 'alternative',
      chosen: 'chosen',
      brand: 'attribute',
    });
    expect(suggestChoiceRoles(['best', 'worst', 'set_1', 'set_2', 'notes'])).toMatchObject({
      set_1: 'attribute',
      set_2: 'attribute',
      notes: 'attribute',
    });
  });

  it('maps a long CBC file and leaves set columns as attributes for MaxDiff', () => {
    const roles = suggestChoiceRoles([
      'respondent',
      'task',
      'alternative',
      'chosen',
      'brand',
      'price',
    ]);
    expect(roles.respondent).toBe('respondent');
    expect(roles.task).toBe('task');
    expect(roles.chosen).toBe('chosen');
    expect(roles.brand).toBe('attribute');
    expect(roles.price).toBe('price');
    const body = conjointBodyFromRoles(
      { ...roles, brand: 'attribute', price: 'attribute' },
      { layout: 'long', priceAttribute: 'price' }
    );
    expect(body.attribute_columns).toEqual(['brand', 'price']);
    expect(body.price_attribute).toBe('price');
    expect(body.profile_id_column).toBe('task');
  });

  it('rebuilds a saved counting MaxDiff and a saved conjoint body', () => {
    const counted = rolesFromSavedChoiceBody({
      __op: 'maxdiff_count',
      best_column: 'best',
      worst_column: 'worst',
    });
    const countRun = maxdiffAnalyzeBody({
      roles: counted.roles,
      columns: ['best', 'worst', 'set_1', 'set_2'],
      items: '',
      individual: counted.individual,
      savedOp: counted.savedOp,
      savedSetColumns: counted.setColumns,
    });
    expect(countRun.op).toBe('maxdiff_count');
    expect(countRun.body).toEqual({ best_column: 'best', worst_column: 'worst' });

    const logit = rolesFromSavedChoiceBody({
      __op: 'maxdiff_mnl',
      best_column: 'best',
      worst_column: 'worst',
      set_columns: ['set_1', 'set_2'],
      items: ['Price', 'Quality'],
    });
    const logitRun = maxdiffAnalyzeBody({
      roles: logit.roles,
      columns: ['best', 'worst'],
      items: logit.items,
      individual: false,
      savedOp: logit.savedOp,
      savedSetColumns: logit.setColumns,
    });
    expect(logitRun.op).toBe('maxdiff_mnl');
    expect(Object.keys(logitRun.body).sort()).toEqual([
      'best_column',
      'items',
      'set_columns',
      'worst_column',
    ]);

    const conjoint = rolesFromSavedChoiceBody({
      __op: 'conjoint_mnl',
      chosen_column: 'chosen',
      profile_id_column: 'task',
      attribute_columns: ['brand', 'price'],
    });
    const rebuilt = conjointBodyFromRoles(conjoint.roles, {
      layout: 'long',
      priceAttribute: 'price',
    });
    expect(rebuilt).toMatchObject({
      chosen_column: 'chosen',
      profile_id_column: 'task',
      attribute_columns: ['brand', 'price'],
      price_attribute: 'price',
    });
  });
});
