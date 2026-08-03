/**
 * Promptfoo provider — calls the real resolveGateInOrder via tsx CLI so
 * TypeScript path aliases (@/) resolve the same way as the app.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const webRoot = path.resolve(__dirname, '..');
const runner = path.join(__dirname, 'run-gate.ts');

function resolveGate(prompt) {
  const out = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', '--tsconfig', 'tsconfig.json', runner, String(prompt ?? '')],
    {
      cwd: webRoot,
      encoding: 'utf8',
      env: { ...process.env, TS_NODE_PROJECT: path.join(webRoot, 'tsconfig.json') },
      timeout: 60_000,
    }
  );
  return out.trim();
}

module.exports = {
  id: 'tensr-routing-baseline',
  async callApi(prompt) {
    return { output: resolveGate(prompt) };
  },
};
