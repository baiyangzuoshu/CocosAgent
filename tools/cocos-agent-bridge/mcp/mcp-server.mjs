import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const require = createRequire(import.meta.url);
const { handleAsync } = require('../agent-jsonl.js');
const CREATOR_VERSION = '2.4.15';
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const COCOS_2X_SKILL_URI = 'cocos://2x/agent/mcp-tools';
const COCOS_2X_SKILL_PATH = path.join(REPOSITORY_ROOT, 'docs/agent-foundation/skills/cocos2-mcp-tools/SKILL.md');
const COCOS_2X_COMPOSITION_SKILL_URI = 'cocos://2x/skills/scene-composition';
const COCOS_2X_COMPOSITION_SKILL_PATH = path.join(REPOSITORY_ROOT, 'plugins/cocos-agent-2x/skills/cocos2-scene-composition/SKILL.md');
const COMMANDS_2X = [
    'scene.snapshot', 'scene.node.inspect', 'asset.searchPng', 'asset.importPng', 'asset.removeImportedPng',
    'asset.validatePng', 'asset.refreshPng', 'asset.refreshFolder', 'scene.pngSprite', 'scene.node.create', 'scene.node.patch',
];
const CONTENT_BUILD_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{2,31}$/);
const RELEASE_ID = z.string().regex(/^(?!(selected|effective)$)[a-z0-9][a-z0-9._-]{0,63}$/);
const SHA256 = z.string().regex(/^[a-f0-9]{64}$/);
const UUID = z.string().regex(/^[0-9a-fA-F-]{36}$/);
const OPERATION_ID = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
const RESOURCE_NAME = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/);
const ASSET_FOLDER_PATH = z.string().min(1).max(240).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.-]*){0,7}$/);
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
        'asset.searchPng': z.object({ query: z.string().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/), limit: z.number().int().min(1).max(50).optional(),
            offset: z.number().int().min(0).max(100000).optional() }).strict(),
        'asset.importPng': z.object({ sourcePath: z.string().min(1) }).strict(),
        'asset.removeImportedPng': z.object({ assetName: RESOURCE_NAME, textureUuid: UUID,
            spriteFrameUuid: UUID, sha256: SHA256 }).strict(),
        'asset.validatePng': z.object({ pipelineId: UUID, assetName: RESOURCE_NAME }).strict(),
        'asset.refreshPng': z.object({ pipelineId: UUID, assetName: RESOURCE_NAME }).strict(),
        'asset.refreshFolder': z.object({ folderPath: ASSET_FOLDER_PATH }).strict(),
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
            prefabMode: z.enum(['create', 'instantiate']).optional(),
            prefabUuid: UUID.optional(),
            sourceOperationId: UUID.optional(),
            operationId: UUID.optional(),
        }).strict().superRefine((input, context) => {
            if (input.prefabMode === 'create' && input.prefabUuid) context.addIssue({ code: 'custom', path: ['prefabUuid'], message: 'Prefab creation assigns its own UUID.' });
            if (input.prefabMode === 'instantiate' && input.action === 'apply' && !input.prefabUuid) context.addIssue({ code: 'custom', path: ['prefabUuid'], message: 'Instantiation requires an imported Prefab UUID.' });
            if (input.prefabMode !== 'instantiate' && input.prefabUuid) context.addIssue({ code: 'custom', path: ['prefabUuid'], message: 'Prefab UUID is only accepted for instantiation.' });
            if (input.prefabMode === 'instantiate' && input.components && input.components.length) context.addIssue({ code: 'custom', path: ['components'], message: 'Prefab instances take their components from the Prefab asset.' });
        }),
        'scene.node.patch': z.object({
            targetNodePath: z.string().min(1).max(240),
            targetNodeUuid: z.string().min(1).max(64).regex(/^[A-Za-z0-9_+/=-]+$/),
            action: z.enum(['apply', 'compensate', 'replay']),
            expectedDiff: z.array(z.object({
                path: z.enum(['node.name', 'node.active', 'node.position.x', 'node.position.y', 'node.scale.x', 'node.scale.y',
                    'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid', 'component.cc.Label.enabled']),
                before: z.union([z.string(), z.number(), z.boolean(), z.null()]),
                after: z.union([z.string(), z.number(), z.boolean(), z.null()]),
            }).strict()).min(1).max(16),
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

function runAgentWorker(request, onProgress, cancelBuffer) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./agent-request-worker.mjs', import.meta.url), { workerData: { request, cancelBuffer } });
        let settled = false;
        let progressQueue = Promise.resolve();
        worker.on('message', (message) => {
            if (message?.type === 'progress') {
                progressQueue = progressQueue.then(() => onProgress(message.progress)).catch(() => {});
            } else if (message?.type === 'result') {
                settled = true;
                progressQueue.then(() => resolve(message.response));
            } else if (message?.type === 'failure') {
                settled = true;
                progressQueue.then(() => reject(new Error(message.code || 'WORKER_FAILED')));
            }
        });
        worker.once('error', (error) => {
            if (settled) return;
            settled = true;
            progressQueue.then(() => reject(error));
        });
        worker.once('exit', (code) => {
            if (settled) return;
            settled = true;
            progressQueue.then(() => reject(new Error(`Agent worker exited before returning a result (${code}).`)));
        });
    });
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
    const runScenePipelineWorker = options.runScenePipelineWorker || runAgentWorker;
    const activeScenePipelines = new Map();
    let requestId = 0;
    const server = new McpServer({ name: 'cocos-agent-2x', version: SERVER_VERSION });

    server.registerResource('cocos2-mcp-tools', COCOS_2X_SKILL_URI, {
        title: 'CocosAgent MCP tools for Creator 2.4',
        description: 'Version-specific instructions for selecting Creator 2.4.15, executing semantic tools, recovering writes, and validating resources and content.',
        mimeType: 'text/markdown',
    }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(COCOS_2X_SKILL_PATH, 'utf8') }] }));

    server.registerResource('cocos2-scene-composition-skill', COCOS_2X_COMPOSITION_SKILL_URI, {
        title: 'CocosAgent Creator 2.4 scene composition skill',
        description: 'Version-specific instructions for composing multiple nodes and components with the durable workflow tools.',
        mimeType: 'text/markdown',
    }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(COCOS_2X_COMPOSITION_SKILL_PATH, 'utf8') }] }));

    server.registerPrompt('cocos_2x_resource_to_scene_workflow', {
        title: 'Find or import PNGs into a Creator 2.4 scene',
        description: 'Guide a requested existing or new PNG-to-scene operation through discovery or import, readback, visual acceptance, and optional content release staging.',
        argsSchema: z.object({ projectRoot, request: z.string().min(1).max(2000) }).strict(),
    }, ({ projectRoot: selectedProject, request }) => ({
        messages: [{ role: 'user', content: { type: 'text', text: [
            `Target the registered Creator 2.4.15 project ${selectedProject}. User request: ${request}`,
            'Start with cocos_2x_instances_get and cocos_2x_capabilities_list. Continue only if this exact project is ready.',
            'When the requested PNG already exists in the project, call cocos_2x_asset_search_png with input.query. Use only an item whose metadataStatus is valid. If no valid match exists or multiple candidates fit the request, stop and ask which asset to use.',
            'For a uniquely identified existing PNG, call cocos_2x_scene_node_inspect for the requested parent and use its exact node path and UUID. When the user requested scene placement, call cocos_2x_command_execute with scene.node.create, a cc.Sprite component that references the returned spriteFrameUuid, and only the requested transform.',
            'When the request provides new local PNG files, call cocos_2x_assets_scene_plan. Review the returned pipelineId, asset identities, target Canvas, node names, and positions before calling cocos_2x_assets_scene_execute once.',
            'After scene.node.create, inspect the operation phases and matching local Web preview; record visual acceptance only after viewing the requested Sprite. If the write outcome is uncertain, inspect operation state and never repeat the write blindly.',
            'For an existing scene node, inspect its exact path and UUID. Use scene.node.patch only with explicit before/after values for supported node, Sprite, or Label fields. Preserve the returned expectedDiff and operationId; compensate only if the current fields still equal the recorded after values.',
            'After execution, read cocos_2x_assets_scene_get and cocos_2x_assets_scene_validate. If a call times out or returns an uncertain state, do not retry execute; inspect the pipeline, exact nodes, and operation records, then compensate only with the required live and disk evidence.',
            'Call cocos_2x_assets_scene_cancel only when the user explicitly asks to cancel an active resource-to-scene execution. Cancellation waits for the current Host call, stops at a safe write boundary, and attempts compensation; inspect the final pipeline receipt.',
            'Inspect each Sprite in the matching local Web preview before calling cocos_2x_assets_scene_preview_accept. Never invent visual evidence or treat source, disk, or headless-only observations as visual acceptance.',
            'Call cocos_2x_content_from_scene_plan only after the pipeline is completed and every item is visually accepted. Review stable IDs, dependencies, entry asset, derived UUIDs, and fingerprint; call cocos_2x_content_from_scene_stage only when the user requested release staging and the plan is valid.',
            'Use cocos://2x/agent/mcp-tools for the full version-specific tool and recovery instructions.',
        ].join('\n\n') } }],
    }));

    async function invoke(method, params, context) {
        const selectedProject = typeof params?.projectRoot === 'string' ? path.resolve(params.projectRoot) : null;
        if (method === 'assets.scene.cancel') {
            const active = selectedProject && activeScenePipelines.get(selectedProject);
            if (!active) return { success: false, outcome: 'failed', error: { code: 'PIPELINE_NOT_RUNNING',
                message: 'No active resource-to-scene execution exists for this project.' } };
            if (active.pipelineId !== params.pipelineId) return { success: false, outcome: 'failed', error: { code: 'PIPELINE_ID_MISMATCH',
                message: 'The active resource-to-scene operation has a different pipelineId.' } };
            if (Atomics.load(active.cancelView, 0) === 1) return { success: true, outcome: 'cancellation-already-requested', pipelineId: active.pipelineId };
            Atomics.store(active.cancelView, 0, 1);
            return { success: true, outcome: 'cancellation-requested', pipelineId: active.pipelineId,
                message: 'Cancellation will be applied at the next safe write boundary.' };
        }
        if (selectedProject && activeScenePipelines.has(selectedProject) && method !== 'assets.scene.execute'
            && !['assets.scene.get', 'assets.scene.validate', 'instances.get', 'capabilities.list', 'operation.get'].includes(method)) {
            return { success: false, outcome: 'in-progress', error: { code: 'EDITOR_BUSY',
                message: 'A resource-to-scene operation is running for this project. Read its pipeline receipt before starting another write.' } };
        }
        const progressToken = context?.mcpReq?._meta?.progressToken;
        let progressValue = 0;
        const onProgress = async (event) => {
            if (progressToken === undefined || typeof context?.mcpReq?.notify !== 'function') return;
            const progress = Number.isSafeInteger(event?.progress) && event.progress > progressValue
                ? event.progress : progressValue + 1;
            progressValue = progress;
            const command = typeof event?.command === 'string' ? event.command : 'CocosAgent';
            const state = event?.state === 'started' ? '开始' : '完成';
            const suffix = typeof event?.outcome === 'string' ? `，结果 ${event.outcome}` : '';
            try {
                await context.mcpReq.notify({ method: 'notifications/progress', params: {
                    progress, progressToken, message: `${command} ${state}${suffix}`,
                } });
            } catch (_) { /* A detached MCP client must not interrupt an editor operation. */ }
        };
        try {
            const request = { id: ++requestId, method, params };
            let response;
            if (method === 'assets.scene.execute') {
                if (!selectedProject) return { success: false, outcome: 'failed', error: { code: 'INVALID_ARGUMENT', message: 'A registered project is required.' } };
                if (activeScenePipelines.has(selectedProject)) {
                    return { success: false, outcome: 'in-progress', error: { code: 'PIPELINE_EXECUTION_IN_PROGRESS',
                        message: 'A resource-to-scene operation is already running for this project. Read its pipeline receipt; do not retry execute.' } };
                }
                const cancelBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
                const active = { pipelineId: params.pipelineId, cancelView: new Int32Array(cancelBuffer), promise: null };
                activeScenePipelines.set(selectedProject, active);
                try {
                    active.promise = options.invokeAgent
                        ? invokeAgent(request, { onProgress })
                        : runScenePipelineWorker(request, onProgress, cancelBuffer);
                    response = await active.promise;
                } finally { activeScenePipelines.delete(selectedProject); }
            } else {
                response = await invokeAgent(request, { onProgress });
            }
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
        server.registerTool(name, { description, inputSchema, annotations }, async (args, context) => {
            const result = await invoke(method, mapArgs(args), context);
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

    const readOnlyCommandTools = [
        {
            name: 'cocos_2x_scene_snapshot',
            command: 'scene.snapshot',
            description: 'Read the active Creator 2.4.15 scene hierarchy and summary. This dedicated read-only tool cannot execute scene or asset writes.',
            input: z.object({ targetNodeName: z.string().min(1).max(64).optional() }).strict(),
        },
        {
            name: 'cocos_2x_scene_node_inspect',
            command: 'scene.node.inspect',
            description: 'Read one node by its exact scene path in Creator 2.4.15. This dedicated read-only tool cannot execute scene or asset writes.',
            input: z.object({ nodePath: z.string().min(1).max(240) }).strict(),
        },
        {
            name: 'cocos_2x_asset_search_png',
            command: 'asset.searchPng',
            description: 'Search Creator 2.4.15 project PNG assets and their imported metadata. This dedicated read-only tool cannot execute scene or asset writes.',
            input: z.object({ query: z.string().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/),
                limit: z.number().int().min(1).max(50).optional(), offset: z.number().int().min(0).max(100000).optional() }).strict(),
        },
        {
            name: 'cocos_2x_asset_validate_png',
            command: 'asset.validatePng',
            description: 'Read and validate one PNG owned by a Creator 2.4.15 resource pipeline. This dedicated read-only tool cannot execute scene or asset writes.',
            input: z.object({ pipelineId: OPERATION_ID, assetName: RESOURCE_NAME }).strict(),
        },
    ];
    for (const tool of readOnlyCommandTools) {
        register(tool.name, tool.description, z.object({ projectRoot, input: tool.input }).strict(), 'command.execute',
            ({ projectRoot: selected, input }) => ({
                targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION,
                command: tool.command, input,
            }), { title: tool.name, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    }

    register('cocos_2x_command_execute',
        'Execute one semantic command from the selected Creator 2.4.15 project catalog. Query capabilities first and use only a command currently marked available. The input schema varies by command and matches the 2.4 catalog. This tool may change the project; its result carries CocosAgent status, phases and error codes.',
        commandInputSchema(projectRoot), 'command.execute', ({ projectRoot: selected, command, input }) => ({
            targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION, command, input,
        }), { title: 'Execute a Creator 2.4.15 command', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });

    const workflowId = OPERATION_ID;
    const stepId = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);
    const nodeName = z.string().regex(/^[A-Za-z0-9_ -]{1,64}$/);
    const workflowParent = z.union([
        z.object({ path: z.string().min(1).max(170).refine((value) => !value.includes('//') && !value.includes(String.fromCharCode(92))), uuid: z.string().min(1).max(64) }).strict(),
        z.object({ ref: stepId }).strict(),
    ]);
    const workflowComponent = z.union([
        z.object({ classId: z.literal('cc.Sprite'), spriteFrameUuid: UUID }).strict(),
        z.object({ classId: z.literal('cc.Label'), text: z.string().max(256) }).strict(),
    ]);
    const workflowStep = z.object({
        id: stepId,
        name: nodeName,
        parent: workflowParent,
        components: z.array(workflowComponent).max(1).optional(),
        transform: z.object({ position: positionSchema().optional(), scale: positionSchema().optional() }).strict().optional(),
    }).strict();
    const workflowSteps = z.array(workflowStep).min(2).max(8);
    function workflowParams(selected, params = {}) {
        return { targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params };
    }
    register('cocos_2x_workflow_plan',
        'Read-only preflight for a durable Creator 2.4.15 multi-step scene composition. Checks the exact editor instance, active scene, existing parent path/UUID, and target names; accepts 2–8 ordered steps.',
        z.object({ projectRoot, steps: workflowSteps }).strict(), 'workflow.plan',
        ({ projectRoot: selected, ...params }) => workflowParams(selected, params),
        { title: 'Plan a Creator 2.4 scene composition', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_workflow_execute',
        'Execute a planned Creator 2.4.15 multi-step scene composition with durable per-step operation receipts, editor instance checks, serialized-scene readback, and rollback on a definite partial failure. This writes the active scene; use a new workflowId for a new write.',
        z.object({ projectRoot, workflowId, steps: workflowSteps }).strict(), 'workflow.execute',
        ({ projectRoot: selected, ...params }) => workflowParams(selected, params),
        { title: 'Execute a Creator 2.4 scene composition', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });
    const workflowReceiptInput = z.object({ projectRoot, workflowId }).strict();
    register('cocos_2x_workflow_get',
        'Read one durable Creator 2.4.15 scene composition receipt by workflowId.',
        workflowReceiptInput, 'workflow.get', ({ projectRoot: selected, workflowId: selectedWorkflow }) => workflowParams(selected,
            { workflowId: selectedWorkflow }),
        { title: 'Read a Creator 2.4 scene composition receipt', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_workflow_compensate',
        'Reverse a fully resolved Creator 2.4.15 scene composition in reverse order. Uncertain steps remain needs-review and are not blindly removed.',
        workflowReceiptInput, 'workflow.compensate', ({ projectRoot: selected, workflowId: selectedWorkflow }) => workflowParams(selected,
            { workflowId: selectedWorkflow }),
        { title: 'Compensate a Creator 2.4 scene composition', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_workflow_replay',
        'Replay a fully compensated Creator 2.4.15 scene composition with a new workflowId and new per-step operation IDs. The replay is a fresh scene write.',
        z.object({ projectRoot, sourceWorkflowId: workflowId, workflowId }).strict(), 'workflow.replay',
        ({ projectRoot: selected, ...params }) => workflowParams(selected, params),
        { title: 'Replay a Creator 2.4 scene composition', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });

    const operationInput = z.object({ projectRoot, operationId: OPERATION_ID }).strict();
    register('cocos_2x_operation_get',
        'Read the durable CocosAgent receipt for a Creator 2.4.15 operation. Use this after reconnecting or when command.execute returned a non-final state.',
        operationInput, 'operation.get', ({ projectRoot: selected, operationId }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, operationId,
        }), { title: 'Read a Creator 2.4.15 operation receipt', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_operation_reconcile',
        'Reconcile an eligible interrupted Creator 2.4.15 scene operation using the existing instance and disk evidence. It does not repeat the editor write.',
        operationInput, 'operation.reconcile', ({ projectRoot: selected, operationId }) => ({
            targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION, operationId,
        }), { title: 'Reconcile a Creator 2.4.15 operation', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_operation_preview_accept',
        'Record visual acceptance for a Creator 2.4.15 scene operation only after inspecting that operation in its local Web preview. Evidence must include the exact local preview URL, observation time and a concise visible-result note.',
        z.object({ ...operationInput.shape, evidence: z.object({
            url: z.string().min(1).max(256),
            observedAt: z.string().min(1),
            note: z.string().min(1).max(500),
        }).strict() }).strict(), 'preview.accept', ({ projectRoot: selected, operationId, evidence }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, operationId, evidence,
        }), { title: 'Record scene preview acceptance', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

    const assetName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/);
    const pipelineIdInput = z.object({ projectRoot, pipelineId: OPERATION_ID }).strict();
    const resourceSceneSources = z.array(z.string().min(1).max(4096)).min(2).max(16)
        .refine((sources) => new Set(sources).size === sources.length, 'Source paths must be unique.');
    const resourceScenePositions = z.array(positionSchema()).min(2).max(16).optional();
    function resourceSceneParams(selected, params = {}) {
        return { targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params };
    }
    register('cocos_2x_assets_scene_plan',
        'Preflight importing 2–16 PNG files into Creator 2.4.15 and adding Sprite nodes under the active Canvas. Reads the selected scene and disk; does not import assets or save the scene.',
        z.object({ projectRoot, sources: resourceSceneSources, positions: resourceScenePositions }).strict(),
        'assets.scene.plan', ({ projectRoot: selected, ...params }) => resourceSceneParams(selected, params),
        { title: 'Plan a Creator 2.4 resource-to-scene operation', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_assets_scene_execute',
        'Import the planned PNG files through Creator AssetDB, verify their Texture/SpriteFrame UUIDs, create Canvas Sprite nodes, and read the saved scene back. This writes project assets and scene data; use the returned pipelineId for later acceptance or compensation.',
        z.object({ projectRoot, pipelineId: OPERATION_ID, sources: resourceSceneSources, positions: resourceScenePositions }).strict(),
        'assets.scene.execute', ({ projectRoot: selected, ...params }) => resourceSceneParams(selected, params),
        { title: 'Import PNGs and add them to a Creator 2.4 scene', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });
    register('cocos_2x_assets_scene_cancel',
        'Request cooperative cancellation of the active Creator 2.4.15 resource-to-scene execution for this pipeline. The current Host command is allowed to finish; the pipeline then stops at a safe write boundary and attempts to compensate its own scene and imported-asset changes. Read the final pipeline receipt to confirm the result.',
        pipelineIdInput, 'assets.scene.cancel', ({ projectRoot: selected, pipelineId }) => resourceSceneParams(selected, { pipelineId }),
        { title: 'Cancel a Creator 2.4 resource-to-scene operation', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_assets_scene_get',
        'Read a Creator 2.4 resource-to-scene pipeline receipt. A pending or completed preview phase may be refreshed from its child scene records.',
        pipelineIdInput, 'assets.scene.get', ({ projectRoot: selected, pipelineId }) => resourceSceneParams(selected, { pipelineId }),
        { title: 'Read a Creator 2.4 resource-to-scene receipt', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_assets_scene_preview_accept',
        'Record that one imported Sprite was visually inspected in its matching local Creator 2.4 Web preview. Supply the operationId returned for that pipeline item.',
        z.object({ ...pipelineIdInput.shape, operationId: OPERATION_ID, evidence: z.object({
            url: z.string().min(1).max(256), observedAt: z.string().min(1), note: z.string().min(1).max(500),
        }).strict() }).strict(), 'assets.scene.preview.accept',
        ({ projectRoot: selected, pipelineId, operationId, evidence }) => resourceSceneParams(selected, { pipelineId, operationId, evidence }),
        { title: 'Accept one resource-to-scene preview result', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_assets_scene_compensate',
        'Compensate a Creator 2.4 resource-to-scene pipeline. It removes the tracked scene references before asking AssetDB to remove only pipeline-owned assets whose UUIDs and serialized references still match.',
        pipelineIdInput, 'assets.scene.compensate', ({ projectRoot: selected, pipelineId }) => resourceSceneParams(selected, { pipelineId }),
        { title: 'Compensate a Creator 2.4 resource-to-scene operation', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_assets_scene_validate',
        'Read-only validation of PNG bytes, Creator meta UUID relationships, AssetDB mappings, active-scene Sprite references, serialized scene structure, and pipeline records.',
        z.object({ ...pipelineIdInput.shape, assetName: assetName.optional() }).strict(),
        'assets.scene.validate', ({ projectRoot: selected, pipelineId, assetName: selectedAsset }) => resourceSceneParams(selected,
            { pipelineId, ...(selectedAsset ? { assetName: selectedAsset } : {}) }),
        { title: 'Validate imported Creator 2.4 scene resources', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_assets_scene_repair',
        'Repair only the validated stale AssetDB URL mapping for a tracked Creator 2.4 pipeline asset. It may call Editor.assetdb.refresh and then verifies the same UUID and scene references; it never rewrites .meta.',
        z.object({ ...pipelineIdInput.shape, assetName, repairId: OPERATION_ID.optional() }).strict(),
        'assets.scene.repair', ({ projectRoot: selected, pipelineId, assetName: selectedAsset, repairId }) => resourceSceneParams(selected,
            { pipelineId, assetName: selectedAsset, ...(repairId ? { repairId } : {}) }),
        { title: 'Repair a stale Creator 2.4 AssetDB mapping', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

    const contentAssetId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
    const contentAssetName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i);
    const contentAssets = z.array(z.object({
        assetName: contentAssetName,
        id: contentAssetId,
        dependsOn: z.array(contentAssetId).max(64).refine((ids) => new Set(ids).size === ids.length, 'Dependency IDs must be unique.').optional(),
    }).strict()).min(1).max(16).refine((items) => new Set(items.map((item) => item.assetName.toLowerCase())).size === items.length
        && new Set(items.map((item) => item.id)).size === items.length, 'Asset names and IDs must be unique.');
    const contentFromSceneInput = z.object({
        projectRoot,
        pipelineId: OPERATION_ID,
        releaseId: RELEASE_ID,
        entryAssetName: contentAssetName,
        assets: contentAssets,
    }).strict();
    function contentFromSceneParams(selected, params) {
        return { targets: targetList, projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params };
    }
    register('cocos_2x_content_from_scene_plan',
        'Plan a built-in resources content release from a completed, preview-accepted Creator 2.4 scene pipeline. Revalidates imported UUIDs and serialized scene references; does not stage or select the release.',
        contentFromSceneInput, 'content.fromScene.plan', ({ projectRoot: selected, ...params }) => contentFromSceneParams(selected, params),
        { title: 'Plan content release from an accepted scene', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_content_from_scene_stage',
        'Stage an immutable Creator 2.4 built-in resources release derived from a completed, preview-accepted scene pipeline. This writes a local release record but does not change the selected release or build output.',
        contentFromSceneInput, 'content.fromScene.stage', ({ projectRoot: selected, ...params }) => contentFromSceneParams(selected, params),
        { title: 'Stage content release from an accepted scene', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

    const contentBundleInput = z.object({
        projectRoot,
        releaseId: RELEASE_ID,
        bundleRoot: z.string().regex(/^assets\/[A-Za-z0-9_-]{1,64}$/),
        bundleName: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
        entryAssetName: contentAssetName,
        assets: contentAssets,
    }).strict();
    register('cocos_2x_content_bundle_plan',
        'Plan a Creator 2.4 Asset Bundle release from already imported PNG assets in one local Bundle folder. Reads folder and asset .meta UUIDs and source digests; does not write a release record or build output.',
        contentBundleInput, 'content.bundle.plan', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Plan a Creator 2.4 Asset Bundle release', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_content_bundle_stage',
        'Stage an immutable Creator 2.4 Asset Bundle release after revalidating its local Bundle folder, PNG bytes, Texture/SpriteFrame UUIDs and dependency list. This writes a Host release record only.',
        contentBundleInput, 'content.bundle.stage', ({ projectRoot: selected, ...params }) => ({
            projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params,
        }), { title: 'Stage a Creator 2.4 Asset Bundle release', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

    register('cocos_2x_content_get',
        'Read the selected/effective content pointers, or one immutable staged Creator 2.4 release.',
        z.object({ projectRoot, releaseId: RELEASE_ID.optional() }).strict(), 'content.get',
        ({ projectRoot: selected, releaseId }) => ({ projectRoot: selected, creatorVersion: CREATOR_VERSION, ...(releaseId ? { releaseId } : {}) }),
        { title: 'Read a Creator 2.4 content release', readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    register('cocos_2x_content_select',
        'Select an existing immutable Creator 2.4 release using compare-and-set on the expected current release. This changes only the local Host pointer; the runtime must separately report application.',
        z.object({ projectRoot, releaseId: RELEASE_ID, expectedCurrent: RELEASE_ID.nullable() }).strict(), 'content.select',
        ({ projectRoot: selected, ...params }) => ({ projectRoot: selected, creatorVersion: CREATOR_VERSION, ...params }),
        { title: 'Select a Creator 2.4 content release', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    register('cocos_2x_content_rollback',
        'Select the previous release only if it is still the expected current release. This changes the Host pointer; inspect the runtime receipt afterward.',
        z.object({ projectRoot, expectedCurrent: RELEASE_ID }).strict(), 'content.rollback',
        ({ projectRoot: selected, expectedCurrent }) => ({ projectRoot: selected, creatorVersion: CREATOR_VERSION, expectedCurrent }),
        { title: 'Roll back the selected Creator 2.4 content release', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

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

export { COMMANDS_2X, CREATOR_VERSION, createServer, parseArgs, runAgentWorker };
