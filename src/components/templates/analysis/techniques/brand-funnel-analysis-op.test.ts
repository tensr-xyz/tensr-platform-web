import { TECHNIQUE_CONFIGS } from './index';

describe('Brand Funnel stored analysis', () => {
  it('stores the same analysis key the funnel route runs', () => {
    const config = TECHNIQUE_CONFIGS['Brand Funnel'];
    expect(config.route).toBe('techniques/funnel');
    expect(config.analysisOp).toBe('funnel');
  });
});
