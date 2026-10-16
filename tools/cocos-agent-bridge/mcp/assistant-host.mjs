import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, writeEvent } from './deepseek-agent.mjs';
import { parseStructuredPlan } from './structured-plan.mjs';
import { beginPlanStep, createPlan, finishPlanStep, hasPlanSetupReceipts, planView, planAcceptanceContext } from './assistant-plan-service.mjs';
import { AssistantStateStore } from './assistant-state-store.mjs';
import { AssistantMemoryFileStore } from './assistant-memory-store.mjs';
import { AssistantToolResultArchive } from './assistant-tool-result-archive.mjs';
import { AssistantTaskStore } from './assistant-task-store.mjs';
import { AssistantRecoveryStore } from './assistant-recovery-store.mjs';
import { formatCreatorProjectContext, normalizeCreatorProjectContext } from './assistant-project-context.mjs';
import { persistentSummaryMessage, prepareConversationForTurn } from './assistant-conversation-summary.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = process.env.COCOS_AGENT_RUNTIME_ROOT
    ? path.resolve(process.env.COCOS_AGENT_RUNTIME_ROOT)
    : path.resolve(SCRIPT_DIR, '../../..');
const MCP_SERVER = path.join(SCRIPT_DIR, 'mcp-server.mjs');
const AGENT_SKILL = path.join(REPOSITORY_ROOT, 'plugins/cocos-agent-2x/skills/cocos-agent/SKILL.md');
const MODE_NAMES = new Set(['Ask', 'Plan', 'Agent']);
const MAX_MESSAGE_LENGTH = 8000;
const MAX_HISTORY = 24;
const APPROVAL_TIMEOUT_MS = 120_000;
const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require('../vendor/ws');

async function runTypeScriptReadOnly({ client, task, projectRoot, skillFiles, tracePath, apiKey, model, mode, history,
    projectContext, signal, onEvent, memoryStore }) {
    const runtimeUrl = pathToFileURL(path.join(REPOSITORY_ROOT, 'tools/cocos-agent-runtime/dist/index.js')).href;
    const runtime = await import(runtimeUrl);
    const legacyAdapter = await import('./deepseek-agent.mjs');
    return runtime.runCreatorReadOnly({
        client, task, projectRoot, skillFiles, tracePath, apiKey, model, mode, history,
        projectContext, signal, onEvent,
        toolResultArchive: new AssistantToolResultArchive(tracePath),
        skillAdapter: legacyAdapter,
        formatProjectContext: formatCreatorProjectContext,
        writeEvent,
        projectMemory: { projectKey: memoryStore.projectKey, persistence: memoryStore },
    });
}

async function runTypeScriptAgent({ client, task, projectRoot, skillFiles, tracePath, apiKey, model, history,
    projectContext, signal, onEvent, approveWrite, memoryStore, taskStore, planAcceptance, recoveryStore }) {
    const runtimeUrl = pathToFileURL(path.join(REPOSITORY_ROOT, 'tools/cocos-agent-runtime/dist/index.js')).href;
    const runtime = await import(runtimeUrl);
    const legacyAdapter = await import('./deepseek-agent.mjs');
    return runtime.runCreatorAgent({
        client, task, projectRoot, skillFiles, tracePath, apiKey, model, mode: 'Agent', history,
        projectContext, signal, onEvent, approveWrite, recoveryStore,
        toolResultArchive: new AssistantToolResultArchive(tracePath),
        skillAdapter: legacyAdapter,
        formatProjectContext: formatCreatorProjectContext,
        writeEvent,
        projectMemory: { projectKey: memoryStore.projectKey, persistence: memoryStore },
        taskPersistence: taskStore,
        ...(planAcceptance ? { planAcceptance } : {}),
    });
}

function parseArgs(argv) {
    const options = { project: null, model: DEFAULT_MODEL };
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === '--project' && argv[index + 1]) options.project = argv[++index];
        else if (argv[index] === '--model' && argv[index + 1]) options.model = argv[++index];
        else throw new Error(`Unknown or incomplete option: ${argv[index]}`);
    }
    if (!options.project || !path.isAbsolute(options.project)) throw new Error('Pass one absolute --project Creator 2.4.15 path.');
    options.project = fs.realpathSync(options.project);
    if (!['deepseek-flash', 'deepseek-v4-pro'].includes(options.model)) throw new Error('Unsupported DeepSeek model.');
    return options;
}

export function projectContextMatchesProject(context, projectRoot) {
    if (context === undefined) return true;
    if (!normalizeCreatorProjectContext(context) || typeof context.projectRoot !== 'string' || !path.isAbsolute(context.projectRoot)) return false;
    try { return fs.realpathSync(context.projectRoot) === projectRoot; }
    catch (_) { return false; }
}

export function finalizePlanResult(result, { conversationId, userTask }) {
    if (result.status !== 'completed') return { result, plan: null };
    if (!hasPlanSetupReceipts(result.receipts)) {
        return { result: { ...result, status: 'failed', reason: 'plan-preflight-missing',
            finalText: '无法生成计划：尚未取得本轮 Creator 就绪实例和能力目录回执。项目未修改。' }, plan: null };
    }
    let plan;
    try {
        plan = createPlan({ conversationId, userTask,
            data: parseStructuredPlan(result.finalText, { availableToolNames: result.availableToolNames }) });
    } catch (error) {
        return { result: { ...result, status: 'failed', reason: 'plan-validation-failed',
            finalText: `计划没有通过结构校验（${String(error.message || error).slice(0, 300)}）。项目未修改；请重新生成计划。` }, plan: null };
    }
    return { result: { ...result, reason: 'plan-generated',
        finalText: `已生成 ${plan.steps.length} 步计划「${plan.title}」。请先检查每一步，再选择开始。计划内容本身不会修改项目。` }, plan };
}

