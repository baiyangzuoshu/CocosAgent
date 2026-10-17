'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const WebSocket = require('./vendor/ws');
const catalogSchema = require('./catalog.schema.json');
const { fingerprintFiles, listFiles, mcpRuntimeFiles, fingerprintCreatorExtension } = require('./runtime-fingerprint');
const HOST_VERSION = '0.2.0';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
function readMcpRuntime(value) {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'string'
            || !/^[0-9a-f]{64}$/.test(parsed.sourceFingerprint || '')
            || !/^[0-9a-f]{64}$/.test(parsed.agentPackageFingerprint || '')
            || !/^[0-9a-f]{64}$/.test(parsed.contractSchemaFingerprint || '')
            || typeof parsed.agentPackageVersion !== 'string') return null;
        return parsed;
    } catch (_) { return null; }
}
const MCP_PACKAGE_PATH = path.join(__dirname, 'mcp', 'package.json');
const MCP_SOURCE_PATH = path.join(__dirname, 'mcp', 'mcp-server.mjs');
const AGENT_PACKAGE_ROOT = path.resolve(__dirname, '../../plugins/cocos-agent-2x');
const AGENT_PACKAGE_PATH = path.join(AGENT_PACKAGE_ROOT, 'agent-package.json');
const mcpPackage = JSON.parse(fs.readFileSync(MCP_PACKAGE_PATH, 'utf8'));
const agentPackage = JSON.parse(fs.readFileSync(AGENT_PACKAGE_PATH, 'utf8'));
const expectedMcpSourceFingerprint = fingerprintFiles(path.dirname(MCP_SOURCE_PATH), mcpRuntimeFiles(path.dirname(MCP_SOURCE_PATH)));
const expectedSchemaFingerprint = sha256(fs.readFileSync(path.join(__dirname, 'catalog.schema.json')));
const expectedHostFingerprint = fingerprintFiles(__dirname, [
    'catalog-host.js', 'agent-jsonl.js', 'agent-dispatch.js', 'catalog.schema.json', 'runtime-fingerprint.js',
    'script-contract.js', 'command-contract.js',
]);
const hostRuntime = { version: HOST_VERSION, sourceFingerprint: expectedHostFingerprint, contractSchemaFingerprint: expectedSchemaFingerprint };
const expectedAgentPackageVersion = agentPackage.version;
const expectedAgentPackageFingerprint = fingerprintFiles(AGENT_PACKAGE_ROOT, [
    'agent-package.json', 'skill-package.json',
    ...listFiles(AGENT_PACKAGE_ROOT, 'skills'), ...listFiles(AGENT_PACKAGE_ROOT, 'references'),
]);
function expectedExtensionFingerprint(projectRoot) {
    const projectExtensionRoot = path.join(projectRoot, 'packages', 'cocos-agent-bridge');
    // The Creator extension and its sidecar are installed globally by default.
    // In that layout there is intentionally no copy under the game's packages/.
    // Compare the receipt with the extension package that launched this Host.
    const bundledExtensionRoot = path.resolve(__dirname, '../../..');
    const bundledPackagePath = path.join(bundledExtensionRoot, 'package.json');
    const bundledRuntimeRoot = path.resolve(__dirname, '..', '..');
    const extensionRoot = fs.existsSync(path.join(bundledRuntimeRoot, 'tools/cocos-agent-runtime/package.json'))
        && fs.existsSync(bundledPackagePath)
        ? bundledExtensionRoot
        : projectExtensionRoot;
    if (!fs.existsSync(path.join(extensionRoot, 'vendor/ws'))) return null;
    return fingerprintCreatorExtension(extensionRoot);
}

function expectedExtensionVersion(projectRoot) {
    const bundledExtensionRoot = path.resolve(__dirname, '../../..');
    const bundledRuntimeRoot = path.resolve(__dirname, '..', '..');
    const bundledPackagePath = path.join(bundledExtensionRoot, 'package.json');
    const projectPackagePath = path.join(projectRoot, 'packages', 'cocos-agent-bridge', 'package.json');
    const packagePath = fs.existsSync(path.join(bundledRuntimeRoot, 'tools/cocos-agent-runtime/package.json'))
        && fs.existsSync(bundledPackagePath) ? bundledPackagePath : projectPackagePath;
    try { return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || null; }
    catch (_) { return null; }
}

