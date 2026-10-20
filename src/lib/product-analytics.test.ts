import posthog from 'posthog-js';
import { captureProductException } from './product-analytics';

jest.mock('posthog-js', () => ({
  register_for_session: jest.fn(),
  capture: jest.fn(),
  captureException: jest.fn(),
}));

describe('captureProductException scanner filter', () => {
  it('marks the session and does not send a Safe Links exception', () => {
    captureProductException(
      new Error('Object Not Found Matching Id:2, MethodName:update, ParamCount:4')
    );
    expect(posthog.register_for_session).toHaveBeenCalledWith({ is_link_scanner: true });
    expect(posthog.captureException).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('still sends other exceptions', () => {
    const error = new Error('Failed to fetch');
    captureProductException(error);
    expect(posthog.captureException).toHaveBeenCalledWith(error, undefined);
  });
});
