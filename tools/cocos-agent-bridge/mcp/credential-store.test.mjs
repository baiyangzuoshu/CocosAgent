import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CredentialStore, parseEnvFile, updateEnvFile } = require('../../../2.4.15NewProject/packages/cocos-agent-bridge/credential-store.cjs');

test('local .env parser handles comments, quoted values and duplicate managed keys', () => {
    assert.deepEqual({ ...parseEnvFile('A=one\nDEEPSEEK_API_KEY="key value"\nB=two # comment') }, {
        A: 'one', DEEPSEEK_API_KEY: 'key value', B: 'two',
    });
    const updated = updateEnvFile('OTHER=value\nDEEPSEEK_API_KEY=old\nDEEPSEEK_API_KEY=duplicate\n', {
        DEEPSEEK_API_KEY: 'replacement', DEEPSEEK_MODEL: 'deepseek-flash',
    });
    assert.equal((updated.match(/DEEPSEEK_API_KEY=/g) || []).length, 1);
    assert.match(updated, /OTHER=value/);
    assert.match(updated, /DEEPSEEK_API_KEY=replacement/);
});

test('credential store saves, restores and forgets only DeepSeek entries in its configured user-store file', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'cocos-agent-env-'));
    const envPath = path.join(directory, '.env.local');
    const secret = 'sk-test-not-a-real-key-0123456789';
    const store = new CredentialStore({ filePath: envPath });
    try {
        await writeFile(envPath, '# existing local config\nOTHER_LOCAL_SETTING=preserve\n', 'utf8');
        assert.equal(await store.load(), null);
        await store.save(secret, 'deepseek-v4-pro');
        const contents = await readFile(envPath, 'utf8');
        assert.match(contents, /OTHER_LOCAL_SETTING=preserve/);
        assert.equal(contents.includes(secret), true);
        assert.deepEqual(await store.load(), { apiKey: secret, model: 'deepseek-v4-pro' });
        await store.clear();
        const cleared = await readFile(envPath, 'utf8');
        assert.match(cleared, /OTHER_LOCAL_SETTING=preserve/);
        assert.equal(cleared.includes('DEEPSEEK_API_KEY='), false);
        assert.equal(cleared.includes('DEEPSEEK_MODEL='), false);
        assert.equal(await store.load(), null);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('credential store defaults to the current OS user configuration directory', () => {
    const store = new CredentialStore();
    assert.equal(store.filePath, path.join(os.homedir(), '.cocos-agent', 'credentials.env'));
});

test('credential store rejects invalid keys and models without writing them', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'cocos-agent-env-invalid-'));
    const envPath = path.join(directory, '.env.local');
    const store = new CredentialStore({ filePath: envPath });
    try {
        await assert.rejects(store.save('short', 'deepseek-flash'), /INVALID_CREDENTIAL/);
        await assert.rejects(store.save('sk-fake-test-key-0123456789', 'unsupported-model'), /INVALID_MODEL/);
        await assert.rejects(readFile(envPath, 'utf8'), { code: 'ENOENT' });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