const args = process.argv.slice(2);
const values = (flag) => args.flatMap((value, index) => value === flag ? [args[index + 1]] : []);
const one = (flag) => values(flag)[0];
const mcpRuntime = readMcpRuntime(one('--mcp-runtime'));
const query = one('--query') || 'instances.list';
const selectedProject = one('--project') && path.resolve(one('--project'));
const selectedVersion = one('--creator-version');
const supported = new Set(['2.4.15', '3.8.7']);
const targetArgs = values('--target');

function output(success, data, error) {
    process.stdout.write(`${JSON.stringify(success ? { success, data } : { success, error })}\n`);
    process.exitCode = success ? 0 : 1;
}

if (!targetArgs.length || !['instances.list', 'instances.get', 'capabilities.list'].includes(query)) {
    output(false, null, { code: 'INVALID_ARGUMENT', message: 'Use --target <creatorVersion>=<projectPath> (repeatable) and --query instances.list|instances.get|capabilities.list.' });
    return;
}
if (query !== 'instances.list' && !selectedProject) {
    output(false, null, { code: 'PROJECT_REQUIRED', message: '--project is required for this query.' });
    return;
}
if (values('--project').length > 1 || values('--creator-version').length > 1
    || (selectedVersion && !supported.has(selectedVersion))) {
    output(false, null, { code: 'INVALID_ARGUMENT', message: 'Use at most one --project and a supported --creator-version.' });
    return;
}
if (query === 'instances.list' && (selectedProject || selectedVersion)) {
    output(false, null, { code: 'INVALID_ARGUMENT', message: 'instances.list does not accept --project or --creator-version.' });
    return;
}

const targets = [];
const seen = new Set();
for (const arg of targetArgs) {
    const index = arg.indexOf('=');
    const creatorVersion = arg.slice(0, index);
    const projectRoot = path.resolve(arg.slice(index + 1));
    if (index < 0 || !supported.has(creatorVersion) || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
        output(false, null, { code: 'INVALID_TARGET', message: `Invalid Creator target: ${arg}` });
        return;
    }
    if (seen.has(projectRoot)) {
        output(false, null, { code: 'AMBIGUOUS_EDITOR', message: `Project is listed more than once: ${projectRoot}` });
        return;
    }
    seen.add(projectRoot);
    targets.push({ creatorVersion, projectRoot, instanceId: null, state: 'disconnected', activeScene: null, activeSceneUuid: null, catalogRevision: null,
        extensionVersion: null, extensionSourceFingerprint: null, commandContractFingerprint: null,
        contractCompatibility: null, contractDiagnostics: [], commands: [], error: null,
        mcpRuntime, hostRuntime,
        sessionId: crypto.randomUUID(), token: crypto.randomBytes(32).toString('hex'), socket: null, requestId: null, nonce: null });
}
if (query !== 'instances.list') {
    const matches = targets.filter((target) => target.projectRoot === selectedProject);
    if (!matches.length) {
        output(false, null, { code: 'EDITOR_NOT_FOUND', message: `No target for project: ${selectedProject}` });
        return;
    }
    if (matches.length > 1) {
        output(false, null, { code: 'AMBIGUOUS_EDITOR', message: `More than one target for project: ${selectedProject}` });
        return;
    }
    if (selectedVersion && matches[0].creatorVersion !== selectedVersion) {
        output(false, null, { code: 'CREATOR_VERSION_MISMATCH', message: `Expected Creator ${selectedVersion}, target is ${matches[0].creatorVersion}.` });
        return;
    }
}

const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
const wss = new WebSocket.Server({
    server, path: '/cocos-agent-bridge', maxPayload: 16 * 1024,
    verifyClient: (info, done) => done(targets.some((target) => {
        const candidate = info.req.headers['x-cocos-agent-token'];
        const expected = Buffer.from(target.token);
        const actual = Buffer.from(typeof candidate === 'string' ? candidate : '');
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    })),
});
let timer;
let finished = false;

