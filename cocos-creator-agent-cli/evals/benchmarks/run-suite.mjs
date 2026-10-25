#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { taskExecutionFingerprint, taskSetFingerprint } from './task-set.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const evalRoot = path.resolve(scriptDir, '..');
const packageRoot = path.resolve(evalRoot, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const suite = JSON.parse(await fs.readFile(path.join(scriptDir, 'suite.json'), 'utf8'));
const currentTaskSetFingerprint = taskSetFingerprint(suite);
const currentExecutionFingerprint = taskExecutionFingerprint(suite);
const args = process.argv.slice(2);

function argValue(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

const phase = argValue('--phase');
const selectedCase = argValue('--case');
const selectedSkill = argValue('--skill');
const resume = args.includes('--resume');
if (!['baseline', 'after', 'control'].includes(phase)) throw new Error('Use --phase baseline|after|control.');
if (selectedCase && !suite.skills.some((skill) => skill.cases.some((item) => item.id === selectedCase))) {
  throw new Error(`Unknown case: ${selectedCase}`);
}
if (selectedSkill && !suite.skills.some((skill) => skill.name === selectedSkill)) {
  throw new Error(`Unknown Skill: ${selectedSkill}`);
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
  const relativeCandidates = [
    path.relative(repoRoot, path.join(packageRoot, 'skills', skillName)),
    path.join('tools', 'cocos-creator-agent-cli', 'skills', skillName),
  ];
  let relative;
  let tracked;
  for (const candidate of relativeCandidates) {
    const listing = await run('git', ['ls-tree', '-r', '--name-only', suite.baselineRef, '--', candidate], { cwd: repoRoot });
    if (listing.code !== 0) throw new Error(`Cannot enumerate baseline Skill ${skillName}: ${listing.stderr}`);
    const files = listing.stdout.split(/\r?\n/).filter(Boolean);
    if (files.includes(`${candidate}/SKILL.md`)) {
      relative = candidate;
      tracked = files;
      break;
    }
  }
  if (!relative || !tracked) throw new Error(`Baseline does not contain Skill ${skillName} under either known package path.`);
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
await fs.mkdir(phaseRoot, { recursive: true });
const codexVersionResult = await run('codex', ['--version'], { cwd: repoRoot });
if (codexVersionResult.code !== 0) throw new Error(`Cannot read Codex CLI version: ${codexVersionResult.stderr}`);
const codexVersion = codexVersionResult.stdout.trim().split(/\r?\n/).at(-1) || 'unknown';
const verifyScript = path.join(scriptDir, 'verify-case.mjs');
const fixtureWorkspace = path.join(scriptDir, 'workspace');
const controlSkillSource = path.join(scriptDir, 'control-skill');
const phaseSkillNames = phase === 'baseline'
  ? suite.baselineSkills
  : phase === 'control'
    ? suite.deepSkills
    : suite.skills.map((skill) => skill.name);
if (!Array.isArray(phaseSkillNames) || phaseSkillNames.length === 0) throw new Error(`No Skill group configured for ${phase}.`);
const allPhaseSkills = phaseSkillNames.map((name) => suite.skills.find((skill) => skill.name === name));
if (allPhaseSkills.some((skill) => !skill)) throw new Error(`The ${phase} Skill group references an unknown Skill.`);
let phaseSkills = allPhaseSkills;
if (selectedSkill) phaseSkills = phaseSkills.filter((skill) => skill.name === selectedSkill);
if (selectedCase) phaseSkills = phaseSkills.filter((skill) => skill.cases.some((item) => item.id === selectedCase));
if (!phaseSkills.length) throw new Error(`No Skills selected for ${phase}.`);
const jobs = selectedCase
  ? phaseSkills.flatMap((skill) => skill.cases
    .filter((testCase) => testCase.id === selectedCase)
    .map((testCase) => ({ skill, testCases: [testCase] })))
  : phaseSkills.map((skill) => ({ skill, testCases: skill.cases }));
const results = [];
let rubricRevisionSourceFingerprint;
async function savedPromptsMatchCurrentSuite(previous) {
  if (!previous.results?.length) return false;
  for (const result of previous.results) {
    const skill = allPhaseSkills.find((entry) => entry.name === result.skill);
    if (!skill) return false;
    const testCases = result.caseIds?.length
      ? skill.cases.filter((testCase) => result.caseIds.includes(testCase.id))
      : result.caseId === `${skill.name}-task-set`
        ? skill.cases
        : skill.cases.filter((testCase) => testCase.id === result.caseId);
    if (!testCases.length) return false;
    const configPath = path.join(phaseRoot, result.skill, result.caseId, 'benchmark.json');
    if (!await exists(configPath)) return false;
    let config;
    try { config = JSON.parse(await fs.readFile(configPath, 'utf8')); }
    catch { return false; }
    const expectedKey = testCases.length === 1 ? testCases[0].id : `${skill.name}-task-set`;
    const scenario = config.scenarios?.[0];
    if (config.targetName !== (phase === 'control' ? 'eval-no-op-control' : skill.name)
        || config.runner?.model !== suite.model
        || config.runner?.extraArgs?.[0] !== '-c'
        || config.runner?.extraArgs?.[1] !== `model_reasoning_effort="${suite.reasoningEffort}"`
        || config.workspace?.sourcePath !== fixtureWorkspace
        || scenario?.id !== expectedKey
        || scenario.title !== (testCases.length === 1 ? testCases[0].title : `${skill.name} positive and boundary cases`)
        || scenario.purpose !== testCases.map((testCase) => testCase.purpose).join(' ')
        || JSON.stringify(scenario.successChecklist) !== JSON.stringify(testCases.flatMap((testCase) => testCase.successChecklist))
        || scenario.userInput !== (testCases.length === 1 ? testCases[0].userInput : batchPrompt(testCases))) return false;
  }
  return true;
}
if (resume && await exists(path.join(phaseRoot, 'summary.json'))) {
  const previous = JSON.parse(await fs.readFile(path.join(phaseRoot, 'summary.json'), 'utf8'));
  if (previous.phase !== phase || previous.model !== suite.model || previous.reasoningEffort !== suite.reasoningEffort
      || previous.codexVersion !== codexVersion) {
    throw new Error(`Cannot resume ${phase}: the saved summary has different phase, model settings, or Codex CLI version.`);
  }
  const promptFingerprintMatches = previous.executionFingerprint === currentExecutionFingerprint
    || await savedPromptsMatchCurrentSuite(previous);
  const rubricOnlyRevision = previous.suiteFingerprint !== currentTaskSetFingerprint && promptFingerprintMatches;
  if (previous.suiteFingerprint !== currentTaskSetFingerprint && !rubricOnlyRevision) {
    throw new Error(`Cannot resume ${phase}: prompts or execution settings changed; only a rubric-only revision can reuse model outputs.`);
  }
  if (rubricOnlyRevision) rubricRevisionSourceFingerprint = previous.suiteFingerprint;
  for (const result of previous.results || []) {
    const skill = allPhaseSkills.find((entry) => entry.name === result.skill);
    if (skill && !phaseSkills.some((entry) => entry.name === skill.name)) {
      results.push(result);
      continue;
    }
    const testCases = selectedCase ? skill?.cases.filter((testCase) => testCase.id === selectedCase) : skill?.cases;
    if (!testCases?.length) continue;
    const configPath = path.join(phaseRoot, result.skill, result.caseId, 'benchmark.json');
    const pluginResultPath = path.join(phaseRoot, result.skill, result.caseId, 'plugin-eval-result.json');
    const evaluationPath = path.join(phaseRoot, result.skill, result.caseId, 'evaluation.json');
    if (await exists(configPath)) {
      try {
        const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
        const expectedPrompt = testCases.length === 1 ? testCases[0].userInput : batchPrompt(testCases);
        const scenario = config.scenarios?.[0];
        if (scenario?.userInput !== expectedPrompt
            || JSON.stringify(scenario.successChecklist) !== JSON.stringify(testCases.flatMap((testCase) => testCase.successChecklist))
            || config.runner?.model !== suite.model) continue;
        let recovered = result;
        if (!await exists(evaluationPath) && await exists(pluginResultPath)) {
          const pluginResult = JSON.parse(await fs.readFile(pluginResultPath, 'utf8'));
          const pluginScenario = pluginResult.scenarios?.[0];
          const sourceEvaluation = pluginScenario?.workspacePath
            ? path.join(pluginScenario.workspacePath, suite.outputFile) : undefined;
          if (sourceEvaluation && await exists(sourceEvaluation)) {
            await fs.copyFile(sourceEvaluation, evaluationPath);
            recovered = {
              ...result,
              targetSkill: result.targetSkill || pluginResult.config?.targetName,
              caseIds: testCases.map((testCase) => testCase.id),
              benchmarkStatus: pluginScenario.status,
              exitCode: pluginScenario.exitCode,
              verifierResults: pluginScenario.verifierResults,
              codexVersion: pluginResult.codexVersion || codexVersion,
              model: pluginResult.config?.model || suite.model,
              durationMs: pluginScenario.durationMs,
              usage: pluginScenario.usage,
              workspaceSummary: pluginScenario.workspaceSummary,
              finalMessagePreview: pluginScenario.finalMessagePreview,
              outcome: 'model_output_captured',
              transportWarnings: pluginScenario.telemetry?.errorMessages || [],
              recoveredFromPluginEvalResult: true,
              sourceSuiteFingerprint: previous.suiteFingerprint,
            };
          }
        }
        if (!recovered.caseIds?.length || !testCases.every((testCase) => recovered.caseIds.includes(testCase.id))) continue;
        results.push(recovered);
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
    suiteFingerprint: currentTaskSetFingerprint, executionFingerprint: currentExecutionFingerprint,
    rubricRevisionSourceFingerprint,
    model: suite.model, reasoningEffort: suite.reasoningEffort,
    codexVersion, results }, null, 2)}\n`, 'utf8');
}
await saveSummary();

function batchPrompt(testCases) {
  const schema = '{"route":string|null,"scope":"in_scope|out_of_scope|partial relative to the loaded Skill","action":"plan|propose|observe|no_action|unsupported","target":string|null,"operation":string|null,"status":string,"evidence":string[],"mutations":[],"live_result_claimed":false,"summary":string}';
  return [
    'This is an offline evaluation batch with independent requests. Evaluate each request separately; do not carry one case\'s target, decision, or evidence into another.',
    'Use a shell command to create only evaluation.json as one raw JSON object. Use each case ID below as a top-level key and put that case\'s result object under it. Each value must follow this schema exactly:',
    schema,
    'Writing evaluation.json is the only allowed workspace change. Do not overwrite or omit any case. The workspace is offline; use no Creator/MCP tools, do not edit project or fixture assets, and do not claim live results. The route must be the narrowest Skill ID or null.',
    'The workspace includes skill-catalog.json with all available Skill IDs by name. Use it to identify the narrowest sibling route when needed; do not invent IDs. Only the target Skill full instructions are loaded.',
    ...testCases.map((testCase) => `\n## Case ${testCase.id}\n${testCase.userInput}`),
  ].join('\n');
}

const runRoot = await fs.mkdtemp(path.join(os.tmpdir(), `cocos-skill-${phase}-`));
try {
  const safeAuthSource = await createSafeAuthSource(runRoot);
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
    let execution;
    let report;
    let scenario;
    try {
      execution = await run(process.execPath, [pluginEval, 'benchmark', skillPath, '--config', configPath,
        '--result-out', resultPath, '--format', 'json'], {
        cwd: repoRoot,
        env: { ...process.env, PLUGIN_EVAL_CODEX_HOME_SOURCE: safeAuthSource },
      });
      await fs.writeFile(path.join(caseRoot, 'plugin-eval.stdout.json'), execution.stdout, 'utf8');
      await fs.writeFile(path.join(caseRoot, 'plugin-eval.stderr.log'), execution.stderr, 'utf8');
      if (execution.code !== 0) throw new Error(`plugin-eval exited ${execution.code}: ${execution.stderr || execution.stdout}`);
      report = JSON.parse(await fs.readFile(resultPath, 'utf8'));
      scenario = report.scenarios?.[0];
      if (!scenario) throw new Error('Plugin Eval returned no scenario result.');
    } catch (error) {
      const message = String(error?.message || error);
      process.stderr.write(`INFRA ${skill.name}: ${message}\n`);
      results.push({ phase, skill: skill.name, targetSkill: phase === 'control' ? 'eval-no-op-control' : skill.name,
        caseIds: [], caseId: caseKey, outcome: 'infrastructure_error', error: message });
      await saveSummary();
      continue;
    }
    const telemetryErrors = scenario.telemetry?.errorMessages || [];
    const infrastructureText = [scenario.usage?.raw?.message, ...telemetryErrors].filter(Boolean).join('\n');
    const evaluationArtifact = scenario.workspacePath ? path.join(scenario.workspacePath, suite.outputFile) : undefined;
    const modelOutputCaptured = evaluationArtifact && await exists(evaluationArtifact);
    if (scenario.status === 'failed' && !modelOutputCaptured
        && /workspace routing discovery failed|request timed out|timed out|rate limit|connection reset|service unavailable|gateway error/i.test(infrastructureText)) {
      const message = infrastructureText || 'Plugin Eval reported a provider or workspace-routing failure.';
      process.stderr.write(`INFRA ${skill.name}: ${message}\n`);
      results.push({ phase, skill: skill.name, targetSkill: phase === 'control' ? 'eval-no-op-control' : skill.name,
        caseIds: [], caseId: caseKey, outcome: 'infrastructure_error', error: message,
        codexVersion: report.codexVersion || codexVersion, model: report.config?.model || suite.model });
      await saveSummary();
      continue;
    }
    const caseResult = {
      phase,
      skill: skill.name,
      targetSkill: phase === 'control' ? 'eval-no-op-control' : skill.name,
      caseIds,
      caseId: caseKey,
      benchmarkStatus: scenario.status,
      exitCode: scenario.exitCode,
      verifierResults: scenario.verifierResults,
      codexVersion: report.codexVersion || codexVersion,
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
