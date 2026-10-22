import posthog from 'posthog-js';
import { ApiRequestError } from './api-error';
import {
  captureProductEvent,
  captureProductException,
  productEnvironment,
} from './product-analytics';

jest.mock('posthog-js', () => ({
  register_for_session: jest.fn(),
  register: jest.fn(),
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

  it('tags analysis events with environment, duration, and the failed request', () => {
    expect(productEnvironment()).toBe('local');
    captureProductEvent('analysis_started', {
      where: 'custom_tables',
      analysis_type: 'banner_table',
      dataset_id: 'cars',
    });
    captureProductEvent('analysis_completed', {
      where: 'custom_tables',
      analysis_type: 'banner_table',
      dataset_id: 'cars',
    });
    const completed = (posthog.capture as jest.Mock).mock.calls.find(
      call => call[0] === 'analysis_completed'
    );
    expect(completed?.[1].environment).toBe('local');
    expect(typeof completed?.[1].duration_ms).toBe('number');
    new ApiRequestError(500, 'x'.repeat(250));
    captureProductEvent('analysis_failed', {
      where: 'custom_tables',
      analysis_type: 'banner_table',
      message: 'y'.repeat(250),
    });
    const failed = (posthog.capture as jest.Mock).mock.calls.find(
      call => call[0] === 'analysis_failed'
    );
    expect(failed?.[1].error_message).toHaveLength(200);
    expect(failed?.[1].http_status).toBe(500);
    expect(failed?.[1].analysis_type).toBe('banner_table');
  });

  it('still sends other exceptions', () => {
    const error = new Error('Failed to fetch');
    captureProductException(error);
    expect(posthog.captureException).toHaveBeenCalledWith(error, undefined);
  });
});