function sessionPath(target) { return path.join(target.projectRoot, 'temp', 'cocos-agent-bridge', 'session.json'); }
function publicInstance(target) {
    let extensionVersion = null;
    try { extensionVersion = JSON.parse(fs.readFileSync(path.join(target.projectRoot, 'packages/cocos-agent-bridge/package.json'), 'utf8')).version; }
    catch (_) { /* Keep expected version unavailable for projects without the extension package. */ }
    return { instanceId: target.instanceId, projectRoot: target.projectRoot, creatorVersion: target.creatorVersion,
        extensionVersion: target.extensionVersion || null, state: target.state,
        extensionSourceFingerprint: target.extensionSourceFingerprint || null,
        commandContractFingerprint: target.commandContractFingerprint || null,
        activeScene: target.activeScene, activeSceneUuid: target.activeSceneUuid || null, catalogRevision: target.catalogRevision,
        hostRuntime: target.hostRuntime,
        expectedRuntime: { agentPackage: { version: expectedAgentPackageVersion, fingerprint: expectedAgentPackageFingerprint },
            mcp: { version: mcpPackage.version, sourceFingerprint: expectedMcpSourceFingerprint,
                contractSchemaFingerprint: expectedSchemaFingerprint },
            creatorExtension: { version: extensionVersion, sourceFingerprint: expectedExtensionFingerprint(target.projectRoot) } },
        mcpRuntime: target.mcpRuntime ? { ...target.mcpRuntime, status: 'reported' } : { status: 'unreported' },
        contractCompatibility: target.contractCompatibility, contractDiagnostics: target.contractDiagnostics,
        error: target.error };
}
function cleanup() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    for (const target of targets) {
        try {
            const file = sessionPath(target);
            if (JSON.parse(fs.readFileSync(file, 'utf8')).sessionId === target.sessionId) fs.unlinkSync(file);
        } catch (_) { /* Keep another session's file. */ }
        if (target.socket) target.socket.close();
    }
    wss.close();
    server.close();
}
function finish() {
    if (finished) return;
    for (const target of targets) {
        if (target.state === 'disconnected' && !target.error) target.error = 'EDITOR_NOT_CONNECTED';
    }
    if (query === 'instances.list') output(true, targets.map(publicInstance));
    else {
        const matches = targets.filter((target) => target.projectRoot === selectedProject);
        if (matches.length !== 1) output(false, null, { code: matches.length ? 'AMBIGUOUS_EDITOR' : 'EDITOR_NOT_FOUND', message: 'Target project does not select exactly one Editor.' });
        else if (matches[0].state !== 'ready') output(false, null, { code: matches[0].error || 'EDITOR_NOT_CONNECTED', message: `Creator catalog is unavailable: ${selectedProject}` });
        else if (query === 'instances.get') output(true, publicInstance(matches[0]));
        else output(true, { instance: publicInstance(matches[0]), commands: matches[0].commands });
    }
    cleanup();
}
function maybeFinish() {
    if (targets.every((target) => target.state === 'ready' || target.state === 'unavailable')) finish();
}
function sendRequest(target, method) {
    target.requestId = crypto.randomUUID();
    target.nonce = crypto.randomBytes(12).toString('hex');
    target.socket.send(JSON.stringify({ type: 'request', id: target.requestId, method, params: { nonce: target.nonce } }));
}
function unavailable(target, code) {
    target.state = 'unavailable';
    target.error = code;
    maybeFinish();
}

function commandContractFingerprint(commands) {
    return sha256(JSON.stringify(commands.map((command) => ({ id: command.id, contractVersion: command.contractVersion,
        access: command.access, inputSchema: command.inputSchema, input: command.input, preconditions: command.preconditions }))));
}

