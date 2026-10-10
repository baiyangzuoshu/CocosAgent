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

module.exports = { fingerprintFiles, listFiles };
