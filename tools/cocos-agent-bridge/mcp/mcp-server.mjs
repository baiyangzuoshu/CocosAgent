import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const require = createRequire(import.meta.url);
const { handleAsync } = require('../agent-jsonl.js');
const CREATOR_VERSION = '2.4.15';
const COMMANDS_2X = [
    'scene.snapshot', 'scene.node.inspect', 'asset.importPng', 'asset.removeImportedPng',
    'asset.validatePng', 'asset.refreshPng', 'scene.pngSprite', 'scene.node.create',
];
const CONTENT_BUILD_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{2,31}$/);
const RELEASE_ID = z.string().regex(/^(?!(selected|effective)$)[a-z0-9][a-z0-9._-]{0,63}$/);
const SHA256 = z.string().regex(/^[a-f0-9]{64}$/);
const UUID = z.string().regex(/^[0-9a-fA-F-]{36}$/);
const RESOURCE_NAME = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/);
const SERVER_VERSION = '0.1.0';

function positionSchema() {
    return z.object({
        x: z.number().min(-4096).max(4096),
        y: z.number().min(-4096).max(4096),
    }).strict();
}

function commandInputSchema(projectRoot) {
    const definitions = {
        'scene.snapshot': z.object({ targetNodeName: z.string().min(1).max(64).optional() }).strict(),
        'scene.node.inspect': z.object({ nodePath: z.string().min(1).max(240) }).strict(),
        'asset.importPng': z.object({ sourcePath: z.string().min(1) }).strict(),
        'asset.removeImportedPng': z.object({ assetName: RESOURCE_NAME, textureUuid: UUID,
            spriteFrameUuid: UUID, sha256: SHA256 }).strict(),
        'asset.validatePng': z.object({ pipelineId: UUID, assetName: RESOURCE_NAME }).strict(),
        'asset.refreshPng': z.object({ pipelineId: UUID, assetName: RESOURCE_NAME }).strict(),
        'scene.pngSprite': z.object({ assetName: RESOURCE_NAME, action: z.enum(['apply', 'compensate', 'replay']),
            operationId: UUID.optional(), position: positionSchema().optional() }).strict(),
        'scene.node.create': z.object({
            parentPath: z.string().min(1).max(240),
            parentUuid: z.string().min(1).max(64),
            nodeName: z.string().regex(/^[A-Za-z0-9_ -]{1,64}$/),
            action: z.enum(['apply', 'compensate', 'replay']),
            components: z.array(z.union([
                z.object({ classId: z.literal('cc.Sprite'), spriteFrameUuid: UUID }).strict(),
                z.object({ classId: z.literal('cc.Label'), text: z.string().max(256) }).strict(),
            ])).max(1).optional(),
            transform: z.object({ position: positionSchema().optional(), scale: positionSchema().optional() }).strict().optional(),
            sourceOperationId: UUID.optional(),
            operationId: UUID.optional(),
        }).strict(),
    };
    return z.discriminatedUnion('command', COMMANDS_2X.map((command) => z.object({
        projectRoot,
        command: z.literal(command),
        input: definitions[command],
    }).strict()));
}

function parseArgs(args) {
    const projects = [];
    for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '--project' && args[i + 1]) {
            projects.push(args[++i]);
        } else if (args[i] === '--help') {
            return { help: true, projects: [] };
        } else {
            throw new Error('Use one or more --project <absolute Creator 2.4.15 project path> arguments.');
        }
    }
    if (!projects.length) throw new Error('At least one --project path is required.');

    const canonical = projects.map((project) => {
        if (!path.isAbsolute(project)) throw new Error('Every --project path must be absolute.');
        const root = fs.realpathSync(project);
        if (!fs.statSync(root).isDirectory()) throw new Error(`Project path is not a directory: ${project}`);
        return root;
    });
    if (new Set(canonical).size !== canonical.length) throw new Error('Project paths must be unique after resolving symlinks.');
    if (canonical.length > 8) throw new Error('At most 8 Creator projects can be registered in one MCP process.');
    return { help: false, projects: canonical };
}

