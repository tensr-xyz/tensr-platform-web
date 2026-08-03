/**
 * Promptfoo custom provider — real resolveGateInOrder via node --import tsx.
 * Must export a constructor class (promptfoo does `new Provider(...)`).
 *
 * run-gate.ts calls process.exit(0) because chat-actions imports can leave
 * open handles that otherwise hang the child process.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const webRoot = path.resolve(__dirname, '..');
const runner = path.join(__dirname, 'run-gate.ts');
// Resolve from package.json so CI (pnpm install) does not depend on a global tsx.
const tsxLoader = require.resolve('tsx', { paths: [webRoot] });

function resolveGate(prompt) {
  const out = execFileSync(
    process.execPath,
    ['--import', tsxLoader, runner, String(prompt ?? '')],
    {
      cwd: webRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        TS_NODE_PROJECT: path.join(webRoot, 'tsconfig.json'),
      },
      timeout: 60_000,
    }
  );
  return out.trim().split('\n').filter(Boolean).pop() || '';
}

module.exports = class TensrRoutingBaselineProvider {
  constructor(options) {
    this.providerId = options?.id || 'tensr-routing-baseline';
    this.config = options?.config;
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt) {
    return { output: resolveGate(prompt) };
  }
};
