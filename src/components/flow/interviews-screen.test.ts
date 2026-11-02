import { passageCodes } from './interviews-screen';

describe('interviews', () => {
  it('lists the codes stored on a passage', () => {
    expect(
      passageCodes(
        [
          { passage_id: 'a', code: 'Price' },
          { passage_id: 'b', code: 'Trust' },
          { passage_id: 'a', code: '' },
        ],
        'a'
      )
    ).toEqual(['Price']);
  });
});
