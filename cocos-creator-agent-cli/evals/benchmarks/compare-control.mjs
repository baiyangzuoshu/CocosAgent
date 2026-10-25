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
const controlRoot = path.resolve(option('--control-results-root', '/private/tmp/cocos-skill-benchmark-control'));
const outputPath = path.resolve(option('--output', path.join(scriptDir, 'skill-control-comparison-2026-10-23.md')));

async function loadPhase(root, phase) {
  return JSON.parse(await fs.readFile(path.join(root, phase, 'graded-results.json'), 'utf8'));
}

const [baseline, after, control] = await Promise.all([
  loadPhase(resultsRoot, 'baseline'),
  loadPhase(resultsRoot, 'after'),
  loadPhase(controlRoot, 'control'),
]);
for (const [phase, result] of [['baseline', baseline], ['after', after], ['control', control]]) {
  if (result.suiteFingerprint !== currentTaskSetFingerprint) {
    throw new Error(`${phase} results were graded from a different task set; rerun and regrade before comparing.`);
  }
}
const allCaseIds = suite.skills.flatMap((skill) => skill.cases.map((testCase) => testCase.id));
function indexByCase(phase, label) {
  const indexed = new Map(phase.results.map((result) => [result.caseId, result]));
  if (indexed.size !== allCaseIds.length || allCaseIds.some((caseId) => !indexed.has(caseId))) {
    throw new Error(`${label} phase does not contain the exact ${allCaseIds.length}-case task set.`);
  }
  return indexed;
}
const beforeByCase = indexByCase(baseline, 'baseline');
const afterByCase = indexByCase(after, 'after');
const controlByCase = indexByCase(control, 'control');
if (baseline.model !== after.model || baseline.model !== control.model
    || baseline.reasoningEffort !== after.reasoningEffort || baseline.reasoningEffort !== control.reasoningEffort) {
  throw new Error('The three phases must use the same model and reasoning effort.');
}

const passCount = (phase) => phase.results.filter((result) => result.status === 'passed').length;
const perSkill = suite.skills.map((skill) => {
  const count = (index) => skill.cases.filter((testCase) => index.get(testCase.id)?.status === 'passed').length;
  return { skill, before: count(beforeByCase), after: count(afterByCase), control: count(controlByCase) };
});
const afterWinsAgainstControl = allCaseIds.filter((id) => afterByCase.get(id).status === 'passed' && controlByCase.get(id).status !== 'passed');
const controlWinsAgainstAfter = allCaseIds.filter((id) => controlByCase.get(id).status === 'passed' && afterByCase.get(id).status !== 'passed');
const changesWinsAgainstControl = allCaseIds.filter((id) => beforeByCase.get(id).status !== 'passed'
  && afterByCase.get(id).status === 'passed' && controlByCase.get(id).status !== 'passed');
const outputStatus = (index, id) => index.get(id).status === 'passed' ? 'pass' : 'fail';
const lines = [
  '# Target-Skill control comparison for eight Cocos Skills',
  '',
  `Task set: ${suite.skills.length} Skills, ${allCaseIds.length} cases; model \`${suite.model}\`, reasoning effort \`${suite.reasoningEffort}\`.`,
  'Control: the isolated Codex home received only the unrelated `eval-no-op-control` aquarium-fish Skill; none of the eight Cocos target Skills was installed.',
  '',
  '| Phase | Passed | Score |',
  '| --- | ---: | ---: |',
  `| Baseline target Skills | ${passCount(baseline)}/${baseline.total} | ${Math.round(100 * passCount(baseline) / baseline.total)}% |`,
  `| Revised target Skills | ${passCount(after)}/${after.total} | ${Math.round(100 * passCount(after) / after.total)}% |`,
  `| No-target-Skill control | ${passCount(control)}/${control.total} | ${Math.round(100 * passCount(control) / control.total)}% |`,
  '',
  '| Skill task pair | Baseline | Revised | Control |',
  '| --- | ---: | ---: | ---: |',
];
for (const row of perSkill) lines.push(`| ${row.skill.name} | ${row.before}/2 | ${row.after}/2 | ${row.control}/2 |`);

lines.push('', '## Case-level results', '', '| Case | Baseline | Revised | Control |', '| --- | --- | --- | --- |');
for (const caseId of allCaseIds) {
  lines.push(`| ${caseId} | ${outputStatus(beforeByCase, caseId)} | ${outputStatus(afterByCase, caseId)} | ${outputStatus(controlByCase, caseId)} |`);
}

lines.push('', '## Interpretation', '');
lines.push(`- Revised target Skills passed ${afterWinsAgainstControl.length} case(s) that the no-target-Skill control failed${afterWinsAgainstControl.length ? `: ${afterWinsAgainstControl.join(', ')}` : ''}.`);
lines.push(`- Of these, ${changesWinsAgainstControl.length} were also baseline failures and therefore show a change-specific advantage over both baseline and control${changesWinsAgainstControl.length ? `: ${changesWinsAgainstControl.join(', ')}` : ''}.`);
lines.push(`- The control passed ${controlWinsAgainstAfter.length} case(s) the revised Skills failed${controlWinsAgainstAfter.length ? `: ${controlWinsAgainstAfter.join(', ')}` : ''}.`);
if (!afterWinsAgainstControl.length) {
  lines.push('- This task set does not demonstrate measurable behavior lift from loading the revised target Skills. The earlier baseline-to-revised gain remains observable, but it cannot be attributed to Skill instructions with this control result.');
} else if (!changesWinsAgainstControl.length) {
  lines.push('- The revised Skills outperform the control on some cases, but those cases were already passing in the baseline; this run does not show a newly introduced Skill-specific gain.');
}

lines.push('', '## Method and limits', '');
lines.push('- Each phase uses one Codex run per Skill pair, with the positive and boundary request batched as independent cases. The deterministic verifier checks structured output, evidence, scope, and mutation boundaries.');
lines.push('- The control retains Plugin Eval’s isolated-skill provisioning path but installs only an unrelated sentinel Skill. It is a no-target-Skill control for the Cocos tasks, not a pristine Codex installation with zero available Skills.');
lines.push('- Prompts provide substantial task context, and the verifier accepts a narrow set of expected values. A high control score would indicate that this benchmark is not sufficiently discriminative for measuring Skill-specific behavior. Results are one-run regression evidence, not a statistical estimate or live Creator validation.');
lines.push(`- Raw control artifacts are under \`${controlRoot}\`; baseline and revised artifacts are under \`${resultsRoot}\`.`);
lines.push('');

await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(`Wrote ${outputPath}\n`);
