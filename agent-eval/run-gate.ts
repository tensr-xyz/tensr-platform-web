/**
 * CLI used by the Promptfoo baseline provider.
 * Calls the same resolveGateInOrder Jest tests. tsx loads tsconfig paths.
 *
 * Usage: npx tsx agent-eval/run-gate.ts "Hello"
 */
import { resolveGateInOrder } from '../src/lib/resolve-agent-gate';

const prompt = process.argv.slice(2).join(' ');
process.stdout.write(resolveGateInOrder(prompt));
// chat-actions / related imports can leave handles open — force exit for CLI use.
process.exit(0);