function runtimeCompatibility(target, result, actualContractFingerprint) {
    if (target.creatorVersion !== '2.4.15') return { status: 'legacy-unverified', blockers: [], diagnostics: [] };
    const diagnostics = [];
    const blockers = [];
    const expectedVersion = expectedExtensionVersion(target.projectRoot);
    const expectedExtFingerprint = expectedExtensionFingerprint(target.projectRoot);
    if (!result.extensionSourceFingerprint) {
        diagnostics.push({ component: 'creatorExtension', status: 'unattested', code: 'EXTENSION_FINGERPRINT_UNREPORTED',
            expected: expectedExtFingerprint, actual: null });
        blockers.push('EXTENSION_FINGERPRINT_UNREPORTED');
    } else if (result.extensionSourceFingerprint !== expectedExtFingerprint) {
        diagnostics.push({ component: 'creatorExtension', status: 'mismatch', code: 'CREATOR_EXTENSION_STALE',
            expected: expectedExtFingerprint, actual: result.extensionSourceFingerprint });
        blockers.push('CREATOR_EXTENSION_STALE');
    }
    if (!result.extensionVersion || result.extensionVersion !== expectedVersion) {
        diagnostics.push({ component: 'creatorExtension', status: 'mismatch', code: 'EXTENSION_VERSION_MISMATCH',
            expected: expectedVersion, actual: result.extensionVersion || null });
        blockers.push('EXTENSION_VERSION_MISMATCH');
    }
    if (!result.commandContractFingerprint || result.commandContractFingerprint !== actualContractFingerprint) {
        diagnostics.push({ component: 'creatorExtension', status: 'mismatch', code: 'EXTENSION_CONTRACT_FINGERPRINT_MISMATCH',
            expected: actualContractFingerprint, actual: result.commandContractFingerprint || null });
        blockers.push('EXTENSION_CONTRACT_FINGERPRINT_MISMATCH');
    }
    if (!target.mcpRuntime) {
        diagnostics.push({ component: 'mcp', status: 'unattested', code: 'MCP_RUNTIME_UNREPORTED', expected: {
            version: mcpPackage.version, agentPackageVersion: expectedAgentPackageVersion,
            agentPackageFingerprint: expectedAgentPackageFingerprint, sourceFingerprint: expectedMcpSourceFingerprint,
            contractSchemaFingerprint: expectedSchemaFingerprint,
        }, actual: null });
        blockers.push('MCP_RUNTIME_UNREPORTED');
    } else {
        const mcpChecks = [
            ['MCP_VERSION_MISMATCH', mcpPackage.version, target.mcpRuntime.version],
            ['AGENT_PACKAGE_VERSION_MISMATCH', expectedAgentPackageVersion, target.mcpRuntime.agentPackageVersion],
            ['AGENT_PACKAGE_FINGERPRINT_MISMATCH', expectedAgentPackageFingerprint, target.mcpRuntime.agentPackageFingerprint],
            ['MCP_SOURCE_FINGERPRINT_MISMATCH', expectedMcpSourceFingerprint, target.mcpRuntime.sourceFingerprint],
            ['MCP_CONTRACT_SCHEMA_MISMATCH', expectedSchemaFingerprint, target.mcpRuntime.contractSchemaFingerprint],
        ];
        for (const [code, expected, actual] of mcpChecks) {
            if (actual !== expected) {
                diagnostics.push({ component: code.startsWith('AGENT_PACKAGE') ? 'agentPackage' : 'mcp', status: 'mismatch', code,
                    expected, actual: actual || null });
                blockers.push(code);
            }
        }
    }
    return { status: blockers.length ? 'mismatch' : 'matched', blockers, diagnostics };
}