function traceDirectory() {
    const userStateRoot = process.env.LOCALAPPDATA || process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    const directory = path.join(userStateRoot, 'CocosAgent', 'agent-runs');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    return directory;
}

function traceFile(projectRoot) {
    return path.join(traceDirectory(), `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}.jsonl`);
}

function supportSafeValue(value, depth = 0) {
    if (depth > 10) return null;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value
        .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
        .replace(/\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi, 'Bearer [REDACTED]')
        .replace(/((?:api[\s_-]?key|authorization|access[\s_-]?token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
        .slice(0, 100000);
    if (Array.isArray(value)) return value.slice(0, 200).map((item) => supportSafeValue(item, depth + 1));
    if (typeof value !== 'object') return null;
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 256)) {
        if (/(?:api.?key|authorization|secret|password|credential|token|imageDataUrl|dataBase64|screenshot)/i.test(key)) continue;
        output[key.slice(0, 120)] = supportSafeValue(item, depth + 1);
    }
    return output;
}

function readTraceForSupport(tracePath, remainingBytes) {
    try {
        const allowedRoot = fs.realpathSync(traceDirectory());
        const canonicalPath = fs.realpathSync(tracePath);
        const relative = path.relative(allowedRoot, canonicalPath);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(canonicalPath) !== '.jsonl') return null;
        const stat = fs.statSync(canonicalPath);
        if (!stat.isFile() || stat.size > 512000 || stat.size > remainingBytes) return { file: path.basename(canonicalPath), omitted: 'trace_size_limit' };
        const events = [];
        for (const line of fs.readFileSync(canonicalPath, 'utf8').split(/\r?\n/)) {
            if (!line.trim()) continue;
            try { events.push(supportSafeValue(JSON.parse(line))); }
            catch (_) { events.push({ event: 'unparseable_trace_line', text: line.slice(0, 1000) }); }
        }
        return { file: path.basename(canonicalPath), events };
    } catch (_) { return null; }
}

