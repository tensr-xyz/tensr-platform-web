import {
  isLinkScannerExceptionEvent,
  isLinkScannerMessage,
  withoutLinkScannerException,
} from './link-scanner';

const SCANNER = 'Object Not Found Matching Id:3, MethodName:update, ParamCount:4';
const REJECTION = `Non-Error promise rejection captured with value: ${SCANNER}`;

describe('isLinkScannerMessage', () => {
  it('matches the Safe Links error and the unhandled-rejection form', () => {
    expect(isLinkScannerMessage(SCANNER)).toBe(true);
    expect(isLinkScannerMessage(REJECTION)).toBe(true);
    expect(
      isLinkScannerMessage('Object Not Found Matching Id:1, MethodName:update, ParamCount:4')
    ).toBe(true);
  });

  it('ignores unrelated errors and a partial fingerprint', () => {
    expect(isLinkScannerMessage('Object Not Found Matching Id:3')).toBe(false);
    expect(isLinkScannerMessage('Failed to fetch')).toBe(false);
  });
});

describe('withoutLinkScannerException', () => {
  it('drops a scanner $exception and marks the session', () => {
    const markSession = jest.fn();
    const event = {
      event: '$exception',
      properties: {
        $exception_list: [{ type: 'Error', value: SCANNER }],
      },
    };
    expect(withoutLinkScannerException(event, markSession)).toBeNull();
    expect(markSession).toHaveBeenCalledTimes(1);
  });

  it('drops the unhandled-rejection message on $exception_message', () => {
    const markSession = jest.fn();
    expect(
      withoutLinkScannerException(
        { event: '$exception', properties: { $exception_message: REJECTION } },
        markSession
      )
    ).toBeNull();
    expect(markSession).toHaveBeenCalledTimes(1);
  });

  it('keeps pageviews and other exceptions', () => {
    const markSession = jest.fn();
    const pageview = {
      event: '$pageview',
      properties: { $current_url: 'https://app.tensr.xyz/login' },
    };
    expect(withoutLinkScannerException(pageview, markSession)).toBe(pageview);
    const other = {
      event: '$exception',
      properties: { $exception_list: [{ value: 'Failed to fetch' }] },
    };
    expect(withoutLinkScannerException(other, markSession)).toBe(other);
    expect(isLinkScannerExceptionEvent(pageview)).toBe(false);
    expect(markSession).not.toHaveBeenCalled();
  });
});