function runtimeStateMatches(command, sceneReady) {
    if (command.reason === 'COMMAND_NOT_IMPLEMENTED') return command.status === 'unavailable';
    const mustMatchScene = ['scene.snapshot', 'scene.node.inspect', 'scene.node.create', 'scene.node.patch'];
    if (mustMatchScene.includes(command.id)) {
        return sceneReady
            ? command.status === 'available' && command.reason === null
            : command.status === 'unavailable' && command.reason === 'NO_OPEN_SCENE';
    }
    if (command.id === 'scene.pngSprite') {
        if (!sceneReady) return command.status === 'unavailable' && command.reason === 'NO_OPEN_SCENE';
        return command.status === 'available' && command.reason === null
            || command.status === 'unavailable' && command.reason === 'CANVAS_NOT_FOUND';
    }
    if (command.id === 'runtime.preview.start') {
        return sceneReady
            ? command.status === 'available' && command.reason === null
            : command.status === 'unavailable' && command.reason === 'NO_OPEN_SCENE';
    }
    if (command.id === 'prefab.source.patch') {
        return command.status === 'available' && command.reason === null
            || command.status === 'unavailable' && command.reason === (sceneReady ? 'PREFAB_EDIT_MODE_API_UNAVAILABLE' : 'NO_OPEN_SCENE');
    }
    if (command.id === 'prefab.source.inspect') {
        return command.status === 'available' && command.reason === null
            || command.status === 'unavailable' && command.reason === 'ASSETDB_UNAVAILABLE';
    }
    if (command.id.startsWith('script.') || command.id === 'asset.searchPng') {
        return command.status === 'available' && command.reason === null
            || command.status === 'unavailable' && command.reason === 'ASSETDB_UNAVAILABLE';
    }
    if (command.id === 'asset.refreshFolder') {
        return command.status === 'available' && command.reason === null
            || command.status === 'unavailable' && command.reason === 'ASSETDB_REFRESH_UNAVAILABLE';
    }
    return command.status === 'available' && command.reason === null;
}

