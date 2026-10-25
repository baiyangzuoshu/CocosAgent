#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { taskExecutionFingerprint, taskSetFingerprint } from './task-set.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suite = JSON.parse(await fs.readFile(path.join(scriptDir, 'suite.json'), 'utf8'));
const currentTaskSetFingerprint = taskSetFingerprint(suite);
const currentExecutionFingerprint = taskExecutionFingerprint(suite);
const args = process.argv.slice(2);
const phaseIndex = args.indexOf('--phase');
const phase = phaseIndex >= 0 ? args[phaseIndex + 1] : '';
const outputIndex = args.indexOf('--output-dir');
const outputRoot = path.resolve(outputIndex >= 0 ? args[outputIndex + 1] : '/private/tmp/cocos-skill-benchmark');
const skillIndex = args.indexOf('--skill');
const selectedSkill = skillIndex >= 0 ? args[skillIndex + 1] : undefined;
if (!['baseline', 'after', 'control'].includes(phase)) throw new Error('Use --phase baseline|after|control.');

const phaseRoot = path.join(outputRoot, phase);
const runSummary = JSON.parse(await fs.readFile(path.join(phaseRoot, 'summary.json'), 'utf8'));
if (runSummary.suiteFingerprint !== currentTaskSetFingerprint
    && runSummary.executionFingerprint !== currentExecutionFingerprint) {
  throw new Error(`${phase} results were produced from different prompts or execution settings; rerun this phase before grading.`);
}
const observedCodexVersions = new Set(runSummary.results.map((result) => result.codexVersion).filter(Boolean));
if (observedCodexVersions.size > 1) {
  throw new Error(`${phase} result records contain inconsistent Codex CLI versions: ${[...observedCodexVersions].join(', ')}`);
}
const verifier = path.join(scriptDir, 'verify-case.mjs');
const fixtureReadme = path.join(scriptDir, 'workspace', 'README.md');
const fixtureCatalog = path.join(scriptDir, 'workspace', 'skill-catalog.json');
const results = [];
const bySkill = new Map(runSummary.results.map((result) => [result.skill, result]));

const selectedSkillNames = phase === 'baseline'
  ? suite.baselineSkills
  : phase === 'control'
    ? suite.deepSkills
    : suite.skills.map((skill) => skill.name);
if (selectedSkill && !selectedSkillNames.includes(selectedSkill)) {
  throw new Error(`${selectedSkill} is not included in the ${phase} phase.`);
}
const gradedSkillNames = selectedSkill ? [selectedSkill] : selectedSkillNames;
for (const skillName of gradedSkillNames) {
  const skill = suite.skills.find((entry) => entry.name === skillName);
  const run = bySkill.get(skill.name);
  const expectedCaseIds = skill.cases.map((testCase) => testCase.id);
  if (!run || run.outcome === 'infrastructure_error' || !Array.isArray(run.caseIds) || run.caseIds.length !== expectedCaseIds.length
      || expectedCaseIds.some((caseId) => !run.caseIds.includes(caseId))) {
    for (const testCase of skill.cases) {
      results.push({ phase, skill: skill.name, caseId: testCase.id, status: 'infrastructure_error',
        output: run?.error || `No complete ${phase} benchmark result found for ${skill.name}.` });
    }
    continue;
  }
  const evaluationPath = path.join(phaseRoot, skill.name, run.caseId, 'evaluation.json');
  let evaluation;
  try {
    evaluation = await fs.readFile(evaluationPath, 'utf8');
  } catch (error) {
    for (const testCase of skill.cases) {
      results.push({ phase, skill: skill.name, caseId: testCase.id, status: 'failed',
        output: `No structured evaluation.json was captured: ${error.message}`,
        benchmarkStatus: run.benchmarkStatus, durationMs: run.durationMs, usage: run.usage });
    }
    continue;
  }
  for (const testCase of skill.cases) {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), `cocos-grade-${phase}-`));
    try {
      await fs.copyFile(fixtureReadme, path.join(cwd, 'README.md'));
      await fs.copyFile(fixtureCatalog, path.join(cwd, 'skill-catalog.json'));
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
const failed = results.filter((result) => result.status === 'failed').length;
const infrastructureErrors = results.filter((result) => result.status === 'infrastructure_error').length;
const payload = {
  schemaVersion: 1,
  phase,
  baselineRef: suite.baselineRef,
  suiteFingerprint: currentTaskSetFingerprint,
  sourceSuiteFingerprint: runSummary.suiteFingerprint,
  executionFingerprint: currentExecutionFingerprint,
  model: suite.model,
  reasoningEffort: suite.reasoningEffort,
  codexVersion: [...observedCodexVersions][0] || runSummary.codexVersion || 'unknown',
  passed,
  failed,
  infrastructureErrors,
  total: results.length,
  results,
};
await fs.writeFile(path.join(phaseRoot, 'graded-results.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
for (const result of results) process.stdout.write(`${result.status.toUpperCase()} ${result.caseId}${result.output ? `: ${result.output}` : ''}\n`);
process.stdout.write(`\n${phase}: ${passed}/${results.length} passed; ${failed} behavior failures; ${infrastructureErrors} infrastructure errors.\n`);
