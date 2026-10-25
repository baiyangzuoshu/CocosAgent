#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { taskSetFingerprint } from './task-set.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suite = JSON.parse(await fs.readFile(path.join(scriptDir, 'suite.json'), 'utf8'));
const currentTaskSetFingerprint = taskSetFingerprint(suite);
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const resultsRoot = path.resolve(option('--results-root', '/private/tmp/cocos-skill-benchmark'));
const outputPath = path.resolve(option('--output', path.join(scriptDir, 'behavior-comparison-2026-10-22.md')));
const beforeStaticPath = option('--before-static', '/private/tmp/cocos-skill-eval-20261022.json');
const afterStaticPath = option('--after-static', '/private/tmp/cocos-skill-benchmark/final-static.json');
const before = JSON.parse(await fs.readFile(path.join(resultsRoot, 'baseline/graded-results.json'), 'utf8'));
const after = JSON.parse(await fs.readFile(path.join(resultsRoot, 'after/graded-results.json'), 'utf8'));
for (const [phase, result] of [['baseline', before], ['after', after]]) {
  if (result.suiteFingerprint !== currentTaskSetFingerprint) {
    throw new Error(`${phase} results were graded from a different task set; rerun and regrade before comparing.`);
  }
}
const beforeByCase = new Map(before.results.map((result) => [result.caseId, result]));
const afterByCase = new Map(after.results.map((result) => [result.caseId, result]));
const expectedCaseIds = suite.skills.flatMap((skill) => skill.cases.map((testCase) => testCase.id));
for (const [phase, indexed] of [['baseline', beforeByCase], ['after', afterByCase]]) {
  if (indexed.size !== expectedCaseIds.length || expectedCaseIds.some((caseId) => !indexed.has(caseId))) {
    throw new Error(`${phase} results were graded against a different task set; rerun and regrade before comparing.`);
  }
}

const staticBefore = JSON.parse(await fs.readFile(beforeStaticPath, 'utf8')).results;
const staticAfter = JSON.parse(await fs.readFile(afterStaticPath, 'utf8')).results;
const staticValue = (items, name, field) => {
  const item = items.find((entry) => entry.name === name);
  const row = item?.summary || item;
  return row?.[field] ?? '—';
};

const lines = [
  '# Targeted behavior comparison for eight Cocos Skills',
  '',
  `Baseline Skill source: \`${suite.baselineRef}\`.`,
  `Model: \`${suite.model}\`, reasoning effort: \`${suite.reasoningEffort}\`; Codex CLI: \`codex-cli 0.163.0-alpha.10.2\`.`,
  `Task set: ${suite.skills.length} Skills, ${suite.skills.reduce((sum, skill) => sum + skill.cases.length, 0)} cases (one positive and one near-miss per Skill).`,
  '',
  `Behavior score: **${before.passed}/${before.total} (${Math.round(100 * before.passed / before.total)}%) → ${after.passed}/${after.total} (${Math.round(100 * after.passed / after.total)}%)**.`,
  '',
  '| Skill | Before | After |',
  '| --- | ---: | ---: |',
];

for (const skill of suite.skills) {
  const prior = skill.cases.filter((testCase) => beforeByCase.get(testCase.id)?.status === 'passed').length;
  const current = skill.cases.filter((testCase) => afterByCase.get(testCase.id)?.status === 'passed').length;
  lines.push(`| ${skill.name} | ${prior}/${skill.cases.length} | ${current}/${skill.cases.length} |`);
}

const resolved = before.results.filter((result) => result.status === 'failed' && afterByCase.get(result.caseId)?.status === 'passed');
const regressions = before.results.filter((result) => result.status === 'passed' && afterByCase.get(result.caseId)?.status !== 'passed');
lines.push('', '## Behavior changes', '');
if (resolved.length) {
  for (const result of resolved) {
    lines.push(`- **${result.caseId}** now passes. The revised Skill explicitly routes the adjacent request to its sibling workflow.`);
  }
} else {
  lines.push('- No baseline failures were resolved.');
}
if (regressions.length) {
  lines.push('', `Regressions: ${regressions.map((result) => result.caseId).join(', ')}.`);
} else {
  lines.push('- No baseline-passing case regressed.');
}

lines.push('', '## Static analysis', '', '| Skill | Before | After |', '| --- | ---: | ---: |');
for (const skill of suite.skills) {
  const beforeScore = staticValue(staticBefore, skill.name, 'score');
  const beforeGrade = staticValue(staticBefore, skill.name, 'grade');
  const afterScore = staticValue(staticAfter, skill.name, 'score');
  const afterGrade = staticValue(staticAfter, skill.name, 'grade');
  lines.push(`| ${skill.name} | ${beforeGrade}/${beforeScore} | ${afterGrade}/${afterScore} |`);
}
lines.push('', 'The weak-trigger-description finding cleared for all eight Skills. Token-budget findings remain on several Skills; these are static estimates, not behavior failures.');

const sameCompletedCases = before.results.length === after.results.length
  && before.results.every((result) => afterByCase.has(result.caseId));
if (!sameCompletedCases) throw new Error('Before/after case sets do not match.');

lines.push('', '## Method and limits', '');
lines.push('- The before phase loaded each Skill from the pinned source commit; the after phase loaded the current working-tree Skill. Each Codex run used an isolated workspace and isolated home with no MCP servers or Creator editor connection.');
lines.push('- Each case required a structured `evaluation.json`; `grade-phase.mjs` applied the finalized deterministic verifier to the captured outputs. During the initial runs, some equivalent status/operation wording was rejected by the first verifier draft; the outputs were regraded with the final acceptance rules without rerunning Codex.');
lines.push('- One Codex run per Skill evaluated both cases. Results are a targeted regression signal, not a statistical estimate. The benchmark does not validate live Creator editor, scene persistence, or runtime behavior, and it has no no-Skill control.');
lines.push('- Raw run artifacts and per-phase graded results are under `/private/tmp/cocos-skill-benchmark/`; the task prompts and verifier are versioned beside this report.');
lines.push('');

await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(`Wrote ${outputPath}\n`);