function validCatalog(target, result) {
    if (!Array.isArray(result.commands) || result.commands.length > 64
        || !(result.activeScene === null || typeof result.activeScene === 'string')
        || !(result.activeSceneUuid === undefined || result.activeSceneUuid === null
            || typeof result.activeSceneUuid === 'string' && /^[0-9a-fA-F-]{36}$/.test(result.activeSceneUuid))
        || !/^[0-9a-f]{64}$/.test(result.catalogRevision || '')) return false;
    const expected = {
        ...(target.creatorVersion === '2.4.15' ? { 'project.search': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/projectSearchInput2x', input: catalogSchema.$defs.projectSearchInput2x, preconditions: ['projectAssetsAvailable'] } } : {}),
        ...(target.creatorVersion === '2.4.15' ? { 'script.read': { contractVersion: '0.2', access: 'read', inputSchema: 'catalog.schema.json#/$defs/scriptReadInput2x', input: catalogSchema.$defs.scriptReadInput2x, preconditions: ['existingProjectScript', 'assetDbReady'] } } : {}),
        ...(target.creatorVersion === '2.4.15' ? { 'script.patch.plan': { contractVersion: '0.2', access: 'read', inputSchema: 'catalog.schema.json#/$defs/scriptPatchPlanInput2x', input: catalogSchema.$defs.scriptPatchPlanInput2x, preconditions: ['existingProjectScript', 'assetDbReady'] } } : {}),
        ...(target.creatorVersion === '2.4.15' ? { 'script.patch': { contractVersion: '0.2', access: 'write', inputSchema: 'catalog.schema.json#/$defs/scriptPatchInput2x', input: catalogSchema.$defs.scriptPatchInput2x, preconditions: ['existingProjectScript', 'assetDbReady'] } } : {}),
        ...(target.creatorVersion === '2.4.15' ? { 'script.operation.get': { contractVersion: '0.2', access: 'read', inputSchema: 'catalog.schema.json#/$defs/scriptOperationGetInput2x', input: catalogSchema.$defs.scriptOperationGetInput2x, preconditions: ['existingProjectScript', 'assetDbReady'] } } : {}),
        'scene.snapshot': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/snapshotInput', input: catalogSchema.$defs.snapshotInput, preconditions: ['activeScene'] },
        ...(target.creatorVersion === '2.4.15' ? { 'runtime.preview.start': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/runtimePreviewStartInput2x',
            input: catalogSchema.$defs.runtimePreviewStartInput2x, preconditions: ['activeScene'] } } : {}),
        'scene.node.inspect': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/nodeInspectInput', input: catalogSchema.$defs.nodeInspectInput, preconditions: ['activeScene'] },
        ...(target.creatorVersion === '2.4.15' ? { 'asset.searchPng': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/pngAssetSearchInput', input: catalogSchema.$defs.pngAssetSearchInput, preconditions: ['assetDbReady'] } } : {}),
        'asset.importPng': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/importPngInput', input: catalogSchema.$defs.importPngInput, preconditions: ['stagedPng', 'destinationFree'] },
        ...(target.creatorVersion === '2.4.15' ? { 'asset.removeImportedPng': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/removeImportedPngInput',
            input: catalogSchema.$defs.removeImportedPngInput, preconditions: ['assetIdentityMatches', 'noSerializedReferences'] } } : {}),
        ...(target.creatorVersion === '2.4.15' ? { 'asset.validatePng': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/pipelinePngInput',
            input: catalogSchema.$defs.pipelinePngInput, preconditions: ['pipelineOwnedAsset', 'importedMetadata'] },
        'asset.refreshPng': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/pipelinePngInput',
            input: catalogSchema.$defs.pipelinePngInput, preconditions: ['pipelineOwnedAsset', 'assetDbMappingStale', 'stableUuid'] },
        'asset.refreshFolder': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/assetFolderRefreshInput',
            input: catalogSchema.$defs.assetFolderRefreshInput, preconditions: ['folderUnderAssets', 'assetDbRefreshAvailable'] } } : {}),
        'scene.pngSprite': { access: 'write', inputSchema: target.creatorVersion === '2.4.15' ? 'catalog.schema.json#/$defs/pngSpriteInput2x' : 'catalog.schema.json#/$defs/pngSpriteInput',
            input: target.creatorVersion === '2.4.15' ? catalogSchema.$defs.pngSpriteInput2x : catalogSchema.$defs.pngSpriteInput,
            preconditions: target.creatorVersion === '2.4.15' ? ['activeScene', 'canvasExisting', 'spriteFrameImported'] : ['activeScene', 'spriteFrameImported'] },
        'scene.node.create': { access: 'write', inputSchema: target.creatorVersion === '2.4.15' ? 'catalog.schema.json#/$defs/nodeCreateInput2x' : 'catalog.schema.json#/$defs/nodeCreateInput',
            input: target.creatorVersion === '2.4.15' ? catalogSchema.$defs.nodeCreateInput2x : catalogSchema.$defs.nodeCreateInput,
            preconditions: target.creatorVersion === '2.4.15' ? ['activeScene', 'parentIdentity', 'componentTypesWhitelisted', 'componentSetCompatible', 'resourceReferencesResolvable', 'prefabAssetResolvableIfRequested'] : ['activeScene', 'parentIdentity'] },
        ...(target.creatorVersion === '2.4.15' ? { 'scene.node.patch': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/nodePatchInput2x',
            input: catalogSchema.$defs.nodePatchInput2x, preconditions: ['activeScene', 'nodePathAndUuidMatch', 'expectedBeforeValues', 'propertyWhitelist', 'resourceReferencesResolvable'] } } : {}),
        ...(target.creatorVersion === '2.4.15' ? { 'prefab.source.patch': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/prefabSourcePatchInput2x',
            input: catalogSchema.$defs.prefabSourcePatchInput2x, preconditions: ['activeScene', 'prefabUuidResolvable', 'sourceShaMatches', 'prefabEditModeAvailable', 'nodePathAndUuidMatch', 'expectedBeforeValues'] },
        'prefab.source.inspect': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/prefabSourceInspectInput2x',
            input: catalogSchema.$defs.prefabSourceInspectInput2x, preconditions: ['prefabUuidResolvable', 'serializedPrefabReadable'] },
        'content.stress.run': { contractVersion: '0.2', access: 'read', inputSchema: 'catalog.schema.json#/$defs/contentStressRunInput2x',
            input: catalogSchema.$defs.contentStressRunInput2x, preconditions: ['completedWebMobileBuild', 'complexPackagedPngResources', 'coldCacheProfile', 'explicitDeviceScreeningBudget'] } } : {}),
    };
    if (target.creatorVersion === '2.4.15') {
        for (const [id, contract] of Object.entries(catalogSchema['x-cocos-command-inputs-2x'])) {
            const input = catalogSchema.$defs[contract.input];
            if (!input || !['read', 'write'].includes(contract.access)
                || typeof contract.contractVersion !== 'string' || !Array.isArray(contract.preconditions)) return false;
            expected[id] = { contractVersion: contract.contractVersion, access: contract.access,
                inputSchema: `catalog.schema.json#/$defs/${contract.input}`, input,
                preconditions: contract.preconditions };
        }
    }
    const actualRevision = sha256(JSON.stringify({ scene: result.activeScene,
        ...(result.activeSceneUuid ? { sceneUuid: result.activeSceneUuid } : {}), commands: result.commands }));
    if (actualRevision !== result.catalogRevision) return false;
    const actualFingerprint = commandContractFingerprint(result.commands);
    const compatibility = runtimeCompatibility(target, result, actualFingerprint);
    const byId = new Map();
    const duplicateIds = new Set();
    for (const command of result.commands) {
        if (!command || typeof command.id !== 'string') continue;
        if (byId.has(command.id)) duplicateIds.add(command.id);
        else byId.set(command.id, command);
    }
    const diagnostics = [...compatibility.diagnostics];
    const normalized = [];
    const sceneReady = typeof result.activeScene === 'string' && result.activeScene.length > 0;
    for (const [id, rule] of Object.entries(expected)) {
        const actual = byId.get(id);
        const version = rule.contractVersion || '0.1';
        const expectedContract = { id, contractVersion: version, access: rule.access, inputSchema: rule.inputSchema,
            input: rule.input, preconditions: rule.preconditions };
        if (!actual) {
            normalized.push({ ...expectedContract, status: 'unavailable', reason: 'COMMAND_CONTRACT_MISSING',
                contractStatus: 'missing', editorStatus: 'unavailable' });
            diagnostics.push({ component: 'command', id, status: 'missing', code: 'COMMAND_CONTRACT_MISSING' });
            continue;
        }
        const mismatchFields = [];
        if (duplicateIds.has(id)) mismatchFields.push('duplicateId');
        for (const field of ['contractVersion', 'access', 'inputSchema', 'input', 'preconditions']) {
            const expectedValue = field === 'contractVersion' ? version : rule[field];
            if (!isDeepStrictEqual(actual[field], expectedValue)) mismatchFields.push(field);
        }
        const runtimeStatusValid = ['available', 'unavailable'].includes(actual.status)
            && (actual.status === 'available' ? actual.reason === null : typeof actual.reason === 'string');
        if (!runtimeStatusValid) mismatchFields.push('runtimeStatus');
        if (target.creatorVersion === '2.4.15' && runtimeStatusValid && !runtimeStateMatches(actual, sceneReady))
            mismatchFields.push('runtimeAvailability');
        const editorStatus = runtimeStatusValid ? actual.status : 'unavailable';
        const editorReason = runtimeStatusValid ? actual.reason : 'INVALID_RUNTIME_STATUS';
        let status = editorStatus;
        let reason = editorReason;
        if (mismatchFields.length) {
            status = 'unavailable';
            reason = 'COMMAND_CONTRACT_MISMATCH';
            diagnostics.push({ component: 'command', id, status: 'mismatch', code: reason, fields: mismatchFields });
        } else if (compatibility.blockers.length) {
            status = 'unavailable';
            reason = compatibility.blockers[0];
        }
        normalized.push({ ...actual, status, reason,
            editorStatus, editorReason,
            contractStatus: mismatchFields.length ? 'mismatch' : 'matched' });
    }
    for (const actual of result.commands) {
        if (!actual || typeof actual.id !== 'string') {
            diagnostics.push({ component: 'command', status: 'invalid', code: 'COMMAND_DESCRIPTOR_INVALID' });
            continue;
        }
        if (expected[actual.id]) continue;
        normalized.push({ ...actual, editorStatus: actual.status, editorReason: actual.reason,
            status: 'unavailable', reason: 'COMMAND_NOT_SUPPORTED_BY_HOST', contractStatus: 'unsupported' });
        diagnostics.push({ component: 'command', id: actual.id, status: 'unsupported', code: 'COMMAND_NOT_SUPPORTED_BY_HOST' });
    }
    target.commands = normalized;
    target.activeScene = result.activeScene;
    target.activeSceneUuid = result.activeSceneUuid || null;
    target.catalogRevision = result.catalogRevision;
    target.extensionVersion = result.extensionVersion || null;
    target.extensionSourceFingerprint = result.extensionSourceFingerprint || null;
    target.commandContractFingerprint = actualFingerprint;
    target.contractCompatibility = { status: compatibility.status, blockers: compatibility.blockers,
        editorContractStatus: result.commandContractFingerprint === actualFingerprint ? 'matched' : 'mismatch',
        hostContractStatus: diagnostics.some((entry) => entry.component === 'command' && entry.status !== 'matched') ? 'partial' : 'matched' };
    target.contractDiagnostics = diagnostics;
    return true;
}

