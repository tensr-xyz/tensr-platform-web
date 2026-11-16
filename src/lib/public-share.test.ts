import { publicSharePath } from './public-share';

describe('publicSharePath', () => {
  it('builds the shared output URL path from the token', () => {
    expect(publicSharePath('abc123')).toBe('/s/abc123');
  });
});
