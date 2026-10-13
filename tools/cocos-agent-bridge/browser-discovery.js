'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function registryBrowserPaths(executable, env, deadline = Infinity) {
    const paths = [];
    const systemRoot = env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows';
    const registry = path.win32.join(systemRoot, 'System32', 'reg.exe');
    for (const hive of ['HKCU', 'HKLM']) {
        for (const view of ['64', '32']) {
            if (Date.now() >= deadline) return paths;
            try {
                const output = execFileSync(registry, ['query', `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${executable}`,
                    '/ve', `/reg:${view}`], { timeout: Math.max(1, Math.min(1500, deadline - Date.now())),
                    windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
                // reg.exe can use the local console code page. Keep candidates
                // from supported decoders; the file check selects the actual path.
                for (const encoding of ['utf-8', 'utf-16le', 'gb18030', 'windows-1252']) {
                    try {
                        const match = new TextDecoder(encoding).decode(output).match(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/);
                        if (match) paths.push(match[1].trim().replace(/^"(.*)"$/, '$1').replace(/%([^%]+)%/g, (token, name) => {
                            const key = Object.keys(env).find((item) => item.toLowerCase() === name.toLowerCase());
                            return key ? env[key] : token;
                        }));
                    } catch (_) { /* Optional decoder not present in this Node build. */ }
                }
            } catch (_) { /* Missing registration or a registry view is normal. */ }
        }
    }
    return paths;
}

function discoverBrowser(options = {}) {
    const platform = options.platform || process.platform;
    const env = options.env || process.env;
    const isFile = options.isFile || ((filename) => {
        try { return fs.statSync(filename).isFile(); } catch (_) { return false; }
    });
    // An explicit override is authoritative; do not silently ignore a typo.
    const override = options.chromePath || env.COCOS_AGENT_CHROME_PATH;
    if (override) return (platform === 'win32' ? path.win32.isAbsolute(override) : path.isAbsolute(override)) && isFile(override) ? override : null;
    if (platform === 'win32') {
        const roots = [...new Set([env.LOCALAPPDATA, env.ProgramW6432, env.ProgramFiles, env['ProgramFiles(x86)'],
            'C:\\Program Files', 'C:\\Program Files (x86)'].filter(Boolean))];
        for (const [executable, folder] of [['chrome.exe', 'Google\\Chrome\\Application'], ['msedge.exe', 'Microsoft\\Edge\\Application']]) {
            const common = roots.map((root) => path.win32.join(root, folder, executable));
            const found = common.find(isFile);
            if (found) return found;
            const registry = (options.registryPaths || registryBrowserPaths)(executable, env, options.deadline)
                .find((filename) => path.win32.isAbsolute(filename) && path.win32.basename(filename).toLowerCase() === executable && isFile(filename));
            if (registry) return registry;
            const fromPath = String(env.PATH || env.Path || '').split(';').filter(Boolean)
                .map((root) => path.win32.join(root.replace(/^"(.*)"$/, '$1'), executable))
                .find((filename) => path.win32.isAbsolute(filename) && isFile(filename));
            if (fromPath) return fromPath;
        }
        return null;
    }
    const candidates = platform === 'darwin' ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    return candidates.find(isFile) || null;
}

module.exports = { discoverBrowser };
