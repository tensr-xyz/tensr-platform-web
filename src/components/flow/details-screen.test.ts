import { joinBrief, splitBrief } from './details-screen';

describe('project brief', () => {
  it('keeps objectives and audience as two parts of one brief', () => {
    const text = joinBrief('Track awareness\nMeasure satisfaction', 'UK adults 18+');
    expect(splitBrief(text)).toEqual({
      objectives: 'Track awareness\nMeasure satisfaction',
      audience: 'UK adults 18+',
    });
    expect(splitBrief('Just a note')).toEqual({ objectives: 'Just a note', audience: '' });
  });
});
