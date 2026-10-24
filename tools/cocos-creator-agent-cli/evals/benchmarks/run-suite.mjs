#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { taskSetFingerprint } from './task-set.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const evalRoot = path.resolve(scriptDir, '..');
const packageRoot = path.resolve(evalRoot, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const suite = JSON.parse(await fs.readFile(path.join(scriptDir, 'suite.json'), 'utf8'));
const currentTaskSetFingerprint = taskSetFingerprint(suite);
const args = process.argv.slice(2);

function argValue(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

const phase = argValue('--phase');
const selectedCase = argValue('--case');
const resume = args.includes('--resume');
if (!['baseline', 'after', 'control'].includes(phase)) throw new Error('Use --phase baseline|after|control.');
if (selectedCase && !suite.skills.some((skill) => skill.cases.some((item) => item.id === selectedCase))) {
  throw new Error(`Unknown case: ${selectedCase}`);
}

async function findPluginEval() {
  const explicit = process.env.CODEX_PLUGIN_EVAL_SCRIPT
    || (process.env.CODEX_PLUGIN_EVAL_ROOT && path.join(process.env.CODEX_PLUGIN_EVAL_ROOT, 'scripts/plugin-eval.js'));
  if (explicit) return path.resolve(explicit);
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const root = path.join(codexHome, 'plugins/cache/openai-curated/plugin-eval');
  const candidates = [];
  try {
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const script = path.join(root, entry.name, 'scripts/plugin-eval.js');
      if (await exists(script)) candidates.push(script);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!candidates.length) throw new Error('OpenAI Plugin Eval was not found; install plugin-eval@openai-curated.');
  return candidates.sort().at(-1);
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, stdout, stderr }));
  });
}

async function copyBaselineSkill(skillName, destination) {
  const relative = path.relative(repoRoot, path.join(packageRoot, 'skills', skillName));
  const listing = await run('git', ['ls-tree', '-r', '--name-only', suite.baselineRef, '--', relative], { cwd: repoRoot });
  if (listing.code !== 0) throw new Error(`Cannot enumerate baseline Skill ${skillName}: ${listing.stderr}`);
  const tracked = listing.stdout.split(/\r?\n/).filter(Boolean);
  if (!tracked.includes(`${relative}/SKILL.md`)) throw new Error(`Baseline does not contain ${relative}/SKILL.md`);
  for (const file of tracked) {
    const blob = await run('git', ['show', `${suite.baselineRef}:${file}`], { cwd: repoRoot });
    if (blob.code !== 0) throw new Error(`Cannot read baseline file ${file}: ${blob.stderr}`);
    const outputPath = path.join(destination, path.relative(relative, file));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, blob.stdout, 'utf8');
  }
}

async function createSafeAuthSource(parentDir) {
  const source = path.join(parentDir, 'codex-home-source');
  await fs.mkdir(source, { recursive: true });
  const sourceHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const authPath = path.join(sourceHome, 'auth.json');
  if (await exists(authPath)) {
    await fs.copyFile(authPath, path.join(source, 'auth.json'));
  } else if (!process.env.OPENAI_API_KEY) {
    throw new Error(`Codex auth is not available at ${authPath}, and OPENAI_API_KEY is unset.`);
  }
  // Deliberately omit the user's config.toml: it contains registered MCP servers.
  await fs.writeFile(path.join(source, 'config.toml'), `model = "${suite.model}"\nmodel_reasoning_effort = "${suite.reasoningEffort}"\n`, 'utf8');
  return source;
}

const pluginEval = await findPluginEval();
const outputRoot = path.resolve(argValue('--output-dir') || '/private/tmp/cocos-skill-benchmark');
const phaseRoot = path.join(outputRoot, phase);
const runRoot = await fs.mkdtemp(path.join(os.tmpdir(), `cocos-skill-${phase}-`));
await fs.mkdir(phaseRoot, { recursive: true });
const safeAuthSource = await createSafeAuthSource(runRoot);
const verifyScript = path.join(scriptDir, 'verify-case.mjs');
const fixtureWorkspace = path.join(scriptDir, 'workspace');
const controlSkillSource = path.join(scriptDir, 'control-skill');
const jobs = selectedCase
  ? suite.skills.flatMap((skill) => skill.cases
    .filter((testCase) => testCase.id === selectedCase)
    .map((testCase) => ({ skill, testCases: [testCase] })))
  : suite.skills.map((skill) => ({ skill, testCases: skill.cases }));
