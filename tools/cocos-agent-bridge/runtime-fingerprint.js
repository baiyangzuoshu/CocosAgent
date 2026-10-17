'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function fingerprintFiles(root, relativePaths) {
    const hash = crypto.createHash('sha256');
    for (const relativePath of [...new Set(relativePaths)].sort()) {
        const absolutePath = path.join(root, relativePath);
        hash.update(relativePath.replace(/\\/g, '/'));
        hash.update('\0');
        hash.update(fs.readFileSync(absolutePath));
        hash.update('\0');
    }
    return hash.digest('hex');
}

function listFiles(root, directory = '') {
    const absolutePath = path.join(root, directory);
    const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    return entries.flatMap((entry) => {
        if (entry.isDirectory()) return listFiles(root, path.join(directory, entry.name));
        if (entry.isFile()) return [path.join(directory, entry.name).replace(/\\/g, '/')];
        return [];
    }).sort();
}

const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.json', '.mjs']);
const TEST_FILE = /(?:^|\.)(?:test|spec|mock-test)\.[^.]+$/i;

function listFilteredFiles(root, excludedDirectories, includeFile, directory = '') {
    const absolutePath = path.join(root, directory);
    return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
        const relative = path.join(directory, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) return excludedDirectories.has(entry.name) || TEST_FILE.test(entry.name)
            ? [] : listFilteredFiles(root, excludedDirectories, includeFile, relative);
        return entry.isFile() && includeFile(relative) ? [relative] : [];
    }).sort();
}

function isRuntimeSource(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/');
    const basename = path.posix.basename(normalized);
    return !normalized.split('/').includes('node_modules')
        && !TEST_FILE.test(basename)
        && SOURCE_EXTENSIONS.has(path.posix.extname(basename));
}

function isRuntimeCode(relativePath) {
    return ['.cjs', '.js', '.mjs'].includes(path.posix.extname(relativePath.replace(/\\/g, '/')));
}

function resolveLocalModule(fromFile, specifier, allowedRoot) {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [base, ...['.mjs', '.js', '.cjs', '.json'].map((ext) => `${base}${ext}`),
        ...['index.mjs', 'index.js', 'index.cjs', 'index.json'].map((name) => path.join(base, name))];
    for (const candidate of candidates) {
        if (!candidate.startsWith(`${allowedRoot}${path.sep}`)) continue;
        try {
            if (fs.statSync(candidate).isFile() && isRuntimeSource(path.relative(allowedRoot, candidate))) return candidate;
        } catch (_) {}
    }
    return null;
}

// Fingerprint the MCP package source set from its contents and local imports.
// New files inside the MCP package are picked up automatically; local runtime
// modules imported from the bridge parent are followed transitively.
function mcpRuntimeFiles(mcpRoot) {
    const root = path.resolve(mcpRoot);
    const allowedRoot = path.dirname(root);
    const files = new Set(listFilteredFiles(root, new Set(['node_modules']), isRuntimeSource));
    files.add('package.json');
    files.add('package-lock.json');
    const queue = [...files].filter(isRuntimeCode).map((relative) => path.join(root, relative));
    const visited = new Set();
    const importPattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g;
    while (queue.length) {
        const filename = queue.pop();
        if (visited.has(filename)) continue;
        visited.add(filename);
        let source;
        try { source = fs.readFileSync(filename, 'utf8'); } catch (_) { continue; }
        for (const match of source.matchAll(importPattern)) {
            const dependency = resolveLocalModule(filename, match[1], allowedRoot);
            if (!dependency) continue;
            const relative = path.relative(root, dependency).replace(/\\/g, '/');
            files.add(relative);
            if (!visited.has(dependency)) queue.push(dependency);
        }
    }
    return [...files].sort();
}

function creatorExtensionFiles(extensionRoot) {
    return listFilteredFiles(extensionRoot, new Set(['assistant-runtime', 'node_modules', '.git']), () => true);
}

function fingerprintCreatorExtension(extensionRoot) {
    return fingerprintFiles(extensionRoot, creatorExtensionFiles(extensionRoot));
}

module.exports = { fingerprintFiles, listFiles, mcpRuntimeFiles, creatorExtensionFiles, fingerprintCreatorExtension };
