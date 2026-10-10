#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPOSITORY_ROOT = path.resolve(PLUGIN_ROOT, '../..');
const PACKAGE_FILE = path.join(PLUGIN_ROOT, 'skill-package.json');

function sha256(bytes) {
    return crypto.createHash('sha256').update(bytes).digest('hex');
}

function containedPath(root, relativePath) {
    const target = path.resolve(root, relativePath);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        throw new Error(`Path escapes package root: ${relativePath}`);
    }
    return target;
}

function parseFrontmatter(skillPath) {
    const text = fs.readFileSync(skillPath, 'utf8');
    const match = text.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
    if (!match) throw new Error(`Missing YAML frontmatter: ${path.relative(PLUGIN_ROOT, skillPath)}`);
    const name = match[1].match(/^name:\s*([a-z0-9-]+)\s*$/m)?.[1];
    const description = match[1].match(/^description:\s*(.+?)\s*$/m)?.[1];
    if (!name || !description) throw new Error(`Frontmatter needs name and description: ${path.relative(PLUGIN_ROOT, skillPath)}`);
    return { name, description, text };
}

function referenceUri(id) {
    return `cocos://2x/references/${id}`;
}

function skillUri(name, manifest) {
    return manifest.skills.find((item) => item.name === name)?.uri;
}

function checkSkillLinks(skillPath, skillNames) {
    const { text } = parseFrontmatter(skillPath);
    for (const [, target] of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const raw = target.split('#', 1)[0];
        if (!raw || ['http://', 'https://', 'cocos://', '#'].some((prefix) => raw.startsWith(prefix))) continue;
        const resolved = path.resolve(path.dirname(skillPath), raw);
        if (!resolved.startsWith(`${PLUGIN_ROOT}${path.sep}`)) {
            throw new Error(`Skill link escapes plugin package: ${path.relative(PLUGIN_ROOT, skillPath)} -> ${target}`);
        }
        if (!fs.existsSync(resolved)) {
            throw new Error(`Unpackaged skill reference: ${path.relative(PLUGIN_ROOT, skillPath)} -> ${target}`);
        }
        if (resolved.endsWith(`${path.sep}SKILL.md`)) {
            const siblingName = path.basename(path.dirname(resolved));
            if (!skillNames.has(siblingName)) throw new Error(`Skill links to an unregistered skill: ${siblingName}`);
        }
    }
}

function validatePackage(mode = 'check') {
    const manifest = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.skills) || !Array.isArray(manifest.references)) {
        throw new Error('Unsupported skill package manifest.');
    }

    const skillNames = new Set(manifest.skills.map((item) => item.name));
    if (skillNames.size !== manifest.skills.length) throw new Error('Skill names must be unique.');
    const onDisk = fs.readdirSync(path.join(PLUGIN_ROOT, 'skills'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const declared = [...skillNames].sort();
    if (JSON.stringify(onDisk) !== JSON.stringify(declared)) {
        throw new Error(`Installed skill folders differ from package index: disk=${onDisk.join(',')} manifest=${declared.join(',')}`);
    }

    const referenceIds = new Set();
    for (const reference of manifest.references) {
        if (!/^[a-z0-9][a-z0-9./_-]*$/.test(reference.id) || referenceIds.has(reference.id)) {
            throw new Error(`Invalid or duplicate skill reference id: ${reference.id}`);
        }
        referenceIds.add(reference.id);
        const source = containedPath(REPOSITORY_ROOT, reference.source);
        const target = containedPath(PLUGIN_ROOT, path.join('references', reference.id));
        if (!source.startsWith(`${path.join(REPOSITORY_ROOT, 'docs')}${path.sep}`) || !fs.existsSync(source)) {
            throw new Error(`Skill reference source is missing or outside docs/: ${reference.source}`);
        }
        if (mode === 'sync') {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(source, target);
        } else if (!fs.existsSync(target) || sha256(fs.readFileSync(source)) !== sha256(fs.readFileSync(target))) {
            throw new Error(`Packaged reference is missing or stale: ${reference.id}`);
        }
    }

    for (const skill of manifest.skills) {
        if (!/^cocos2?-[a-z0-9-]+$/.test(skill.name) && skill.name !== 'cocos-agent') {
            throw new Error(`Invalid skill name: ${skill.name}`);
        }
        const skillPath = containedPath(PLUGIN_ROOT, path.join('skills', skill.name, 'SKILL.md'));
        const parsed = parseFrontmatter(skillPath);
        if (parsed.name !== skill.name) throw new Error(`Folder/frontmatter name mismatch: ${skill.name} != ${parsed.name}`);
        for (const id of skill.references) {
            if (!referenceIds.has(id)) throw new Error(`Unknown reference ${id} in skill ${skill.name}`);
        }
        checkSkillLinks(skillPath, skillNames);
    }

    for (const name of manifest.canonicalDocs ?? []) {
        const pointerPath = path.join(REPOSITORY_ROOT, 'docs/agent-foundation/skills', name, 'SKILL.md');
        const canonicalPath = path.join(PLUGIN_ROOT, 'skills', name, 'SKILL.md');
        if (!fs.existsSync(pointerPath) || !fs.readFileSync(pointerPath, 'utf8').includes(`plugins/cocos-agent-2x/skills/${name}/SKILL.md`)
            || !fs.existsSync(canonicalPath)) {
            throw new Error(`Docs entry does not point to its packaged canonical skill: ${name}`);
        }
    }

    const pluginManifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.codex-plugin/plugin.json'), 'utf8'));
    const indexed = manifest.skills.map((skill) => {
        const skillPath = path.join(PLUGIN_ROOT, 'skills', skill.name, 'SKILL.md');
        const parsed = parseFrontmatter(skillPath);
        return {
            name: skill.name,
            description: parsed.description,
            uri: skill.uri,
            sha256: sha256(fs.readFileSync(skillPath)),
            references: skill.references.map((id) => {
                const reference = manifest.references.find((item) => item.id === id);
                const referencePath = path.join(PLUGIN_ROOT, 'references', id);
                return { id, uri: referenceUri(id), sha256: sha256(fs.readFileSync(referencePath)) };
            }),
        };
    });
    return {
        manifest,
        plugin: { name: pluginManifest.name, version: pluginManifest.version },
        skills: indexed,
        referenceCount: manifest.references.length,
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try {
        const mode = process.argv.includes('--sync') ? 'sync' : 'check';
        const result = validatePackage(mode);
        process.stdout.write(`${mode === 'sync' ? 'Synchronized' : 'Verified'} ${result.skills.length} skills and ${result.referenceCount} references for ${result.plugin.name}@${result.plugin.version}.\n`);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}

export { referenceUri, validatePackage };
