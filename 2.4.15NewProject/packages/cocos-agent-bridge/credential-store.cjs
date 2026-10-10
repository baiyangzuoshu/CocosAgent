'use strict';

const fs = require('fs');
const path = require('path');

const MAX_KEY_LENGTH = 4096;
const ENV_KEYS = new Set(['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL']);

function parseEnvFile(text) {
    const values = Object.create(null);
    for (const line of String(text || '').split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        let value = match[2].trim();
        if (value.length >= 2 && ((value[0] === '"' && value[value.length - 1] === '"')
            || (value[0] === "'" && value[value.length - 1] === "'"))) {
            const quote = value[0];
            value = value.slice(1, -1);
            if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else {
            value = value.replace(/\s+#.*$/, '').trim();
        }
        values[match[1]] = value;
    }
    return values;
}

function formatEnvValue(value) {
    return /[\s#'"\\]/.test(value) ? JSON.stringify(value) : value;
}

function updateEnvFile(text, updates) {
    const newline = String(text || '').includes('\r\n') ? '\r\n' : '\n';
    const lines = String(text || '').split(/\r?\n/);
    const seen = new Set();
    const output = [];
    for (const line of lines) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        const name = match && match[1];
        if (!ENV_KEYS.has(name)) { output.push(line); continue; }
        if (seen.has(name)) continue;
        seen.add(name);
        if (Object.prototype.hasOwnProperty.call(updates, name) && updates[name] !== null) {
            output.push(`${name}=${formatEnvValue(updates[name])}`);
        }
    }
    for (const name of ENV_KEYS) {
        if (seen.has(name) || !Object.prototype.hasOwnProperty.call(updates, name) || updates[name] === null) continue;
        if (output.length && output[output.length - 1] !== '') output.push('');
        output.push(`${name}=${formatEnvValue(updates[name])}`);
    }
    const result = output.join(newline).replace(new RegExp(`${newline}+$`), '');
    return result ? `${result}${newline}` : '';
}

function isValidModel(model) {
    return model === 'deepseek-flash' || model === 'deepseek-v4-pro';
}

class CredentialStore {
    constructor(options = {}) {
        this.filePath = options.filePath || path.resolve(__dirname, '../../../.env.local');
        this.fs = options.fs || fs.promises;
    }

    async readDocument() {
        try { return await this.fs.readFile(this.filePath, 'utf8'); }
        catch (error) { if (error && error.code === 'ENOENT') return ''; throw error; }
    }

    async save(apiKey, model) {
        if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > MAX_KEY_LENGTH || /[\r\n\u0000]/.test(apiKey)) {
            throw new Error('INVALID_CREDENTIAL');
        }
        if (!isValidModel(model)) throw new Error('INVALID_MODEL');
        const original = await this.readDocument();
        const contents = updateEnvFile(original, { DEEPSEEK_API_KEY: apiKey, DEEPSEEK_MODEL: model });
        await this.writeAtomically(contents);
    }

    async load() {
        const values = parseEnvFile(await this.readDocument());
        const apiKey = values.DEEPSEEK_API_KEY;
        if (!apiKey) return null;
        if (apiKey.length < 8 || apiKey.length > MAX_KEY_LENGTH || /[\r\n\u0000]/.test(apiKey)) throw new Error('INVALID_CREDENTIAL');
        const model = values.DEEPSEEK_MODEL || 'deepseek-flash';
        if (!isValidModel(model)) throw new Error('INVALID_CREDENTIAL_STORE');
        return { apiKey, model };
    }

    async clear() {
        const original = await this.readDocument();
        const contents = updateEnvFile(original, { DEEPSEEK_API_KEY: null, DEEPSEEK_MODEL: null });
        if (contents !== original) await this.writeAtomically(contents);
    }

    async writeAtomically(contents) {
        const directory = path.dirname(this.filePath);
        await this.fs.mkdir(directory, { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        try {
            await this.fs.writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
            await this.fs.rename(temporaryPath, this.filePath);
            try { await this.fs.chmod(this.filePath, 0o600); } catch (_) {}
        } catch (error) {
            try { await this.fs.unlink(temporaryPath); } catch (_) {}
            throw error;
        }
    }
}

module.exports = { CredentialStore, parseEnvFile, updateEnvFile, isValidModel };
