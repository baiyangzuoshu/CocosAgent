import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE_ROOT = path.resolve(SCRIPT_DIR, '../..');
const EXTENSION_RELATIVE = '2.4.15NewProject/packages/cocos-agent-bridge';
const RUNTIME_TOOLS_RELATIVE = 'tools/cocos-agent-bridge';
const AGENT_RUNTIME_RELATIVE = 'tools/cocos-agent-runtime';
const RUNTIME_SKILLS_RELATIVE = 'plugins/cocos-agent-2x';
const STRESS_PROBES = ['cocos-content-stress-2.4-live.mjs', 'cocos-content-stress-2.4.js'];

function inside(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function ensureAbsolute(value, flag) {
    if (!value || !path.isAbsolute(value)) throw new Error(`${flag.toUpperCase().replaceAll('-', '_')}_MUST_BE_ABSOLUTE`);
    return path.resolve(value);
}

function copyTree(source, destination, filter = () => true) {
    if (!fs.existsSync(source)) throw new Error(`PACKAGE_SOURCE_MISSING:${source}`);
    fs.cpSync(source, destination, { recursive: true, dereference: true, filter });
}

function runtimeToolFilter(sourceRoot, source) {
    const relative = path.relative(sourceRoot, source);
    if (!relative) return true;
    const segments = relative.split(path.sep);
    const base = path.basename(source);
    if (segments.includes('node_modules') || segments.includes('test')) return false;
    if (/\.test\.[^.]+$/.test(base) || /\.mock-test\.[^.]+$/.test(base) || /-test\.[^.]+$/.test(base)) return false;
    if (base === 'package-creator-extension.mjs' || base === 'package-creator-extension.test.mjs') return false;
    return true;
}

function skillPackageFilter(_sourceRoot, source) {
    const relative = path.relative(_sourceRoot, source);
    if (!relative) return true;
    const segments = relative.split(path.sep);
    return !segments.includes('scripts')
        && path.basename(source) !== 'README.md';
}

function copyRuntime(sourceRoot, runtimeDestination) {
    const toolsSource = path.join(sourceRoot, RUNTIME_TOOLS_RELATIVE);
    const toolsDestination = path.join(runtimeDestination, RUNTIME_TOOLS_RELATIVE);
    copyTree(toolsSource, toolsDestination, (source) => runtimeToolFilter(toolsSource, source));

    const mcpNodeModulesSource = path.join(toolsSource, 'mcp', 'node_modules');
    const mcpNodeModulesDestination = path.join(toolsDestination, 'mcp', 'node_modules');
    copyTree(mcpNodeModulesSource, mcpNodeModulesDestination);

    const agentRuntimeSource = path.join(sourceRoot, AGENT_RUNTIME_RELATIVE);
    const agentRuntimeDestination = path.join(runtimeDestination, AGENT_RUNTIME_RELATIVE);
    const agentRuntimeBuild = path.join(agentRuntimeSource, 'dist');
    if (!fs.statSync(path.join(agentRuntimeBuild, 'index.js'), { throwIfNoEntry: false })?.isFile()) {
        throw new Error('AGENT_RUNTIME_NOT_BUILT: run npm ci and build the TypeScript Agent runtime first');
    }
    fs.mkdirSync(agentRuntimeDestination, { recursive: true });
    fs.copyFileSync(path.join(agentRuntimeSource, 'package.json'), path.join(agentRuntimeDestination, 'package.json'));
    fs.copyFileSync(path.join(agentRuntimeSource, 'LICENSE.learn-claude-code'), path.join(agentRuntimeDestination, 'LICENSE.learn-claude-code'));
    copyTree(agentRuntimeBuild, path.join(agentRuntimeDestination, 'dist'), (source) =>
        source === agentRuntimeBuild || path.extname(source) === '.js');

    const skillsSource = path.join(sourceRoot, RUNTIME_SKILLS_RELATIVE);
    const skillsDestination = path.join(runtimeDestination, RUNTIME_SKILLS_RELATIVE);
    copyTree(skillsSource, skillsDestination, (source) => skillPackageFilter(skillsSource, source));

    const probeSource = path.join(sourceRoot, 'docs/agent-foundation/probes');
    const probeDestination = path.join(runtimeDestination, 'docs/agent-foundation/probes');
    fs.mkdirSync(probeDestination, { recursive: true });
    for (const filename of STRESS_PROBES) {
        const source = path.join(probeSource, filename);
        if (!fs.existsSync(source)) throw new Error(`PACKAGE_PROBE_MISSING:${filename}`);
        fs.copyFileSync(source, path.join(probeDestination, filename));
    }
    fs.mkdirSync(path.join(runtimeDestination, 'docs/agent-foundation/traces/visual'), { recursive: true });
}

function buildAgentRuntime(sourceRoot) {
    const runtimeRoot = path.join(sourceRoot, AGENT_RUNTIME_RELATIVE);
    const compiler = path.join(runtimeRoot, 'node_modules/typescript/bin/tsc');
    const config = path.join(runtimeRoot, 'tsconfig.json');
    if (!fs.existsSync(compiler)) throw new Error('AGENT_RUNTIME_COMPILER_MISSING: run npm ci in tools/cocos-agent-runtime');
    try {
        execFileSync(process.execPath, [compiler, '-p', config], { cwd: runtimeRoot, stdio: 'pipe', encoding: 'utf8' });
    } catch (error) {
        const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`AGENT_RUNTIME_BUILD_FAILED${output ? `\n${output}` : ''}`);
    }
}

