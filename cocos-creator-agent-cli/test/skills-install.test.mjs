import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { installSkills, listSkillStatus, showSkill } from '../skills.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join('/private/tmp', 'cocos-cli-skills-'));
  const skillsRoot = path.join(root, 'bundle', 'skills');
  const referencesRoot = path.join(root, 'bundle', 'references', '2x');
  fs.mkdirSync(path.join(skillsRoot, 'cocos-agent'), { recursive: true });
  fs.mkdirSync(path.join(skillsRoot, 'cocos2-cli'), { recursive: true });
  fs.mkdirSync(referencesRoot, { recursive: true });
  fs.writeFileSync(path.join(skillsRoot, 'cocos-agent', 'SKILL.md'), '---\nname: cocos-agent\n---\nRouter v1\n');
  fs.writeFileSync(path.join(skillsRoot, 'cocos2-cli', 'SKILL.md'), '---\nname: cocos2-cli\n---\nCLI v1\n');
  fs.writeFileSync(path.join(referencesRoot, 'README.md'), 'Creator 2.4.15 reference\n');
  return { root, skillsRoot, referencesRoot };
}

test('skill install writes client-native local skill paths and shared references', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const project = path.join(fx.root, 'project');
  fs.mkdirSync(project);
  const result = installSkills('codex', { local: true, cwd: project, home: fx.root,
    skillsRoot: fx.skillsRoot, referencesRoot: fx.referencesRoot, packageVersion: '0.8.0' });
  assert.equal(result.success, true);
  assert.equal(result.installedCount, 3);
  assert.equal(fs.readFileSync(path.join(project, '.agents/skills/cocos-agent/SKILL.md'), 'utf8').includes('Router v1'), true);
  assert.equal(fs.readFileSync(path.join(project, '.agents/references/2x/README.md'), 'utf8'), 'Creator 2.4.15 reference\n');
  assert.deepEqual(listSkillStatus('codex', { local: true, cwd: project, home: fx.root, skillsRoot: fx.skillsRoot })
    .map(({ name, status }) => ({ name, status })), [
      { name: 'cocos-agent', status: 'installed' }, { name: 'cocos2-cli', status: 'installed' },
    ]);
});

test('skill refresh detects edits and force refresh keeps a recoverable backup', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const project = path.join(fx.root, 'project');
  fs.mkdirSync(project);
  installSkills('claude-code', { local: true, cwd: project, home: fx.root,
    selected: ['cocos-agent'], skillsRoot: fx.skillsRoot, referencesRoot: fx.referencesRoot });
  const target = path.join(project, '.claude/skills/cocos-agent/SKILL.md');
  fs.appendFileSync(target, 'manual edit\n');
  const blocked = installSkills('claude-code', { local: true, cwd: project, home: fx.root,
    selected: ['cocos-agent'], skillsRoot: fx.skillsRoot, referencesRoot: fx.referencesRoot });
  assert.equal(blocked.success, false);
  assert.equal(blocked.results[0].status, 'conflict-modified');
  const replaced = installSkills('claude-code', { local: true, cwd: project, home: fx.root, force: true,
    selected: ['cocos-agent'], skillsRoot: fx.skillsRoot, referencesRoot: fx.referencesRoot });
  assert.equal(replaced.success, true);
  assert.match(replaced.results[0].backup, /skill-backups/);
  assert.equal(fs.readFileSync(target, 'utf8').includes('manual edit'), false);
  assert.equal(fs.readFileSync(path.join(replaced.results[0].backup, 'SKILL.md'), 'utf8').includes('manual edit'), true);
});

test('skill install refuses to replace an unmanaged target and skill show is read-only', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const project = path.join(fx.root, 'project');
  const target = path.join(project, '.agents/skills/cocos-agent');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'SKILL.md'), 'user-owned\n');
  const result = installSkills('codex', { local: true, cwd: project, home: fx.root,
    selected: ['cocos-agent'], skillsRoot: fx.skillsRoot, referencesRoot: fx.referencesRoot });
  assert.equal(result.success, false);
  assert.equal(result.results[0].status, 'conflict-unmanaged');
  assert.equal(fs.existsSync(path.join(project, '.agents/references/2x/README.md')), false, 'a conflict must not partially install shared references');
  assert.match(showSkill('cocos-agent', { skillsRoot: fx.skillsRoot }), /Router v1/);
  assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8'), 'user-owned\n');
});