const results = [];
if (resume && await exists(path.join(phaseRoot, 'summary.json'))) {
  const previous = JSON.parse(await fs.readFile(path.join(phaseRoot, 'summary.json'), 'utf8'));
  if (previous.phase !== phase || previous.model !== suite.model || previous.reasoningEffort !== suite.reasoningEffort) {
    throw new Error(`Cannot resume ${phase}: the saved summary has different phase or model settings.`);
  }
  for (const result of previous.results || []) {
    const skill = suite.skills.find((entry) => entry.name === result.skill);
    const testCases = selectedCase ? skill?.cases.filter((testCase) => testCase.id === selectedCase) : skill?.cases;
    if (!testCases?.length || !testCases.every((testCase) => result.caseIds?.includes(testCase.id))) continue;
    const configPath = path.join(phaseRoot, result.skill, result.caseId, 'benchmark.json');
    const evaluationPath = path.join(phaseRoot, result.skill, result.caseId, 'evaluation.json');
    if (await exists(configPath) && await exists(evaluationPath)) {
      try {
        const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
        const expectedPrompt = testCases.length === 1 ? testCases[0].userInput : batchPrompt(testCases);
        if (config.scenarios?.[0]?.userInput !== expectedPrompt) continue;
        JSON.parse(await fs.readFile(evaluationPath, 'utf8'));
        results.push(result);
      } catch {
        // Re-run entries without a valid captured answer.
      }
    }
  }
}
const pendingJobs = jobs.filter(({ skill, testCases }) => !results.some((result) => result.skill === skill.name
  && testCases.every((testCase) => result.caseIds?.includes(testCase.id))));
async function saveSummary() {
  await fs.writeFile(path.join(phaseRoot, 'summary.json'), `${JSON.stringify({ phase, baselineRef: suite.baselineRef,
    suiteFingerprint: currentTaskSetFingerprint, model: suite.model, reasoningEffort: suite.reasoningEffort, results }, null, 2)}\n`, 'utf8');
}
await saveSummary();

function batchPrompt(testCases) {
  const schema = '{"scope":"in_scope|out_of_scope|partial","action":"plan|observe|no_action|unsupported","target":string|null,"operation":string|null,"status":string,"evidence":string[],"mutations":[],"live_result_claimed":false,"summary":string}';
  return [
    'This is an offline evaluation batch with independent requests. Evaluate each request separately; do not carry one case\'s target, decision, or evidence into another.',
    'Write only evaluation.json as one raw JSON object. Use each case ID below as a top-level key and put that case\'s result object under it. Each value must follow this schema:',
    schema,
    'The repeated request to write evaluation.json inside a case means its answer belongs under that case ID. Do not overwrite or omit any case. The workspace is offline; make no Creator mutations and do not claim live results.',
    ...testCases.map((testCase) => `\n## Case ${testCase.id}\n${testCase.userInput}`),
  ].join('\n');
}

