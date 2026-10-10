'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sourceInspect = require('./prefab-source-inspect');

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const fail = (message) => { process.stderr.write(`${message}\n`); process.exit(2); };
const projectRoot = path.resolve(arg('--project') || '.');
const creatorVersion = arg('--creator-version');
const prefabUuid = arg('--prefab-uuid');
const UUID = /^[0-9a-f-]{36}$/i;
if (!fs.existsSync(projectRoot) || creatorVersion !== '2.4.15' || !UUID.test(prefabUuid || '')) fail('UNSUPPORTED_OR_INVALID_TARGET');

const assetsRoot = path.join(projectRoot, 'assets');
let matches = []; let failed = false;
function walk(directory, depth) {
    if (depth > 12 || failed) { if (depth > 12) failed = true; return; }
    let entries; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { failed = true; return; }
    for (const entry of entries) {
        if (entry.isSymbolicLink() || ['library', 'temp', 'local', 'build'].includes(entry.name)) continue;
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(filename, depth + 1);
        else if (entry.isFile() && entry.name.endsWith('.prefab.meta')) {
            try {
                const metaStat = fs.lstatSync(filename);
                if (!metaStat.isFile() || metaStat.isSymbolicLink()) { failed = true; return; }
                const meta = JSON.parse(fs.readFileSync(filename, 'utf8'));
                if (meta.uuid !== prefabUuid || meta.importer !== 'prefab') continue;
                const assetFile = filename.slice(0, -'.meta'.length);
                const stat = fs.lstatSync(assetFile);
                if (!stat.isFile() || stat.isSymbolicLink()) { failed = true; return; }
                const bytes = fs.readFileSync(assetFile);
                const objects = JSON.parse(bytes.toString('utf8'));
                const nodes = sourceInspect.inspect(objects);
                if (!nodes) { failed = true; return; }
                matches.push({ prefabUuid, prefabUrl: `db://assets/${path.relative(assetsRoot, assetFile).split(path.sep).join('/')}`,
                    prefabPath: path.relative(projectRoot, assetFile).split(path.sep).join('/'),
                    sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), nodes });
            } catch (_) { failed = true; return; }
        }
    }
}
walk(assetsRoot, 0);
if (failed || matches.length !== 1) fail(failed ? 'PREFAB_SOURCE_UNREADABLE' : matches.length ? 'PREFAB_UUID_AMBIGUOUS' : 'PREFAB_UUID_NOT_FOUND');
process.stdout.write(`command.result ${JSON.stringify({ command: 'prefab.source.inspect', prefabUuid, ...matches[0] })}\n`);
