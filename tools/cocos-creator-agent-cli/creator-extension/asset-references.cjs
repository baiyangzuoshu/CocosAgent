'use strict';

const fs = require('fs');
const path = require('path');

const MAX_FILES = 12000;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_RESULTS = 500;
const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.ico', '.astc', '.pvr', '.ktx',
    '.mp3', '.ogg', '.wav', '.aac', '.m4a', '.mp4', '.mov', '.avi', '.webm', '.ttf', '.otf', '.woff', '.woff2',
    '.zip', '.gz', '.pdf', '.psd', '.ai', '.fbx', '.glb', '.blend', '.skel', '.skeleton', '.bin',
]);

function scanAssetReferences(assetsRoot, assetUuid, limits = {}) {
    if (typeof assetsRoot !== 'string' || !path.isAbsolute(assetsRoot)
        || typeof assetUuid !== 'string' || !/^(?:[0-9a-fA-F-]{36}|[A-Za-z0-9+/]{22,23})$/.test(assetUuid)) {
        throw Object.assign(new Error('ASSET_REFERENCE_INPUT_INVALID'), { code: 'ASSET_REFERENCE_INPUT_INVALID' });
    }
    let rootStat;
    try { rootStat = fs.lstatSync(assetsRoot); }
    catch (_) { throw Object.assign(new Error('ASSET_REFERENCE_ROOT_UNAVAILABLE'), { code: 'ASSET_REFERENCE_ROOT_UNAVAILABLE' }); }
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
        throw Object.assign(new Error('ASSET_REFERENCE_ROOT_UNAVAILABLE'), { code: 'ASSET_REFERENCE_ROOT_UNAVAILABLE' });
    const maxFiles = Number.isInteger(limits.maxFiles) ? Math.min(Math.max(limits.maxFiles, 1), MAX_FILES) : MAX_FILES;
    const maxFileBytes = Number.isInteger(limits.maxFileBytes) ? Math.min(Math.max(limits.maxFileBytes, 1), MAX_FILE_BYTES) : MAX_FILE_BYTES;
    const maxTotalBytes = Number.isInteger(limits.maxTotalBytes) ? Math.min(Math.max(limits.maxTotalBytes, 1), MAX_TOTAL_BYTES) : MAX_TOTAL_BYTES;
    const maxResults = Number.isInteger(limits.maxResults) ? Math.min(Math.max(limits.maxResults, 1), MAX_RESULTS) : MAX_RESULTS;
    const results = [];
    const ignoredPaths = new Set(Array.isArray(limits.ignorePaths)
        ? limits.ignorePaths.filter((item) => typeof item === 'string') : []);
    const unsupported = new Map();
    let scannedFiles = 0;
    let textBytes = 0;
    let binaryFiles = 0;
    let incomplete = false;
    const needle = assetUuid.toLowerCase();
    const pending = [assetsRoot];

    while (pending.length) {
        const directory = pending.pop();
        let directoryStat;
        try { directoryStat = fs.lstatSync(directory); }
        catch (_) { incomplete = true; continue; }
        if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) { incomplete = true; continue; }
        let names;
        try { names = fs.readdirSync(directory).sort(); }
        catch (_) { incomplete = true; continue; }
        for (const name of names) {
            const filename = path.join(directory, name);
            let stat;
            try { stat = fs.lstatSync(filename); }
            catch (_) { incomplete = true; continue; }
            if (stat.isSymbolicLink()) { incomplete = true; continue; }
            if (stat.isDirectory()) { pending.push(filename); continue; }
            if (!stat.isFile()) { incomplete = true; continue; }
            scannedFiles += 1;
            if (scannedFiles > maxFiles) { incomplete = true; pending.length = 0; break; }
            const relativePath = path.relative(assetsRoot, filename).split(path.sep).join('/');
            if (ignoredPaths.has(relativePath)) continue;
            if (BINARY_EXTENSIONS.has(path.extname(name).toLowerCase())) { binaryFiles += 1; continue; }
            if (stat.size > maxFileBytes || textBytes + stat.size > maxTotalBytes) {
                incomplete = true;
                const extension = path.extname(name).toLowerCase() || '<none>';
                unsupported.set(extension, (unsupported.get(extension) || 0) + 1);
                continue;
            }
            let bytes;
            try { bytes = fs.readFileSync(filename); }
            catch (_) { incomplete = true; continue; }
            if (bytes.includes(0)) { binaryFiles += 1; continue; }
            const text = bytes.toString('utf8');
            if (!Buffer.from(text, 'utf8').equals(bytes)) { binaryFiles += 1; continue; }
            textBytes += bytes.length;
            const lower = text.toLowerCase();
            let occurrences = 0;
            let offset = 0;
            while ((offset = lower.indexOf(needle, offset)) !== -1) {
                occurrences += 1;
                offset += needle.length;
            }
            if (occurrences > 0) {
                results.push({ assetPath: relativePath, occurrences });
                if (results.length >= maxResults) { incomplete = true; pending.length = 0; break; }
            }
        }
    }

    results.sort((left, right) => left.assetPath.localeCompare(right.assetPath));
    return { assetUuid, complete: !incomplete, scannedFiles: Math.min(scannedFiles, maxFiles), textBytes,
        binaryFiles, referenceCount: results.length, references: results,
        ignoredPaths: [...ignoredPaths].sort(),
        unsupportedExtensions: [...unsupported.entries()].sort(([left], [right]) => left.localeCompare(right))
            .map(([extension, fileCount]) => ({ extension, fileCount })) };
}

module.exports = { scanAssetReferences };
