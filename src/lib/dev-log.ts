/** Debug logging — stripped from production client bundles when NODE_ENV is not development. */

const isDev = process.env.NODE_ENV === 'development';

export function devLog(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}

export function devInfo(...args: unknown[]): void {
  if (isDev) {
    console.info(...args);
  }
}

export function devDebug(...args: unknown[]): void {
  if (isDev) {
    console.debug(...args);
  }
}
