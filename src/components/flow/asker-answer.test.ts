import { answerIsNotInData, stripNotInDataLead } from './asker-answer';

describe('asker answer not-in-data helpers', () => {
  it('recognises both Not in this data and That is not in this data', () => {
    expect(answerIsNotInData('Not in this data. Ask about investor type.')).toBe(true);
    expect(
      answerIsNotInData('That is not in this data. Available questions: Region, Investor type.')
    ).toBe(true);
    expect(answerIsNotInData('Northwind Post reaches 41%.')).toBe(false);
  });

  it('strips the lead phrase for the callout body', () => {
    expect(stripNotInDataLead('Not in this data. Ask about investor type.')).toBe(
      'Ask about investor type.'
    );
    expect(stripNotInDataLead('That is not in this data. The survey records investor type.')).toBe(
      'The survey records investor type.'
    );
  });
});
