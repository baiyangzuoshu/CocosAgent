#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillsRoot = path.resolve(scriptDir, '../skills');
const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function parseArgs() {
  const skills = args.flatMap((arg, index) => arg === '--skill' ? [args[index + 1]] : []);
  const format = option('--format') || 'markdown';
  if (!['json', 'markdown'].includes(format)) throw new Error('--format must be json or markdown');
  if (skills.some((name) => !name || name.startsWith('--'))) throw new Error('--skill requires a skill directory name');
  return { skills, format, output: option('--output'), skillsRoot: option('--skills-root') || defaultSkillsRoot,
    pluginEvalScript: option('--plugin-eval-script') };
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function resolvePluginEvalScript(explicitPath) {
  const override = explicitPath || process.env.CODEX_PLUGIN_EVAL_SCRIPT
    || (process.env.CODEX_PLUGIN_EVAL_ROOT && path.join(process.env.CODEX_PLUGIN_EVAL_ROOT, 'scripts/plugin-eval.js'));
  if (override) {
    const script = path.resolve(override);
    if (!fs.existsSync(script)) throw new Error(`Plugin Eval CLI not found: ${script}`);
    return { script, version: JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(script)), 'package.json'), 'utf8')).version || 'unknown' };
  }
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const cacheRoot = path.join(codexHome, 'plugins/cache/openai-curated/plugin-eval');
  const candidates = [];
  try {
    for (const entry of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const root = path.join(cacheRoot, entry.name);
      const script = path.join(root, 'scripts/plugin-eval.js');
      const packagePath = path.join(root, 'package.json');
      if (!fs.existsSync(script) || !fs.existsSync(packagePath)) continue;
      const version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || '0.0.0';
      candidates.push({ script, version });
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  candidates.sort((a, b) => compareVersions(a.version, b.version));
  if (!candidates.length) {
    throw new Error('Plugin Eval CLI not found. Install plugin-eval@openai-curated or pass --plugin-eval-script <path>.');
  }
  return candidates.at(-1);
}

function countBy(items, select) {
  return Object.fromEntries([...new Set(items.map(select))].sort().map((key) => [key, items.filter((item) => select(item) === key).length]));
}

function markdownReport(report) {
  const lines = [
    '# Cocos Creator Skill static evaluation',
    '',
    `Generated: ${report.generatedAt}`,
    `Plugin Eval: ${report.pluginEvalVersion}`,
    `Skills analyzed: ${report.analyzed}`,
    `Grades: ${Object.entries(report.gradeCounts).map(([grade, count]) => `${grade} ${count}`).join(', ')}`,
    '',
    'This is a static structure and token-budget scan. It does not measure skill selection, task success, or Creator runtime behavior.',
    '',
    '| Skill | Score | Grade | Static findings |',
    '| --- | ---: | :---: | --- |',
  ];
  for (const item of report.results) {
    const findings = item.findings.map((finding) => finding.id).join(', ') || '—';
    lines.push(`| ${item.name} | ${item.score} | ${item.grade} | ${findings} |`);
  }
  lines.push('', '## Finding counts', '');
  for (const [id, count] of Object.entries(report.findingCounts)) lines.push(`- ${id}: ${count}`);
  lines.push('', 'The `description-trigger-weak` check currently requires the literal phrase “Use when”. Treat it as a review cue, not a proven activation defect; inspect each description for a clear positive and negative trigger boundary before editing.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const options = parseArgs();
  const skillsRoot = path.resolve(options.skillsRoot);
  if (!fs.statSync(skillsRoot).isDirectory()) throw new Error(`Skills root is not a directory: ${skillsRoot}`);
  const pluginEval = resolvePluginEvalScript(options.pluginEvalScript);
  const discovered = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(skillsRoot, name, 'SKILL.md')))
    .sort();
  const selected = options.skills.length ? discovered.filter((name) => options.skills.includes(name)) : discovered;
  const missing = options.skills.filter((name) => !discovered.includes(name));
  if (missing.length) throw new Error(`Unknown skill(s): ${missing.join(', ')}`);
  if (!selected.length) throw new Error(`No SKILL.md files found under ${skillsRoot}`);

  const results = [];
  for (const name of selected) {
    const skillPath = path.join(skillsRoot, name);
    const run = spawnSync(process.execPath, [pluginEval.script, 'analyze', skillPath, '--format', 'json'], {
      cwd: path.resolve(skillsRoot, '..', '..', '..'), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`Plugin Eval failed for ${name}: ${run.stderr || run.stdout}`);
    let evaluation;
    try { evaluation = JSON.parse(run.stdout); }
    catch (error) { throw new Error(`Plugin Eval returned invalid JSON for ${name}: ${error.message}`); }
    results.push({
      name,
      score: evaluation.summary.score,
      grade: evaluation.summary.grade,
      riskLevel: evaluation.summary.riskLevel,
      topRecommendations: evaluation.summary.topRecommendations,
      budgets: evaluation.budgets,
      findings: evaluation.checks.filter((check) => ['warn', 'fail'].includes(check.status))
        .map(({ id, status, severity, message }) => ({ id, status, severity, message })),
      sourceSha256: hashFile(path.join(skillPath, 'SKILL.md')),
    });
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    targetRoot: skillsRoot,
    pluginEvalVersion: pluginEval.version,
    analyzed: results.length,
    gradeCounts: countBy(results, (item) => item.grade),
    findingCounts: Object.fromEntries([...new Set(results.flatMap((item) => item.findings.map((finding) => finding.id)))].sort()
      .map((id) => [id, results.reduce((total, item) => total + item.findings.filter((finding) => finding.id === id).length, 0)])),
    results,
  };
  const content = options.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : `${markdownReport(report)}\n`;
  if (options.output) fs.writeFileSync(path.resolve(options.output), content, 'utf8');
  else process.stdout.write(content);
}

function hashFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

try { main(); }
catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