function copyExtensionSources(sourceRoot, extensionDestination) {
    const extensionSource = path.join(sourceRoot, EXTENSION_RELATIVE);
    if (!fs.existsSync(path.join(extensionSource, 'package.json'))) throw new Error('CREATOR_EXTENSION_SOURCE_MISSING');
    fs.mkdirSync(extensionDestination, { recursive: true });
    for (const name of ['asset-search.js', 'credential-store.cjs', 'main.js', 'script-operations.js', 'package-lock.json', 'package.json', 'scene.js']) {
        const source = path.join(extensionSource, name);
        if (!fs.existsSync(source)) throw new Error(`CREATOR_EXTENSION_FILE_MISSING:${name}`);
        fs.copyFileSync(source, path.join(extensionDestination, name));
    }
    for (const name of ['panel', 'vendor']) {
        copyTree(path.join(extensionSource, name), path.join(extensionDestination, name));
    }
}

export function buildCreatorExtensionBundle({ sourceRoot = DEFAULT_SOURCE_ROOT, outputDirectory }) {
    const source = path.resolve(sourceRoot);
    const output = ensureAbsolute(outputDirectory, 'output');
    if (inside(source, output) || inside(output, source)) throw new Error('OUTPUT_MUST_BE_OUTSIDE_SOURCE_ROOT');
    if (fs.existsSync(output)) throw new Error('OUTPUT_ALREADY_EXISTS');
    if (!fs.existsSync(path.join(source, EXTENSION_RELATIVE, 'package.json'))) throw new Error('CREATOR_EXTENSION_SOURCE_MISSING');
    buildAgentRuntime(source);
    const parent = path.dirname(output);
    fs.mkdirSync(parent, { recursive: true });
    const staging = path.join(parent, `.${path.basename(output)}.tmp-${process.pid}-${Date.now()}`);
    try {
        copyExtensionSources(source, staging);
        copyRuntime(source, path.join(staging, 'assistant-runtime'));
        fs.renameSync(staging, output);
    } catch (error) {
        fs.rmSync(staging, { recursive: true, force: true });
        throw error;
    }
    return { outputDirectory: output, runtimeDirectory: path.join(output, 'assistant-runtime') };
}

