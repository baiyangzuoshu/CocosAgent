#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suite = JSON.parse(await fs.readFile(path.join(scriptDir, 'suite.json'), 'utf8'));
const args = process.argv.slice(2);
const phaseIndex = args.indexOf('--phase');
const phase = phaseIndex >= 0 ? args[phaseIndex + 1] : '';
const outputIndex = args.indexOf('--output-dir');
const outputRoot = path.resolve(outputIndex >= 0 ? args[outputIndex + 1] : '/private/tmp/cocos-skill-benchmark');
if (!['baseline', 'after'].includes(phase)) throw new Error('Use --phase baseline|after.');

const phaseRoot = path.join(outputRoot, phase);
const runSummary = JSON.parse(await fs.readFile(path.join(phaseRoot, 'summary.json'), 'utf8'));
const verifier = path.join(scriptDir, 'verify-case.mjs');
const fixtureReadme = path.join(scriptDir, 'workspace', 'README.md');
const results = [];
const bySkill = new Map(runSummary.results.map((result) => [result.skill, result]));

for (const skill of suite.skills) {
  const run = bySkill.get(skill.name);
  if (!run) throw new Error(`No ${phase} benchmark run found for ${skill.name}.`);
  const evaluationPath = path.join(phaseRoot, skill.name, run.caseId, 'evaluation.json');
  const evaluation = await fs.readFile(evaluationPath, 'utf8');
  for (const testCase of skill.cases) {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), `cocos-grade-${phase}-`));
    try {
      await fs.copyFile(fixtureReadme, path.join(cwd, 'README.md'));
      await fs.writeFile(path.join(cwd, 'evaluation.json'), evaluation, 'utf8');
      const grade = spawnSync(process.execPath, [verifier, testCase.id], { cwd, encoding: 'utf8' });
      results.push({
        phase,
        skill: skill.name,
        caseId: testCase.id,
        status: grade.status === 0 ? 'passed' : 'failed',
        output: (grade.stdout || grade.stderr || '').trim(),
        benchmarkStatus: run.benchmarkStatus,
        durationMs: run.durationMs,
        usage: run.usage,
      });
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  }
}

const passed = results.filter((result) => result.status === 'passed').length;
const failed = results.length - passed;
const payload = {
  schemaVersion: 1,
  phase,
  baselineRef: suite.baselineRef,
  model: suite.model,
  reasoningEffort: suite.reasoningEffort,
  passed,
  failed,
  total: results.length,
  results,
};
await fs.writeFile(path.join(phaseRoot, 'graded-results.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
for (const result of results) process.stdout.write(`${result.status.toUpperCase()} ${result.caseId}${result.output ? `: ${result.output}` : ''}\n`);
process.stdout.write(`\n${phase}: ${passed}/${results.length} cases passed; ${failed} failed.\n`);
