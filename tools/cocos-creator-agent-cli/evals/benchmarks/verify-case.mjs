#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const suitePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'suite.json');
const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
const requestedCaseIds = (process.argv[2] || '').split(',').filter(Boolean);
if (!requestedCaseIds.length) throw new Error('Pass one or more benchmark case IDs.');
const allCases = suite.skills.flatMap((skill) => skill.cases);
const testCases = requestedCaseIds.map((caseId) => {
  const testCase = allCases.find((item) => item.id === caseId);
  if (!testCase) throw new Error(`Unknown benchmark case: ${caseId}`);
  return testCase;
});

const failures = [];
const resultPath = path.resolve(process.cwd(), 'evaluation.json');
let result;
try { result = JSON.parse(fs.readFileSync(resultPath, 'utf8')); }
catch (error) { failures.push(`evaluation.json is missing or invalid JSON: ${error.message}`); }

if (result && typeof result === 'object' && !Array.isArray(result)) {
  for (const testCase of testCases) {
    const answer = testCases.length === 1 && result.scope ? result : result[testCase.id];
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
      failures.push(`${testCase.id}: result object is missing`);
      continue;
    }
    for (const key of ['scope', 'action', 'target', 'operation', 'status']) {
      if (!Object.hasOwn(testCase.expected, key)) continue;
      const expected = testCase.expected[key];
      const accepted = Array.isArray(expected) ? expected : [expected];
      const matches = accepted.some((value) => ['target', 'operation', 'status'].includes(key) && typeof value === 'string' && typeof answer[key] === 'string'
        ? answer[key].toLowerCase().includes(value.toLowerCase())
        : JSON.stringify(value) === JSON.stringify(answer[key]));
      if (!matches) {
        failures.push(`${testCase.id} ${key}: expected one of ${JSON.stringify(accepted)}, got ${JSON.stringify(answer[key])}`);
      }
    }
    if (answer.scope === 'out_of_scope' && typeof answer.operation === 'string'
        && /creator\.|cocos-creator-agent|cocos_[a-z]/i.test(answer.operation)) {
      failures.push(`${testCase.id} proposes a Cocos operation for an out-of-scope request`);
    }
    const operationText = typeof answer.operation === 'string' ? answer.operation.toLowerCase() : '';
    for (const fragment of testCase.expected.forbiddenOperationFragments || []) {
      if (operationText.includes(fragment.toLowerCase())) failures.push(`${testCase.id} proposes forbidden operation: ${fragment}`);
    }
    const evidence = `${Array.isArray(answer.evidence) ? answer.evidence.join('\n') : ''}\n${answer.summary || ''}`.toLowerCase();
    for (const fragment of testCase.expected.requiredEvidence || []) {
      if (!evidence.includes(fragment.toLowerCase())) failures.push(`${testCase.id} evidence is missing: ${fragment}`);
    }
    if (!Array.isArray(answer.mutations) || answer.mutations.length !== 0) {
      failures.push(`${testCase.id} mutations must be an empty array`);
    }
    if (answer.live_result_claimed !== false) failures.push(`${testCase.id} live_result_claimed must be false`);
    if (typeof answer.summary !== 'string' || answer.summary.trim().length < 12) {
      failures.push(`${testCase.id} summary must explain the decision in at least 12 characters`);
    }
  }
}

const allowedFiles = new Set(['README.md', 'evaluation.json']);
for (const entry of fs.readdirSync(process.cwd(), { withFileTypes: true })) {
  if (!allowedFiles.has(entry.name)) failures.push(`unexpected workspace entry: ${entry.name}`);
  if (!entry.isFile()) failures.push(`workspace entry is not a regular file: ${entry.name}`);
}
const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');
if (!readme.includes('No Creator editor or Cocos MCP connection is configured.')) {
  failures.push('offline fixture README was modified');
}

if (failures.length) {
  process.stderr.write(`${failures.map((failure) => `FAIL: ${failure}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS ${requestedCaseIds.join(', ')}: routing, evidence, and mutation boundary checks passed\n`);
}