export function installCreatorRuntime({ sourceRoot = DEFAULT_SOURCE_ROOT, extensionDirectory }) {
    const source = path.resolve(sourceRoot);
    const extension = ensureAbsolute(extensionDirectory, 'extension');
    const packageJsonPath = path.join(extension, 'package.json');
    if (!fs.existsSync(packageJsonPath)) throw new Error('CREATOR_EXTENSION_TARGET_MISSING');
    const extensionPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (extensionPackage.name !== 'cocos-agent-bridge') throw new Error('CREATOR_EXTENSION_TARGET_MISMATCH');
    const runtime = path.join(extension, 'assistant-runtime');
    if (fs.existsSync(runtime)) throw new Error('CREATOR_RUNTIME_ALREADY_INSTALLED');
    buildAgentRuntime(source);
    const staging = path.join(extension, `.assistant-runtime.tmp-${process.pid}-${Date.now()}`);
    try {
        copyRuntime(source, staging);
        fs.renameSync(staging, runtime);
    } catch (error) {
        fs.rmSync(staging, { recursive: true, force: true });
        throw error;
    }
    return { extensionDirectory: extension, runtimeDirectory: runtime };
}

function readCreatorExtension(extensionDirectory) {
    const info = fs.lstatSync(extensionDirectory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('CREATOR_EXTENSION_TARGET_NOT_DIRECTORY');
    const packagePath = path.join(extensionDirectory, 'package.json');
    if (!fs.existsSync(packagePath)) throw new Error('CREATOR_EXTENSION_TARGET_MISSING');
    const extensionPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (extensionPackage.name !== 'cocos-agent-bridge') throw new Error('CREATOR_EXTENSION_TARGET_MISMATCH');
    const creatorVersion = extensionPackage['cocos-agent']?.creatorVersion;
    if (creatorVersion !== '2.4.15') throw new Error('CREATOR_EXTENSION_VERSION_UNSUPPORTED');
    return extensionPackage;
}

function validateCreatorExtensionBundle(directory) {
    const extensionPackage = readCreatorExtension(directory);
    const requiredFiles = [
        'main.js',
        'scene.js',
        'panel/index.js',
        'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-host.mjs',
        'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-conversation-summary.mjs',
        'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-memory-store.mjs',
        'assistant-runtime/tools/cocos-agent-bridge/mcp/assistant-tool-result-archive.mjs',
        'assistant-runtime/tools/cocos-agent-bridge/mcp/mcp-server.mjs',
        'assistant-runtime/tools/cocos-agent-runtime/dist/index.js',
        'assistant-runtime/tools/cocos-agent-runtime/LICENSE.learn-claude-code',
        'assistant-runtime/plugins/cocos-agent-2x/agent-package.json',
    ];
    for (const relative of requiredFiles) {
        if (!fs.statSync(path.join(directory, relative), { throwIfNoEntry: false })?.isFile())
            throw new Error(`CREATOR_EXTENSION_BUNDLE_INCOMPLETE:${relative}`);
    }
    return extensionPackage;
}

export function upgradeCreatorExtension({ sourceRoot = DEFAULT_SOURCE_ROOT, extensionDirectory }) {
    const source = path.resolve(sourceRoot);
    const extension = ensureAbsolute(extensionDirectory, 'extension');
    if (inside(source, extension) || inside(extension, source)) throw new Error('UPGRADE_TARGET_MUST_BE_OUTSIDE_SOURCE_ROOT');
    const previousPackage = readCreatorExtension(extension);
    const parent = path.dirname(extension);
    const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const staging = path.join(parent, `.cocos-agent-bridge.upgrade-${suffix}`);
    const backup = path.join(parent, `.cocos-agent-bridge.rollback-${suffix}`);
    try {
        buildCreatorExtensionBundle({ sourceRoot: source, outputDirectory: staging });
        const nextPackage = validateCreatorExtensionBundle(staging);
        fs.renameSync(extension, backup);
        try {
            fs.renameSync(staging, extension);
            validateCreatorExtensionBundle(extension);
        } catch (error) {
            const failedBundle = `${staging}.failed`;
            if (fs.existsSync(extension)) fs.renameSync(extension, failedBundle);
            try { fs.renameSync(backup, extension); }
            catch (restoreError) {
                throw new Error(`CREATOR_UPGRADE_ROLLBACK_FAILED:${restoreError.message || restoreError};backup=${backup}`);
            }
            fs.rmSync(failedBundle, { recursive: true, force: true });
            throw error;
        }
        return {
            extensionDirectory: extension,
            previousVersion: previousPackage.version || 'unknown',
            installedVersion: nextPackage.version || 'unknown',
            rollbackDirectory: backup,
            creatorReloadRequired: true,
        };
    } catch (error) {
        if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
        throw error;
    }
}

export function restoreCreatorExtension({ extensionDirectory, rollbackDirectory }) {
    const extension = ensureAbsolute(extensionDirectory, 'extension');
    const backup = ensureAbsolute(rollbackDirectory, 'rollback');
    if (path.dirname(extension) !== path.dirname(backup)
        || !path.basename(backup).startsWith('.cocos-agent-bridge.rollback-')) {
        throw new Error('CREATOR_EXTENSION_ROLLBACK_PATH_MISMATCH');
    }
    const currentPackage = readCreatorExtension(extension);
    const rollbackPackage = readCreatorExtension(backup);
    const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const replaced = path.join(path.dirname(extension), `.cocos-agent-bridge.replaced-${suffix}`);
    fs.renameSync(extension, replaced);
    try {
        fs.renameSync(backup, extension);
        readCreatorExtension(extension);
    } catch (error) {
        if (fs.existsSync(extension)) fs.renameSync(extension, backup);
        try { fs.renameSync(replaced, extension); }
        catch (restoreError) {
            throw new Error(`CREATOR_EXTENSION_RESTORE_FAILED:${restoreError.message || restoreError};current=${replaced};rollback=${backup}`);
        }
        throw error;
    }
    return { extensionDirectory: extension, restoredVersion: rollbackPackage.version || 'unknown',
        replacedVersion: currentPackage.version || 'unknown', replacedDirectory: replaced, creatorReloadRequired: true };
}

function parseArgs(argv) {
    const [command, ...args] = argv;
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        if (!args[index].startsWith('--') || !args[index + 1] || args[index + 1].startsWith('--'))
            throw new Error('INVALID_PACKAGE_ARGUMENTS');
        values.set(args[index].slice(2), args[++index]);
    }
    if (command === 'bundle') return { command, outputDirectory: values.get('output') };
    if (command === 'install-runtime') return { command, extensionDirectory: values.get('extension') };
    if (command === 'upgrade-extension') return { command, extensionDirectory: values.get('extension') };
    if (command === 'restore-extension') return { command, extensionDirectory: values.get('extension'), rollbackDirectory: values.get('rollback') };
    throw new Error('USAGE: node package-creator-extension.mjs bundle --output <absolute-empty-path> | install-runtime --extension <absolute-creator-extension-path> | upgrade-extension --extension <absolute-creator-extension-path> | restore-extension --extension <absolute-creator-extension-path> --rollback <absolute-backup-path>');
}

function main(argv = process.argv.slice(2)) {
    if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('NODE_20_OR_NEWER_REQUIRED');
    const options = parseArgs(argv);
    const result = options.command === 'bundle'
        ? buildCreatorExtensionBundle(options)
        : options.command === 'upgrade-extension' ? upgradeCreatorExtension(options)
            : options.command === 'restore-extension' ? restoreCreatorExtension(options) : installCreatorRuntime(options);
    process.stdout.write(`${JSON.stringify({ success: true, ...result }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try { main(); }
    catch (error) {
        process.stderr.write(`${error.message || error}\n`);
        process.exitCode = 1;
    }
}
