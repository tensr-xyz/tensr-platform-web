import { plainServerFailure, readableApiError } from './flow-api';

describe('readableApiError', () => {
  it('turns a 500 Internal server error into a plain sentence', () => {
    expect(
      readableApiError('{"detail":"Internal server error"}', 'Internal Server Error', 500)
    ).toBe('Tensr could not load this right now. Try again in a moment.');
    expect(plainServerFailure(503, 'Internal server error')).toBe(
      'Tensr could not load this right now. Try again in a moment.'
    );
  });

  it('keeps a specific 4xx detail', () => {
    expect(readableApiError('{"detail":"Project not found"}', 'Not Found', 404)).toBe(
      'Project not found'
    );
  });
});
