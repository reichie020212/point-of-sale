#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Fixture verifier for the no-restricted-syntax color rule.
 *
 *   passing.ts → expect zero errors
 *   failing.ts → expect at least one `no-restricted-syntax` error per
 *                color literal in the file
 *
 * Run: `pnpm --filter @counter/eslint-config lint:fixtures`
 *
 * Exits 0 on success, 1 on failure.
 */
const path = require('node:path');
const { ESLint } = require('eslint');

const ROOT = path.resolve(__dirname, '..');
const PASSING = path.join(ROOT, '__fixtures__', 'passing.ts');
const FAILING = path.join(ROOT, '__fixtures__', 'failing.ts');

async function lint(file) {
  const eslint = new ESLint({ cwd: path.resolve(ROOT, '..', '..') });
  const results = await eslint.lintFiles([file]);
  return results[0] || { messages: [], errorCount: 0, warningCount: 0 };
}

async function main() {
  const passing = await lint(PASSING);
  const passingColorErrors = passing.messages.filter((m) => m.ruleId === 'no-restricted-syntax');
  if (passingColorErrors.length > 0) {
    console.error('FAIL: passing fixture triggered the color rule:');
    for (const m of passingColorErrors) {
      console.error(`  ${PASSING}:${m.line}:${m.column} ${m.message}`);
    }
    process.exit(1);
  }
  console.log(`OK: passing fixture clean (${passing.errorCount} unrelated errors)`);

  const failing = await lint(FAILING);
  const failingColorErrors = failing.messages.filter((m) => m.ruleId === 'no-restricted-syntax');
  if (failingColorErrors.length === 0) {
    console.error('FAIL: failing fixture did not trigger the color rule.');
    console.error('       Token discipline (CLAUDE.md non-negotiable #2) is no longer enforced.');
    process.exit(1);
  }
  console.log(`OK: failing fixture triggered ${failingColorErrors.length} color-rule errors`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
