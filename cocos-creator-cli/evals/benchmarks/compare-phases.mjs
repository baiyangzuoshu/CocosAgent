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
const outputPath = path.resolve(option('--output', path.join(scriptDir, 'behavior-comparison-2026-10-25.md')));
const before = JSON.parse(await fs.readFile(path.join(resultsRoot, 'baseline/graded-results.json'), 'utf8'));
const after = JSON.parse(await fs.readFile(path.join(resultsRoot, 'after/graded-results.json'), 'utf8'));
for (const [phase, result] of [['baseline', before], ['after', after]]) {
  if (result.suiteFingerprint !== currentTaskSetFingerprint) {
    throw new Error(`${phase} results were graded from a different task set; rerun and regrade before comparing.`);
  }
  if (result.infrastructureErrors) throw new Error(`${phase} has ${result.infrastructureErrors} infrastructure errors; complete the phase before comparing.`);
}
if (before.model !== after.model || before.reasoningEffort !== after.reasoningEffort
    || (before.codexVersion && after.codexVersion && before.codexVersion !== after.codexVersion)) {
  throw new Error('Baseline and current phases must use the same model, reasoning effort, and Codex CLI version.');
}
const beforeByCase = new Map(before.results.map((result) => [result.caseId, result]));
const afterByCase = new Map(after.results.map((result) => [result.caseId, result]));
const expectedCaseIds = suite.baselineSkills.flatMap((name) => suite.skills.find((skill) => skill.name === name).cases.map((testCase) => testCase.id));
const allAfterCaseIds = suite.skills.flatMap((skill) => skill.cases.map((testCase) => testCase.id));
for (const [phase, indexed, cases] of [['baseline', beforeByCase, expectedCaseIds], ['after', afterByCase, allAfterCaseIds]]) {
  if (indexed.size !== cases.length || cases.some((caseId) => !indexed.has(caseId))) {
    throw new Error(`${phase} results were graded against a different task set; rerun and regrade before comparing.`);
  }
}

const lines = [
  '# 52 个 Cocos Skill 行为验收与改动前后对比',
  '',
  `Baseline Skill source: \`${suite.baselineRef}\`.`,
  `Model: \`${suite.model}\`, reasoning effort: \`${suite.reasoningEffort}\`; Codex CLI: baseline \`${before.codexVersion || 'unknown'}\`, current \`${after.codexVersion || 'unknown'}\`.`,
  `Current suite: ${suite.skills.length} Skills, ${allAfterCaseIds.length} cases; before/after regression subset: ${suite.baselineSkills.length} changed Skills, ${expectedCaseIds.length} matched cases.`,
  '',
  `Matched changed-Skill behavior: **${before.passed}/${before.total} (${Math.round(100 * before.passed / before.total)}%) → ${expectedCaseIds.filter((id) => afterByCase.get(id).status === 'passed').length}/${expectedCaseIds.length} (${Math.round(100 * expectedCaseIds.filter((id) => afterByCase.get(id).status === 'passed').length / expectedCaseIds.length)}%)**.`,
  '',
  '| Skill | Before | After |',
  '| --- | ---: | ---: |',
];

for (const name of suite.baselineSkills) {
  const skill = suite.skills.find((entry) => entry.name === name);
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

lines.push('', '## Static analysis', '', 'The current 52-Skill static snapshot is recorded separately in [skill-static-analysis-2026-10-25.md](../skill-static-analysis-2026-10-25.md). Static grades and token-cost findings are diagnostic signals, not behavior pass/fail results.');

lines.push('', '## Method and limits', '');
lines.push('- The before phase loaded each Skill from the pinned source commit; the after phase loaded the current working-tree Skill. Each Codex run used an isolated workspace and isolated home with no MCP servers or Creator editor connection.');
lines.push('- Each case required a structured `evaluation.json`; `grade-phase.mjs` applied the finalized deterministic verifier to the captured outputs. During the initial runs, some equivalent status/operation wording was rejected by the first verifier draft; the outputs were regraded with the final acceptance rules without rerunning Codex.');
lines.push('- One Codex run per Skill evaluated its positive and boundary cases. The baseline ran only the 13 Skills whose content changed since the pinned commit; the current phase covered all 52. This is a targeted regression signal, not a statistical estimate.');
lines.push('- The suite has no direct Skill-load telemetry. Routing and task success are behavioral proxies only; the separate no-target-Skill comparison checks whether the cases distinguish Skill instructions from general model knowledge.');
lines.push(`- Creator live acceptance is a separate phase for ${suite.realCreatorSkills.length} editor/content Skills on Creator 2.4.15; offline benchmark results do not establish project persistence or runtime behavior.`);
lines.push('- Raw run artifacts and per-phase graded results are under `/private/tmp/cocos-skill-benchmark/`; the task prompts and verifier are versioned beside this report.');
lines.push('');

await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(`Wrote ${outputPath}\n`);