try {
  for (const { skill, testCases } of pendingJobs) {
    const caseIds = testCases.map((testCase) => testCase.id);
    const caseKey = caseIds.length === 1 ? caseIds[0] : `${skill.name}-task-set`;
    const skillPath = path.join(runRoot, 'targets', phase === 'control' ? 'eval-no-op-control' : skill.name);
    if (phase === 'baseline') await copyBaselineSkill(skill.name, skillPath);
    else if (phase === 'after') await fs.cp(path.join(packageRoot, 'skills', skill.name), skillPath, { recursive: true });
    else if (!await exists(skillPath)) await fs.cp(controlSkillSource, skillPath, { recursive: true });

    const caseRoot = path.join(phaseRoot, skill.name, caseKey);
    await fs.mkdir(caseRoot, { recursive: true });
    const configPath = path.join(caseRoot, 'benchmark.json');
    const resultPath = path.join(caseRoot, 'plugin-eval-result.json');
    const config = {
      kind: 'plugin-eval-benchmark',
      schemaVersion: 2,
      version: 2,
      targetKind: 'skill',
      targetName: phase === 'control' ? 'eval-no-op-control' : skill.name,
      runner: {
        type: 'codex-cli',
        model: suite.model,
        sandbox: 'workspace-write',
        approvalPolicy: 'never',
        extraArgs: ['-c', `model_reasoning_effort="${suite.reasoningEffort}"`],
      },
      workspace: { sourcePath: fixtureWorkspace, setupMode: 'copy', preserve: 'always' },
      targetProvisioning: { mode: 'isolated-skill-home' },
      verifiers: { commands: [`node "${verifyScript}" "${caseIds.join(',')}"`] },
      scenarios: [{
        id: caseKey,
        title: testCases.length === 1 ? testCases[0].title : `${skill.name} positive and boundary cases`,
        purpose: testCases.map((testCase) => testCase.purpose).join(' '),
        userInput: testCases.length === 1 ? testCases[0].userInput : batchPrompt(testCases),
        successChecklist: testCases.flatMap((testCase) => testCase.successChecklist),
      }],
    };
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    process.stdout.write(`[${phase}] ${skill.name} / ${caseIds.join(' + ')}\n`);
    const execution = await run(process.execPath, [pluginEval, 'benchmark', skillPath, '--config', configPath,
      '--result-out', resultPath, '--format', 'json'], {
      cwd: repoRoot,
      env: { ...process.env, PLUGIN_EVAL_CODEX_HOME_SOURCE: safeAuthSource },
    });
    await fs.writeFile(path.join(caseRoot, 'plugin-eval.stdout.json'), execution.stdout, 'utf8');
    await fs.writeFile(path.join(caseRoot, 'plugin-eval.stderr.log'), execution.stderr, 'utf8');
    if (execution.code !== 0) {
      process.stderr.write(execution.stderr || execution.stdout || `plugin-eval exited ${execution.code}\n`);
      throw new Error(`Benchmark failed for ${caseKey} (exit ${execution.code}).`);
    }
    const report = JSON.parse(await fs.readFile(resultPath, 'utf8'));
    const scenario = report.scenarios?.[0];
    if (!scenario) throw new Error(`No scenario result for ${testCase.id}.`);
    const caseResult = {
      phase,
      skill: skill.name,
      targetSkill: phase === 'control' ? 'eval-no-op-control' : skill.name,
      caseIds,
      caseId: caseKey,
      benchmarkStatus: scenario.status,
      exitCode: scenario.exitCode,
      verifierResults: scenario.verifierResults,
      codexVersion: report.codexVersion,
      model: report.config.model,
      durationMs: scenario.durationMs,
      usage: scenario.usage,
      workspaceSummary: scenario.workspaceSummary,
      finalMessagePreview: scenario.finalMessagePreview,
      evaluationPath: scenario.workspacePath ? path.join(scenario.workspacePath, suite.outputFile) : null,
    };
    if (scenario.workspacePath && await exists(caseResult.evaluationPath)) {
      await fs.copyFile(caseResult.evaluationPath, path.join(caseRoot, 'evaluation.json'));
    }
    if (scenario.finalMessagePath && await exists(scenario.finalMessagePath)) {
      await fs.copyFile(scenario.finalMessagePath, path.join(caseRoot, 'final-message.txt'));
    }
    if (scenario.rawEventLogPath && await exists(scenario.rawEventLogPath)) {
      await fs.copyFile(scenario.rawEventLogPath, path.join(caseRoot, 'codex.stdout.jsonl'));
    }
    if (scenario.stderrLogPath && await exists(scenario.stderrLogPath)) {
      await fs.copyFile(scenario.stderrLogPath, path.join(caseRoot, 'codex.stderr.log'));
    }
    for (const [index, verifier] of (scenario.verifierResults || []).entries()) {
      if (verifier.stdoutPath && await exists(verifier.stdoutPath)) {
        await fs.copyFile(verifier.stdoutPath, path.join(caseRoot, `verifier-${index + 1}.stdout.log`));
      }
      if (verifier.stderrPath && await exists(verifier.stderrPath)) {
        await fs.copyFile(verifier.stderrPath, path.join(caseRoot, `verifier-${index + 1}.stderr.log`));
      }
    }
    if (scenario.workspacePath && await exists(path.join(scenario.workspacePath, suite.outputFile))) {
      await fs.copyFile(path.join(scenario.workspacePath, suite.outputFile), path.join(caseRoot, suite.outputFile));
    }
    delete caseResult.evaluationPath;
    results.push(caseResult);
    await saveSummary();
    process.stdout.write(`  ${scenario.status}; ${scenario.verifierResults.map((item) => item.status).join(',')}; ${scenario.durationMs} ms\n`);
  }
} finally {
  await fs.rm(runRoot, { recursive: true, force: true });
}

process.stdout.write(`Saved ${results.length} skill results under ${phaseRoot}\n`);