function createServer(projectRoots, options = {}) {
    if (!Array.isArray(projectRoots) || projectRoots.length < 1 || projectRoots.length > 8
        || projectRoots.some((root) => typeof root !== 'string' || !path.isAbsolute(root))) {
        throw new TypeError('Provide 1–8 absolute Creator project roots.');
    }
    const roots = [...new Set(projectRoots.map((root) => path.resolve(root)))];
    if (roots.length !== projectRoots.length) throw new TypeError('Creator project roots must be unique.');
    const targetList = roots.map((projectRoot) => ({ creatorVersion: CREATOR_VERSION, projectRoot }));
    const projectRoot = z.enum(roots);
    const invokeAgent = options.invokeAgent || handleAsync;
    let requestId = 0;
    const server = new McpServer({ name: 'cocos-agent-2x', version: SERVER_VERSION });

    async function invoke(method, params) {
        try {
            const response = await invokeAgent({ id: ++requestId, method, params });
            return response && response.result && typeof response.result === 'object'
                ? response.result
                : { success: false, error: { code: 'INVALID_HOST_RESPONSE', message: 'CocosAgent Host returned an invalid result.' } };
        } catch (_) {
            return { success: false, error: { code: 'INTERNAL_ERROR', message: 'CocosAgent request failed.' } };
        }
    }

    function toolReply(result) {
        let serialized;
        try { serialized = JSON.stringify(result); }
        catch (_) { serialized = '{"success":false,"error":{"code":"SERIALIZATION_FAILED","message":"CocosAgent result could not be serialized."}}'; }
        return {
            content: [{ type: 'text', text: serialized }],
            structuredContent: result,
            isError: result?.success === false,
        };
    }

    function register(name, description, inputSchema, method, mapArgs, annotations) {
        server.registerTool(name, { description, inputSchema, annotations }, async (args) => {
            const result = await invoke(method, mapArgs(args));
            return toolReply(result);
        });
    }

    register('cocos_2x_instances_list',
        'List only the Creator 2.4.15 projects registered when this MCP process starts. Call this first to see which editor instances are reachable.',
        z.object({}).strict(), 'instances.list', () => ({ targets: targetList }),
        { title: 'List Creator 2.4.15 instances', readOnlyHint: true, destructiveHint: false, openWorldHint: false });

    register('cocos_2x_instances_get',
        'Get the live state for one registered Creator 2.4.15 project. Choose projectRoot from cocos_2x_instances_list.',
        z.object({ projectRoot }).strict(), 'instances.get', ({ projectRoot: selected }) => ({
            targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION,
        }), { title: 'Get a Creator 2.4.15 instance', readOnlyHint: true, destructiveHint: false, openWorldHint: false });

    register('cocos_2x_capabilities_list',
        'List the live command contracts and availability for one registered Creator 2.4.15 project. Query this before command execution.',
        z.object({ projectRoot }).strict(), 'capabilities.list', ({ projectRoot: selected }) => ({
            targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION,
        }), { title: 'List Creator 2.4.15 capabilities', readOnlyHint: true, destructiveHint: false, openWorldHint: false });

    register('cocos_2x_command_execute',
        'Execute one semantic command from the selected Creator 2.4.15 project catalog. Query capabilities first and use only a command currently marked available. The input schema varies by command and matches the 2.4 catalog. This tool may change the project; its result carries CocosAgent status, phases and error codes.',
        commandInputSchema(projectRoot), 'command.execute', ({ projectRoot: selected, command, input }) => ({
            targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION, command, input,
        }), { title: 'Execute a Creator 2.4.15 command', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });

    const buildInput = z.object({
        projectRoot,
        releaseId: RELEASE_ID,
        expectedFingerprint: SHA256,
        buildId: CONTENT_BUILD_ID,
    }).strict();
    register('cocos_2x_content_build_plan',
        'Validate a selected Creator 2.4.15 content release and return a Web-Mobile build plan without starting Creator or writing the build output.',
        buildInput, 'content.build.plan', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Plan a Creator 2.4.15 content build', readOnlyHint: true, destructiveHint: false, openWorldHint: false });

    register('cocos_2x_content_build_execute',
        'Build the selected release for Creator 2.4.15 Web-Mobile into the verified isolated build path. This writes build output and persists a Host build record.',
        buildInput, 'content.build.execute', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Build Creator 2.4.15 Web-Mobile content', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });

    const buildGetInput = z.object({ projectRoot, buildId: CONTENT_BUILD_ID }).strict();
    register('cocos_2x_content_build_get',
        'Read the persisted state and verification result for a Creator 2.4.15 build.',
        buildGetInput, 'content.build.get', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Read a Creator 2.4.15 build record', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_content_build_reconcile',
        'Read and reconcile a prior interrupted Creator 2.4.15 build from its output and Host record. Does not launch Creator again.',
        buildGetInput, 'content.build.reconcile', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Reconcile a Creator 2.4.15 build', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

    const previewInput = z.object({ projectRoot, buildId: CONTENT_BUILD_ID }).strict();
    register('cocos_2x_content_preview_start',
        'Start a loopback-only Web-Mobile preview for a completed, verified Creator 2.4.15 build whose release is still selected. Returns the local preview URL; it does not open a browser.',
        previewInput, 'content.preview.start', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Start a Creator 2.4.15 content preview', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_content_preview_get',
        'Read the current loopback preview session status and the latest runtime receipt.',
        previewInput, 'content.preview.get', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Read a Creator 2.4.15 preview session', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_content_preview_stop',
        'Stop the local preview runtime and loopback static server for this Creator 2.4.15 build.',
        previewInput, 'content.preview.stop', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Stop a Creator 2.4.15 content preview', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

    server.server.onclose = () => { void require('../content-preview.js').closeAll().catch(() => {}); };
    return server;
}

function usage() {
    return 'Usage: node mcp-server.mjs --project <absolute Creator 2.4.15 project path> [--project <another registered project path>]';
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
    try {
        const parsed = parseArgs(process.argv.slice(2));
        if (parsed.help) {
            process.stderr.write(`${usage()}\n`);
            process.exitCode = 0;
        } else {
            serveStdio(() => createServer(parsed.projects));
        }
    } catch (error) {
        process.stderr.write(`${error.message}\n${usage()}\n`);
        process.exitCode = 2;
    }
}

export { COMMANDS_2X, CREATOR_VERSION, createServer, parseArgs };