function send(socket, message) {
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function compactResult(result) {
    const structured = result?.structuredContent;
    if (structured && typeof structured === 'object') {
        const compact = {
            success: structured.success,
            outcome: structured.outcome,
            status: structured.status,
            operationId: structured.operationId,
            command: structured.command,
            error: structured.error ? { code: structured.error.code, message: structured.error.message } : undefined,
            phases: structured.phases,
            reconciliation: structured.reconciliation ? { disposition: structured.reconciliation.disposition } : undefined,
        };
        for (const key of ['packageName', 'packageVersion', 'packageFingerprint', 'skillsIndexSha256',
            'skillName', 'referenceId', 'uri', 'sha256', 'mimeType', 'byteLength', 'memoryId', 'revision', 'deletedRevision']) {
            if (structured[key] !== undefined) compact[key] = structured[key];
        }
        const compactMemory = (memory) => memory && typeof memory === 'object' ? {
            id: memory.id, revision: memory.revision, title: memory.title, body: memory.body,
            category: memory.category, sources: Array.isArray(memory.sources) ? memory.sources.slice(0, 8) : [],
            createdAt: memory.createdAt, updatedAt: memory.updatedAt,
            history: Array.isArray(memory.history) ? memory.history.slice(-10) : [],
        } : undefined;
        if (structured.memory) compact.memory = compactMemory(structured.memory);
        if (structured.operation) compact.operation = structured.operation;
        if (structured.tombstone) compact.tombstone = structured.tombstone;
        if (structured.data?.memory) compact.data = { memory: compactMemory(structured.data.memory) };
        if (Array.isArray(structured.data?.memories)) {
            compact.data = { memories: structured.data.memories.slice(0, 8).map(compactMemory) };
        }
        if (structured.scene) compact.scene = structured.scene;
        if (structured.runtime) compact.runtime = structured.runtime;
        if (structured.diagnostics) compact.diagnostics = structured.diagnostics;
        if (structured.targetNode) compact.targetNode = structured.targetNode;
        if (structured.targetNodeStatus) compact.targetNodeStatus = structured.targetNodeStatus;
        if (structured.screenshot) compact.screenshot = structured.screenshot;
        const expectedDiff = structured.expectedDiff || structured.result?.expectedDiff || structured.result?.diff;
        if (expectedDiff !== undefined) compact.expectedDiff = expectedDiff;
        const image = (result?.content || []).find((item) => item?.type === 'image'
            && item.mimeType === 'image/jpeg' && typeof item.data === 'string'
            && item.data.length <= 2 * 1024 * 1024 * 4 / 3 + 8);
        if (image) compact.imageDataUrl = `data:${image.mimeType};base64,${image.data}`;
        if (Array.isArray(structured.data?.skills)) {
            compact.skills = structured.data.skills.map((skill) => ({ name: skill.name, sha256: skill.sha256,
                referenceIds: (skill.references || []).map((reference) => reference.id) }));
            compact.skillsIndexSha256 = structured.data.skillsIndexSha256;
            compact.packageVersion = structured.data.packageVersion;
            compact.packageFingerprint = structured.data.packageFingerprint;
        }
        const script = structured.result;
        if (structured.command?.startsWith('script.') && script) {
            compact.script = { scriptPath: script.scriptPath || script.record?.scriptPath,
                scriptUuid: script.scriptUuid || script.record?.scriptUuid, sourceSha256: script.sourceSha256,
                expectedDiff: script.expectedDiff, afterSha256: script.afterSha256,
                state: script.record?.state, compilation: script.record?.compilation, runtime: script.record?.runtime, current: script.current };
        }
        return compact;
    }
    const text = (result?.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
    return { text: text.slice(0, 4000) };
}

function compactReceipt(receipt) {
    const result = receipt?.result || receipt;
    return {
        name: receipt?.name,
        callId: receipt?.callId,
        access: receipt?.access,
        isError: result?.isError === true,
        ...compactResult(result),
    };
}

async function readRecoveryReceipt(client, projectRoot, toolName, operationId, memoryStore = null) {
    if (!path.isAbsolute(projectRoot) || typeof operationId !== 'string' || !operationId || operationId.length > 200) {
        throw new Error('RECOVERY_REQUEST_INVALID');
    }
    if (toolName === 'cocos_2x_memory_operation_get') {
        if (!memoryStore || memoryStore.projectKey !== crypto.createHash('sha256').update(fs.realpathSync(projectRoot)).digest('hex')) {
            throw new Error('MEMORY_RECOVERY_PROJECT_MISMATCH');
        }
        const snapshot = await memoryStore.load();
        const operation = snapshot?.operations?.find((item) => item.operationId === operationId);
        if (!operation) return { success: true, operationId, outcome: 'no-effect', status: 'no-effect',
            reconciliation: { disposition: 'not-recorded' } };
        const memory = snapshot.memories.find((item) => item.id === operation.memoryId);
        const tombstone = snapshot.tombstones.find((item) => item.operationId === operationId);
        return { success: true, operationId, outcome: operation.outcome, status: operation.outcome,
            operation, ...(memory ? { memory } : {}), ...(tombstone ? { tombstone } : {}) };
    }
    if (!/^[0-9a-f-]{36}$/i.test(operationId)
        || !['cocos_2x_operation_get', 'cocos_2x_script_operation_get'].includes(toolName)) {
        throw new Error('RECOVERY_REQUEST_INVALID');
    }
    const listed = await client.callTool({ name: 'cocos_2x_instances_list', arguments: {} });
    const instances = listed?.structuredContent?.data;
    const matches = Array.isArray(instances) ? instances.filter((instance) => instance.projectRoot === projectRoot) : [];
    const selected = matches.length === 1 ? matches[0] : null;
    if (listed?.structuredContent?.success !== true || !selected
        || selected.creatorVersion !== '2.4.15' || selected.state !== 'ready') {
        throw new Error('RECOVERY_INSTANCE_NOT_READY');
    }
    const catalog = await client.callTool({ name: 'cocos_2x_capabilities_list', arguments: { projectRoot } });
    const catalogData = catalog?.structuredContent?.data;
    const exactInstance = catalogData?.instance;
    // Scene operation.get is a Host-side ledger reader, not a Creator command.
    // Script operation.get is implemented by the Creator extension and must
    // still be advertised as available by the selected live instance.
    const requiredCommand = toolName === 'cocos_2x_script_operation_get' ? 'script.operation.get' : null;
    const capability = requiredCommand
        ? catalogData?.commands?.find((item) => item.id === requiredCommand)
        : null;
    if (catalog?.structuredContent?.success !== true || exactInstance?.projectRoot !== projectRoot
        || exactInstance.creatorVersion !== '2.4.15' || exactInstance.state !== 'ready'
        || (requiredCommand && (!capability || capability.status !== 'available'))) {
        throw new Error('RECOVERY_CAPABILITY_NOT_AVAILABLE');
    }
    const args = toolName === 'cocos_2x_script_operation_get'
        ? { operationId } : { projectRoot, operationId };
    return compactResult(await client.callTool({ name: toolName, arguments: args }));
}

function assistantAnswer(result, mode) {
    if (result.status === 'cancelled') {
        const hasWrite = (result.receipts || []).some((receipt) => receipt.access !== 'read');
        return hasWrite
            ? '任务已取消。已完成或结果未定的写入会保留在下方副作用记录中；请先只读核对对应操作回执，再决定是否继续或补偿。取消本身不会回滚修改。'
            : '任务已取消；本轮没有执行写入。';
    }
    if (mode === 'Agent' && result.reason === 'model_final_without_success_receipt') {
        return '任务未确认完成：本轮没有取得有效的任务操作回执。模型的完成声明未通过校验；请查询操作记录或继续执行。';
    }
    const pendingScript = (result.receipts || []).some((receipt) => receipt.result?.structuredContent?.outcome === 'needs-runtime');
    if (mode === 'Agent' && pendingScript) return `${result.finalText || '脚本修改已取得编译回执。'}\n\n验收边界：本轮工具只证明源码读回和 Creator 编译，按钮点击等功能仍须实际预览验证。`;
    let finalText = result.finalText || (result.status === 'awaiting-approval'
        ? '操作未获批准，项目没有执行这一步修改。'
        : `任务已停止：${result.reason || result.status}`);
    const receipts = Array.isArray(result.receipts) ? result.receipts : [];
    const ranRequiredPreflight = receipts.some((receipt) => ['cocos_2x_instances_list', 'cocos_2x_capabilities_list'].includes(receipt.name));
    if (ranRequiredPreflight) {
        const inspectedProject = receipts.some((receipt) => receipt.access === 'read'
            && !['cocos_2x_instances_list', 'cocos_2x_capabilities_list'].includes(receipt.name)
            && !['cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read'].includes(receipt.name));
        const wroteProject = receipts.some((receipt) => receipt.access !== 'read');
        const correction = !inspectedProject && !wroteProject
            ? '本次没有读取项目内容或进行写入；Host 执行了只读实例/能力预检。'
            : '本次实际工具调用及回执已记录在运行轨迹中；以上说明应以该轨迹为准。';
        if (!inspectedProject && !wroteProject) {
            const closingClaim = /(?:按你的要求|根据你的要求|As requested|At your request)[\s\S]*$/i;
            finalText = closingClaim.test(finalText)
                ? finalText.replace(closingClaim, correction)
                : finalText.replace(/(?:本次)?(?:我)?(?:没有|未)(?:调用|使用)任何\s*Creator\s*工具[。.!]?|(?:I did not|I did not use|I did not call) any Creator tools/gi, correction);
        } else {
            finalText = finalText.replace(/(?:本次)?(?:我)?(?:没有|未)(?:调用|使用)任何\s*Creator\s*工具[。.!]?|(?:I did not|I did not use|I did not call) any Creator tools/gi, correction);
        }
    }
    return finalText;
}

async function start(options) {
    if (Number.parseInt(process.versions.node.split('.')[0], 10) < 20) {
        throw new Error('Node.js 20 or newer is required for the in-editor Assistant.');
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (typeof apiKey !== 'string' || apiKey.trim().length < 8) throw new Error('Set DEEPSEEK_API_KEY in the assistant process environment.');

    const stateStore = new AssistantStateStore(options.project);
    const memoryStore = new AssistantMemoryFileStore(options.project);
    const taskStore = new AssistantTaskStore(options.project);
    const restoredState = stateStore.load();
    const conversations = new Map(restoredState.conversations.map((entry) => [entry.id, entry.messages]));
    const conversationSummaries = new Map(restoredState.conversations
        .filter((entry) => entry.summary?.content).map((entry) => [entry.id, entry.summary]));
    const plans = new Map(restoredState.plans.map((plan) => [plan.id, plan]));
    const recentRuns = restoredState.runs;
    const recoveryStore = new AssistantRecoveryStore(options.project);
    await recoveryStore.migrateRuns(recentRuns);

    const childEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^DEEPSEEK_/i.test(name)));
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [MCP_SERVER, '--project', options.project],
        cwd: SCRIPT_DIR,
        env: childEnv,
    });
    const client = new Client({ name: 'cocos-agent-in-editor-assistant', version: '0.1.0' });
    await client.connect(transport);

    const token = crypto.randomBytes(32).toString('hex');
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 16 * 1024 });
    const pendingApprovals = new Map();
    let activeRunState = null;
    const persistState = () => stateStore.save({
        conversations: [...conversations].map(([id, messages]) => ({ id, messages,
            ...(conversationSummaries.has(id) ? { summary: conversationSummaries.get(id) } : {}) })),
        plans: [...plans.values()], runs: recentRuns,
    });
    const appendRun = (run) => {
        const index = recentRuns.findIndex((item) => item.id === run.id);
        if (index >= 0) recentRuns.splice(index, 1);
        recentRuns.push(run);
        if (recentRuns.length > 24) recentRuns.splice(0, recentRuns.length - 24);
        persistState();
    };

    wss.on('connection', (socket, request) => {
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
            || request.url !== `/assistant/${token}`) {
            socket.close(1008, 'Unauthorized');
            return;
        }
        send(socket, { type: 'connected', creatorVersion: '2.4.15', model: options.model, baseUrl: DEFAULT_BASE_URL });

        socket.on('message', async (buffer) => {
            let message;
            try {
                if (buffer.length > 16 * 1024) return;
                message = JSON.parse(buffer.toString());
            } catch (_) { return; }

            if (message?.type === 'resume' && typeof message.conversationId === 'string' && message.conversationId.length <= 80) {
                send(socket, { type: 'conversation', conversationId: message.conversationId,
                    messages: conversations.get(message.conversationId) || [],
                    plans: [...plans.values()].filter((plan) => plan.conversationId === message.conversationId).map(planView),
                    recentRuns: recentRuns.filter((run) => run.conversationId === message.conversationId).slice(-12) });
                return;
            }
            if (message?.type === 'conversation.export' && typeof message.conversationId === 'string'
                && message.conversationId.length > 0 && message.conversationId.length <= 80
                && typeof message.requestId === 'string' && message.requestId.length <= 80) {
                const runs = recentRuns.filter((run) => run.conversationId === message.conversationId).slice(-12);
                let remainingBytes = 512000;
                const traces = [];
                for (const run of runs) {
                    if (typeof run.tracePath !== 'string') continue;
                    const trace = readTraceForSupport(run.tracePath, remainingBytes);
                    if (!trace) continue;
                    traces.push({ runId: run.id, ...trace });
                    remainingBytes -= Buffer.byteLength(JSON.stringify(trace), 'utf8');
                    if (remainingBytes <= 0) break;
                }
                const exportRuns = runs.map((run) => {
                    const copy = { ...run };
                    delete copy.tracePath;
                    return supportSafeValue(copy);
                });
                send(socket, { type: 'conversation.exported', requestId: message.requestId,
                    conversationId: message.conversationId,
                    messages: supportSafeValue(conversations.get(message.conversationId) || []),
                    plans: [...plans.values()].filter((plan) => plan.conversationId === message.conversationId)
                        .slice(-12).map((plan) => supportSafeValue(planView(plan))),
                    runs: exportRuns, traces });
                return;
            }
            if (message?.type === 'conversation.clear' && typeof message.conversationId === 'string'
                && message.conversationId.length > 0 && message.conversationId.length <= 80) {
                if (activeRunState) {
                    send(socket, { type: 'conversation.cleared', conversationId: message.conversationId,
                        error: '当前有任务正在执行，请结束任务后再清空。' });
                    return;
                }
                const previousMessages = conversations.get(message.conversationId);
                const previousSummary = conversationSummaries.get(message.conversationId);
                conversations.delete(message.conversationId);
                conversationSummaries.delete(message.conversationId);
                try {
                    persistState();
                    send(socket, { type: 'conversation.cleared', conversationId: message.conversationId });
                } catch (_) {
                    if (previousMessages) conversations.set(message.conversationId, previousMessages);
                    if (previousSummary) conversationSummaries.set(message.conversationId, previousSummary);
                    send(socket, { type: 'conversation.cleared', conversationId: message.conversationId,
                        error: '本机聊天记录未能保存变更，请稍后重试。' });
                }
                return;
            }
            if (message?.type === 'run.cancel' && typeof message.requestId === 'string') {
                const active = activeRunState;
                if (!active || active.requestId !== message.requestId || active.socket !== socket) {
                    send(socket, { type: 'run.cancel.rejected', requestId: message.requestId, reason: 'run_not_active' });
                    return;
                }
                if (!active.cancelRequested) {
                    active.cancelRequested = true;
                    active.controller.abort();
                    for (const [approvalId, pending] of pendingApprovals) {
                        if (pending.requestId !== active.requestId) continue;
                        clearTimeout(pending.timer);
                        pendingApprovals.delete(approvalId);
                        pending.resolve(false);
                    }
                    if (active.runRecord) {
                        active.runRecord.status = 'running';
                        active.runRecord.reason = 'cancellation_requested';
                        active.runRecord.updatedAt = new Date().toISOString();
                        try { appendRun(active.runRecord); }
                        catch (_) { send(socket, { type: 'run.persistence-error', requestId: active.requestId }); }
                    }
                    send(socket, { type: 'run.cancelling', requestId: active.requestId,
                        message: active.activeTool?.access === 'write-approved'
                            ? '已请求停止；当前编辑器命令会先完成并读回回执，之后不再发起新命令。'
                            : '已请求停止当前模型请求；不会发起后续工具调用。' });
                }
                return;
            }
            if (message?.type === 'run.recover' && typeof message.runId === 'string' && typeof message.operationId === 'string') {
                if (activeRunState) {
                    send(socket, { type: 'run.recovery.result', runId: message.runId, operationId: message.operationId,
                        error: '当前任务尚未结束；请等待写入回执返回后再核对历史操作。' });
                    return;
                }
                const run = recentRuns.find((item) => item.id === message.runId
                    && item.conversationId === message.conversationId
                    && ((item.receipts || []).some((receipt) => receipt.operationId === message.operationId)
                        || item.activeTool?.operationId === message.operationId));
                const writeReceipt = run?.receipts?.find((receipt) => receipt.operationId === message.operationId)
                    || run?.activeTool;
                const memoryOperation = writeReceipt?.toolName?.startsWith('cocos_2x_memory_')
                    && writeReceipt?.access !== 'read';
                if (!run || (!memoryOperation && !/^[0-9a-f-]{36}$/i.test(message.operationId))
                    || (memoryOperation && message.operationId.length > 200)) {
                    send(socket, { type: 'run.recovery.result', runId: message.runId, operationId: message.operationId,
                        error: '没有找到与当前会话匹配的已记录操作 ID。' });
                    return;
                }
                const toolName = memoryOperation ? 'cocos_2x_memory_operation_get'
                    : writeReceipt?.toolName === 'cocos_2x_script_patch'
                    || writeReceipt?.command?.startsWith('script.') ? 'cocos_2x_script_operation_get' : 'cocos_2x_operation_get';
                void (async () => {
                    const receipt = await readRecoveryReceipt(client, options.project, toolName, message.operationId, memoryStore);
                    const pending = await recoveryStore.load();
                    const runtime = await import(pathToFileURL(path.join(REPOSITORY_ROOT, 'tools/cocos-agent-runtime/dist/index.js')).href);
                    if (pending.pending?.field === 'operationId' && pending.pending.value === message.operationId
                        && runtime.creatorRecoveryResolved({ structuredContent: receipt }) && receipt.operationId === message.operationId) {
                        await recoveryStore.save(null, pending.revision);
                    }
                    run.recovery = { operationId: message.operationId, checkedAt: new Date().toISOString(), receipt };
                    run.updatedAt = run.recovery.checkedAt;
                    appendRun(run);
                    send(socket, { type: 'run.recovery.result', runId: message.runId, operationId: message.operationId, receipt });
                })().catch((error) => send(socket, { type: 'run.recovery.result', runId: message.runId,
                    operationId: message.operationId, error: String(error?.message || error).slice(0, 500) }));
                return;
            }
            if (message?.type === 'approval' && typeof message.approvalId === 'string' && typeof message.approved === 'boolean') {
                const pending = pendingApprovals.get(message.approvalId);
                if (pending && pending.socket === socket) {
                    clearTimeout(pending.timer);
                    pendingApprovals.delete(message.approvalId);
                    pending.resolve(message.approved);
                }
                return;
            }
            const planExecutionRequested = message?.planExecution !== undefined;
            if (message?.type !== 'run' || activeRunState || typeof message.requestId !== 'string' || message.requestId.length > 80
                || typeof message.conversationId !== 'string' || message.conversationId.length > 80
                || !MODE_NAMES.has(message.mode)
                || !projectContextMatchesProject(message.projectContext, options.project)
                || (planExecutionRequested
                    ? (message.mode !== 'Agent' || !message.planExecution || typeof message.planExecution.planId !== 'string'
                        || !Number.isInteger(message.planExecution.stepIndex))
                    : (typeof message.text !== 'string' || !message.text.trim() || message.text.length > MAX_MESSAGE_LENGTH))) {
                if (message?.type === 'run') send(socket, { type: 'run.rejected', requestId: message.requestId || null,
                    reason: activeRunState ? 'assistant_busy' : 'invalid_request' });
                return;
            }

            let activePlan = null;
            let approvedPlanAcceptance = null;
            let taskText = planExecutionRequested ? '' : message.text.trim();
            if (planExecutionRequested) {
                activePlan = plans.get(message.planExecution.planId) || null;
                try {
                    taskText = beginPlanStep(activePlan, { conversationId: message.conversationId,
                        planId: message.planExecution.planId, stepIndex: message.planExecution.stepIndex });
                    approvedPlanAcceptance = planAcceptanceContext(activePlan);
                } catch (error) {
                    send(socket, { type: 'run.rejected', requestId: message.requestId, reason: error.message });
                    return;
                }
            }

            const active = { requestId: message.requestId, socket, controller: new AbortController(),
                cancelRequested: false, activeTool: null, runRecord: null };
            activeRunState = active;
            const previousConversation = conversations.get(message.conversationId) || [];
            const previousSummary = conversationSummaries.get(message.conversationId) || null;
            let preparedConversation;
            try {
                preparedConversation = await prepareConversationForTurn({
                    messages: previousConversation,
                    summary: previousSummary,
                    task: taskText,
                    signal: active.controller.signal,
                    maxMessages: MAX_HISTORY,
                    summarize: async ({ task, dialogue, signal }) => {
                        const runtimeUrl = pathToFileURL(path.join(REPOSITORY_ROOT, 'tools/cocos-agent-runtime/dist/index.js')).href;
                        const runtime = await import(runtimeUrl);
                        const provider = new runtime.DeepSeekProvider({ apiKey, model: options.model });
                        return provider.summarizeContext({ task, dialogue, signal });
                    },
                });
            } catch (error) {
                if (activeRunState === active) activeRunState = null;
                send(socket, { type: 'run.failed', requestId: message.requestId,
                    message: `无法准备持久会话摘要，任务未发送：${String(error?.message || error).slice(0, 300)}` });
                return;
            }
            const conversation = preparedConversation.messages;
            conversations.set(message.conversationId, conversation);
            if (preparedConversation.summary) conversationSummaries.set(message.conversationId, preparedConversation.summary);
            const history = preparedConversation.history;
            const summaryMessage = persistentSummaryMessage(preparedConversation.summary);
            const modelHistory = [...(summaryMessage ? [summaryMessage] : []), ...history];
            const runRecord = { id: message.requestId, conversationId: message.conversationId,
                planId: activePlan?.id, task: taskText.slice(0, MAX_MESSAGE_LENGTH), mode: message.mode,
                status: 'running', reason: null, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                activeTool: null, receipts: [], executionChecklist: [] };
            active.runRecord = runRecord;
            try { appendRun(runRecord); }
            catch (error) {
                if (previousConversation.length) conversations.set(message.conversationId, previousConversation);
                else conversations.delete(message.conversationId);
                if (previousSummary) conversationSummaries.set(message.conversationId, previousSummary);
                else conversationSummaries.delete(message.conversationId);
                const failedRunIndex = recentRuns.findIndex((item) => item.id === runRecord.id);
                if (failedRunIndex >= 0) recentRuns.splice(failedRunIndex, 1);
                if (activeRunState === active) activeRunState = null;
                send(socket, { type: 'run.failed', requestId: message.requestId,
                    message: `无法保存 Agent 会话状态，任务未发送：${String(error?.message || error).slice(0, 300)}` });
                return;
            }
            send(socket, { type: 'run.started', requestId: message.requestId, mode: message.mode });

            const approveWrite = (tool, args) => new Promise((resolve) => {
                if (socket.readyState !== 1) { resolve(false); return; }
                const approvalId = crypto.randomUUID();
                const timer = setTimeout(() => {
                    pendingApprovals.delete(approvalId);
                    resolve(false);
                }, APPROVAL_TIMEOUT_MS);
                pendingApprovals.set(approvalId, { socket, requestId: message.requestId, resolve, timer });
                send(socket, { type: 'approval.required', requestId: message.requestId, approvalId,
                    toolName: tool.name, arguments: args, timeoutMs: APPROVAL_TIMEOUT_MS });
            });

            const runTracePath = traceFile(options.project);
            runRecord.tracePath = runTracePath;
            try { appendRun(runRecord); } catch (_) { delete runRecord.tracePath; }
            const onAgentEvent = (event) => {
                    if (event.type === 'task.intent') {
                        // Persist the validated interpretation as a display-only proposal, never as approval or task evidence.
                        runRecord.taskIntent = {
                            kind: event.kind,
                            targets: Array.isArray(event.targets) ? event.targets.slice(0, 16) : [],
                            reads: Array.isArray(event.reads) ? event.reads.slice(0, 16) : [],
                            verification: event.verification,
                        };
                        runRecord.updatedAt = new Date().toISOString();
                        try { appendRun(runRecord); }
                        catch (_) {
                            active.persistenceError = true;
                            active.controller.abort();
                            send(socket, { type: 'run.persistence-error', requestId: message.requestId });
                        }
                        send(socket, { ...event, requestId: message.requestId });
                        return;
                    }
                    if (event.type === 'run.finished') {
                        runRecord.executionChecklist = Array.isArray(event.executionChecklist) ? event.executionChecklist : [];
                        runRecord.updatedAt = new Date().toISOString();
                        try { appendRun(runRecord); } catch (_) {}
                        send(socket, { ...event, requestId: message.requestId });
                        return;
                    }
                    if (event.type.startsWith('run.')) return;
                    if (event.type === 'todo.updated') {
                        runRecord.executionChecklist = Array.isArray(event.items) ? event.items : [];
                        runRecord.updatedAt = new Date().toISOString();
                        try { appendRun(runRecord); }
                        catch (_) {
                            active.persistenceError = true;
                            active.controller.abort();
                            send(socket, { type: 'run.persistence-error', requestId: message.requestId });
                        }
                        send(socket, { ...event, requestId: message.requestId });
                        return;
                    }
                    if (event.type === 'goal.evaluated') {
                        runRecord.goalEvaluation = { taskId: event.taskId, satisfied: event.satisfied,
                            outstanding: event.outstanding, continuationAttempt: event.continuationAttempt,
                            maxContinuationAttempts: event.maxContinuationAttempts };
                    }
                    if (event.type === 'tool.finished') event.result = compactResult(event.result);
                    if (event.type === 'run.finished' && Array.isArray(event.receipts)) {
                        event.receipts = event.receipts.map(compactReceipt);
                    }
                    if (event.type === 'tool.started') {
                        const memoryWrite = event.access === 'write' && String(event.toolName || '').startsWith('cocos_2x_memory_');
                        active.activeTool = { toolName: event.toolName, command: event.command,
                            operationId: event.operationId || (memoryWrite ? event.callId : undefined),
                            access: event.access || 'unknown', callId: event.callId };
                        runRecord.activeTool = active.activeTool;
                    } else if (event.type === 'tool.finished') {
                        const result = event.result || {};
                        const receipt = { toolName: event.toolName, callId: event.callId,
                            access: active.activeTool?.callId === event.callId ? active.activeTool.access : 'unknown',
                            success: result.success, outcome: result.outcome, operationId: result.operationId,
                            command: result.command, errorCode: result.error?.code,
                            sideEffect: result.error?.sideEffect || (result.outcome === 'needs-review' ? 'unknown' : undefined),
                            expectedDiff: result.expectedDiff || result.script?.expectedDiff };
                        runRecord.receipts = [...runRecord.receipts, receipt].slice(-32);
                        active.activeTool = null;
                        runRecord.activeTool = null;
                    }
                    runRecord.updatedAt = new Date().toISOString();
                    try { appendRun(runRecord); }
                    catch (_) {
                        active.persistenceError = true;
                        active.controller.abort();
                        send(socket, { type: 'run.persistence-error', requestId: message.requestId });
                    }
                    send(socket, { ...event, requestId: message.requestId });
                };
            const agentRun = message.mode === 'Agent'
                ? runTypeScriptAgent({
                    client,
                    task: taskText,
                    projectRoot: options.project,
                    skillFiles: [AGENT_SKILL],
                    tracePath: runTracePath,
                    apiKey,
                    model: options.model,
                    history: modelHistory,
                    projectContext: normalizeCreatorProjectContext(message.projectContext),
                    signal: active.controller.signal,
                    onEvent: onAgentEvent,
                    approveWrite,
                    memoryStore,
                    taskStore,
                    recoveryStore,
                    ...(approvedPlanAcceptance ? { planAcceptance: approvedPlanAcceptance } : {}),
                })
                : runTypeScriptReadOnly({
                    client,
                    task: taskText,
                    projectRoot: options.project,
                    skillFiles: [AGENT_SKILL],
                    tracePath: runTracePath,
                    apiKey,
                    model: options.model,
                    mode: message.mode,
                    history: modelHistory,
                    projectContext: normalizeCreatorProjectContext(message.projectContext),
                    signal: active.controller.signal,
                    onEvent: onAgentEvent,
                    memoryStore,
                });
            void agentRun.then(async (rawResult) => {
                let result = rawResult;
                let structuredPlan = null;
                let assistantText;
                if (message.mode === 'Plan') {
                    const finalized = finalizePlanResult(rawResult, {
                        conversationId: message.conversationId, userTask: message.text.trim(),
                    });
                    result = finalized.result;
                    structuredPlan = finalized.plan;
                    writeEvent(result.tracePath, { event: 'plan.generation.finished',
                        kernelStatus: rawResult.status, kernelReason: rawResult.reason,
                        status: result.status, reason: result.reason }, apiKey);
                    if (structuredPlan) {
                        plans.set(structuredPlan.id, structuredPlan);
                        writeEvent(result.tracePath, { event: 'plan.created', plan: planView(structuredPlan) }, apiKey);
                    }
                    assistantText = assistantAnswer(result, message.mode);
                } else {
                    assistantText = assistantAnswer(result, message.mode);
                }
                if (activePlan) {
                    const runtime = await import(pathToFileURL(path.join(REPOSITORY_ROOT, 'tools/cocos-agent-runtime/dist/index.js')).href);
                    const business = runtime.evaluateCreatorPlanAcceptance(approvedPlanAcceptance, result.receipts || []);
                    if (result.status === 'completed' && !business.satisfied) {
                        result = { ...result, status: 'stopped', reason: 'plan-business-acceptance-unmet',
                            goalEvaluation: { satisfied: false, outstanding: business.outstanding },
                            finalText: `计划尚未完成。\n未完成业务验收：\n${business.outstanding.map((item) => `- ${item.description}`).join('\n')}` };
                    }
                    finishPlanStep(activePlan, result, business);
                    assistantText = assistantAnswer(result, message.mode);
                    writeEvent(result.tracePath, { event: 'plan.step.finished', plan: planView(activePlan),
                        stepIndex: message.planExecution.stepIndex, runStatus: result.status, reason: result.reason }, apiKey);
                }
                conversation.push({ role: 'assistant', content: assistantText.slice(0, MAX_MESSAGE_LENGTH) });
                conversations.set(message.conversationId, conversation);
                runRecord.status = result.status;
                runRecord.reason = result.reason;
                if (result.goalEvaluation) runRecord.goalEvaluation = result.goalEvaluation;
                runRecord.executionChecklist = Array.isArray(result.executionChecklist) ? result.executionChecklist : runRecord.executionChecklist;
                runRecord.updatedAt = new Date().toISOString();
                runRecord.activeTool = null;
                // Preserve full result receipts in the compact recovery ledger, merging in case
                // an event was missed during a panel reconnect.
                for (const receipt of result.receipts || []) {
                    const compact = compactReceipt(receipt);
                    if (!runRecord.receipts.some((saved) => saved.callId === compact.callId)) {
                        runRecord.receipts.push({ toolName: compact.name, callId: compact.callId, access: compact.access,
                            success: compact.success, outcome: compact.outcome, operationId: compact.operationId,
                            command: compact.command, errorCode: compact.error?.code,
                            sideEffect: compact.error?.sideEffect || (compact.outcome === 'needs-review' ? 'unknown' : undefined),
                            expectedDiff: compact.expectedDiff || compact.script?.expectedDiff });
                    }
                }
                appendRun(runRecord);
                send(socket, { type: 'run.result', requestId: message.requestId, mode: message.mode,
                    result: { status: result.status, reason: result.reason, finalText: assistantText,
                        toolCalls: result.toolCalls, tracePath: result.tracePath,
                        receipts: (result.receipts || []).map(compactReceipt),
                        contextCompactions: result.contextCompactions || [],
                        executionChecklist: runRecord.executionChecklist,
                        goalEvaluation: runRecord.goalEvaluation,
                        plan: structuredPlan ? planView(structuredPlan) : undefined,
                        planProgress: activePlan ? planView(activePlan) : undefined,
                        recentRuns: recentRuns.filter((run) => run.conversationId === message.conversationId).slice(-12) } });
            }).catch((error) => {
                const detail = String(error?.message || error).slice(0, 500);
                if (activePlan) activePlan.status = 'needs-review';
                const possibleWrite = Boolean(active.activeTool && active.activeTool.access !== 'read')
                    || runRecord.receipts.some((receipt) => receipt.access !== 'read');
                runRecord.status = possibleWrite ? 'needs-review' : 'failed';
                runRecord.reason = 'assistant_host_error';
                runRecord.updatedAt = new Date().toISOString();
                try { appendRun(runRecord); } catch (_) {}
                send(socket, { type: 'run.failed', requestId: message.requestId, message: detail,
                    planProgress: activePlan ? planView(activePlan) : undefined });
            }).finally(() => {
                if (activeRunState === active) activeRunState = null;
            });
        });

        socket.on('close', () => {
            for (const [approvalId, pending] of pendingApprovals) {
                if (pending.socket !== socket) continue;
                clearTimeout(pending.timer);
                pendingApprovals.delete(approvalId);
                pending.resolve(false);
            }
        });
    });

    await new Promise((resolve, reject) => {
        wss.once('listening', resolve);
        wss.once('error', reject);
    });
    const address = wss.address();
    process.stdout.write(`READY ${JSON.stringify({ port: address.port, token, model: options.model, creatorVersion: '2.4.15' })}\n`);

    const shutdown = async () => {
        for (const pending of pendingApprovals.values()) {
            clearTimeout(pending.timer);
            pending.resolve(false);
        }
        pendingApprovals.clear();
        for (const socket of wss.clients) socket.terminate();
        await new Promise((resolve) => wss.close(resolve));
        await client.close().catch(() => {});
        process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

const isEntrypoint = (() => {
    if (!process.argv[1]) return false;
    try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
    catch (_) { return false; }
})();
if (isEntrypoint) {
    try {
        await start(parseArgs(process.argv.slice(2)));
    } catch (error) {
        process.stderr.write(`${String(error?.message || error).slice(0, 500)}\n`);
        process.exitCode = 1;
    }
}

export { parseArgs, compactResult, compactReceipt, assistantAnswer, readRecoveryReceipt };