wss.on('connection', (socket, request) => {
    const target = targets.find((item) => item.token === request.headers['x-cocos-agent-token']);
    if (!target || target.socket) { socket.close(1008); return; }
    target.socket = socket;
    socket.on('message', (raw) => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch (_) { unavailable(target, 'INVALID_RESPONSE'); return; }
        if (message.type === 'hello') {
            if (message.creatorVersion !== target.creatorVersion) {
                socket.send(JSON.stringify({ type: 'helloAck', accepted: false, reason: 'creator-version-mismatch' }));
                unavailable(target, 'CREATOR_VERSION_MISMATCH');
                return;
            }
            if (target.state !== 'disconnected' || message.protocolVersion !== '0.1'
                || path.resolve(message.projectRoot || '') !== target.projectRoot
                || message.extension !== 'cocos-agent-bridge' || !/^[0-9a-f-]{36}$/i.test(message.instanceId || '')) {
                socket.send(JSON.stringify({ type: 'helloAck', accepted: false, reason: 'instance-mismatch' }));
                unavailable(target, 'INSTANCE_MISMATCH');
                return;
            }
            target.instanceId = message.instanceId;
            target.state = 'connected';
            socket.send(JSON.stringify({ type: 'helloAck', accepted: true, sessionId: target.sessionId, protocolVersion: '0.1' }));
            sendRequest(target, 'capabilities.list');
            return;
        }
        if (message.type !== 'response' || message.id !== target.requestId) { unavailable(target, 'INVALID_RESPONSE'); return; }
        const result = message.result || {};
        if (target.state === 'connected') {
            if (result.creatorVersion && result.creatorVersion !== target.creatorVersion) {
                unavailable(target, 'CREATOR_VERSION_MISMATCH');
                return;
            }
            if (message.ok !== true || result.nonce !== target.nonce || result.instanceId !== target.instanceId
                || result.creatorVersion !== target.creatorVersion || path.resolve(result.projectRoot || '') !== target.projectRoot
                || !validCatalog(target, result)) {
                unavailable(target, 'CAPABILITY_CATALOG_INVALID');
                return;
            }
            target.state = 'catalogued';
            sendRequest(target, 'scene.snapshot');
            return;
        }
        if (target.state === 'catalogued') {
            if (message.ok === true) {
                if (result.nonce !== target.nonce || result.creatorVersion !== target.creatorVersion
                    || path.resolve(result.projectRoot || '') !== target.projectRoot || result.sceneName !== target.activeScene) {
                    unavailable(target, 'SCENE_CHANGED');
                    return;
                }
            } else if (target.activeScene !== null) {
                unavailable(target, 'SCENE_CHANGED');
                return;
            }
            target.state = 'ready';
            maybeFinish();
        }
    });
    socket.on('close', () => { if (!finished && target.state !== 'ready' && target.state !== 'unavailable') unavailable(target, 'EDITOR_DISCONNECTED'); });
    socket.on('error', () => { if (!finished) unavailable(target, 'EDITOR_DISCONNECTED'); });
});

server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    for (const target of targets) {
        const file = sessionPath(target);
        try {
            const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (existing.expiresAt > Date.now()) {
                target.error = 'ACTIVE_SESSION_EXISTS';
                target.state = 'unavailable';
                continue;
            }
        } catch (_) { /* No existing session. */ }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ sessionId: target.sessionId, protocolVersion: '0.1',
            creatorVersion: target.creatorVersion, projectRoot: target.projectRoot,
            url: `ws://127.0.0.1:${address.port}/cocos-agent-bridge`, token: target.token,
            expiresAt: Date.now() + 20000 }), { mode: 0o600 });
        fs.chmodSync(file, 0o600);
    }
    timer = setTimeout(finish, 15000);
    maybeFinish();
});

process.on('SIGINT', () => { cleanup(); process.exit(130); });
