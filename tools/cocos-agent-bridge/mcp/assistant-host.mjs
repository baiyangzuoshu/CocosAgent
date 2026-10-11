import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { runDeepSeekAgent, DEFAULT_BASE_URL, DEFAULT_MODEL, writeEvent } from './deepseek-agent.mjs';
import { parseStructuredPlan } from './structured-plan.mjs';
import { beginPlanStep, createPlan, finishPlanStep, hasPlanSetupReceipts, planView } from './assistant-plan-service.mjs';
import { AssistantStateStore } from './assistant-state-store.mjs';
import { normalizeCreatorProjectContext } from './assistant-project-context.mjs';

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

function traceFile(projectRoot) {
    const userStateRoot = process.env.LOCALAPPDATA || process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    const directory = path.join(userStateRoot, 'CocosAgent', 'agent-runs');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    return path.join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}.jsonl`);
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
            'skillName', 'referenceId', 'uri', 'sha256', 'mimeType', 'byteLength']) {
            if (structured[key] !== undefined) compact[key] = structured[key];
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

async function readRecoveryReceipt(client, projectRoot, toolName, operationId) {
    if (!path.isAbsolute(projectRoot) || !/^[0-9a-f-]{36}$/i.test(operationId)
        || !['cocos_2x_operation_get', 'cocos_2x_script_operation_get'].includes(toolName)) {
        throw new Error('RECOVERY_REQUEST_INVALID');
    }
    const requiredCommand = toolName === 'cocos_2x_script_operation_get' ? 'script.operation.get' : 'operation.get';
    const listed = await client.callTool({ name: 'cocos_2x_instances_list', arguments: {} });
    const instances = listed?.structuredContent?.data;
    const selected = Array.isArray(instances) && instances.find((instance) => instance.projectRoot === projectRoot);
    if (listed?.structuredContent?.success !== true || !selected
        || selected.creatorVersion !== '2.4.15' || selected.state !== 'ready') {
        throw new Error('RECOVERY_INSTANCE_NOT_READY');
    }
    const catalog = await client.callTool({ name: 'cocos_2x_capabilities_list', arguments: { projectRoot } });
    const catalogData = catalog?.structuredContent?.data;
    const exactInstance = catalogData?.instance;
    const capability = catalogData?.commands?.find((item) => item.id === requiredCommand);
    if (catalog?.structuredContent?.success !== true || exactInstance?.projectRoot !== projectRoot
        || exactInstance.creatorVersion !== '2.4.15' || exactInstance.state !== 'ready'
        || !capability || capability.status !== 'available') {
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
    return result.finalText || (result.status === 'awaiting-approval'
        ? '操作未获批准，项目没有执行这一步修改。'
        : `任务已停止：${result.reason || result.status}`);
}

async function start(options) {
    if (Number.parseInt(process.versions.node.split('.')[0], 10) < 20) {
        throw new Error('Node.js 20 or newer is required for the in-editor Assistant.');
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (typeof apiKey !== 'string' || apiKey.trim().length < 8) throw new Error('Set DEEPSEEK_API_KEY in the assistant process environment.');

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
    const stateStore = new AssistantStateStore(options.project);
    const restoredState = stateStore.load();
    const conversations = new Map(restoredState.conversations.map((entry) => [entry.id, entry.messages]));
    const plans = new Map(restoredState.plans.map((plan) => [plan.id, plan]));
    const recentRuns = restoredState.runs;
    const pendingApprovals = new Map();
    let activeRunState = null;
    const persistState = () => stateStore.save({
        conversations: [...conversations].map(([id, messages]) => ({ id, messages })),
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

        socket.on('message', (buffer) => {
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
                    active.runRecord.status = 'running';
                    active.runRecord.reason = 'cancellation_requested';
                    active.runRecord.updatedAt = new Date().toISOString();
                    try { appendRun(active.runRecord); }
                    catch (_) { send(socket, { type: 'run.persistence-error', requestId: active.requestId }); }
                    send(socket, { type: 'run.cancelling', requestId: active.requestId,
                        message: active.activeTool?.access === 'write-approved'
                            ? '已请求停止；当前编辑器命令会先完成并读回回执，之后不再发起新命令。'
                            : '已请求停止当前模型请求；不会发起后续工具调用。' });
                }
                return;
            }
            if (message?.type === 'run.recover' && typeof message.runId === 'string' && typeof message.operationId === 'string') {
                const run = recentRuns.find((item) => item.id === message.runId
                    && item.conversationId === message.conversationId
                    && ((item.receipts || []).some((receipt) => receipt.operationId === message.operationId)
                        || item.activeTool?.operationId === message.operationId));
                if (!run || !/^[0-9a-f-]{36}$/i.test(message.operationId)) {
                    send(socket, { type: 'run.recovery.result', runId: message.runId, operationId: message.operationId,
                        error: '没有找到与当前会话匹配的已记录操作 ID。' });
                    return;
                }
                const writeReceipt = run.receipts.find((receipt) => receipt.operationId === message.operationId)
                    || run.activeTool;
                const toolName = writeReceipt?.toolName === 'cocos_2x_script_patch'
                    || writeReceipt?.command?.startsWith('script.') ? 'cocos_2x_script_operation_get' : 'cocos_2x_operation_get';
                void (async () => {
                    const receipt = await readRecoveryReceipt(client, options.project, toolName, message.operationId);
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
            let taskText = planExecutionRequested ? '' : message.text.trim();
            if (planExecutionRequested) {
                activePlan = plans.get(message.planExecution.planId) || null;
                try {
                    taskText = beginPlanStep(activePlan, { conversationId: message.conversationId,
                        planId: message.planExecution.planId, stepIndex: message.planExecution.stepIndex });
                } catch (error) {
                    send(socket, { type: 'run.rejected', requestId: message.requestId, reason: error.message });
                    return;
                }
            }

            const active = { requestId: message.requestId, socket, controller: new AbortController(),
                cancelRequested: false, activeTool: null, runRecord: null };
            activeRunState = active;
            const history = conversations.get(message.conversationId) || [];
            const conversation = [...history, { role: 'user', content: taskText }];
            conversations.set(message.conversationId, conversation.slice(-MAX_HISTORY));
            const runRecord = { id: message.requestId, conversationId: message.conversationId,
                planId: activePlan?.id, task: taskText.slice(0, MAX_MESSAGE_LENGTH), mode: message.mode,
                status: 'running', reason: null, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                activeTool: null, receipts: [] };
            active.runRecord = runRecord;
            try { appendRun(runRecord); }
            catch (error) {
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

            void runDeepSeekAgent({
                client,
                task: taskText,
                projectRoots: [options.project],
                skillFiles: [AGENT_SKILL],
                tracePath: traceFile(options.project),
                apiKey,
                model: options.model,
                mode: message.mode,
                // Skill/reference discovery and verification need room before the final answer.
                maxTurns: message.mode === 'Ask' ? 16 : 20,
                maxToolCalls: message.mode === 'Ask' ? 14 : 18,
                history: history.slice(-MAX_HISTORY),
                projectContext: normalizeCreatorProjectContext(message.projectContext),
                allowWrite: message.mode === 'Agent',
                approveWrite,
                signal: active.controller.signal,
                onEvent: (event) => {
                    if (event.type.startsWith('run.')) return;
                    if (event.type === 'tool.finished') event.result = compactResult(event.result);
                    if (event.type === 'run.finished' && Array.isArray(event.receipts)) {
                        event.receipts = event.receipts.map(compactReceipt);
                    }
                    if (event.type === 'tool.started') {
                        active.activeTool = { toolName: event.toolName, command: event.command,
                            operationId: event.operationId, access: event.access || 'unknown', callId: event.callId };
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
                },
            }).then((result) => {
                let structuredPlan = null;
                let assistantText;
                if (message.mode === 'Plan') {
                    if (result.status === 'completed' && hasPlanSetupReceipts(result.receipts)) {
                        try {
                            structuredPlan = createPlan({ conversationId: message.conversationId, userTask: message.text.trim(),
                                data: parseStructuredPlan(result.finalText) });
                            plans.set(structuredPlan.id, structuredPlan);
                            writeEvent(result.tracePath, { event: 'plan.created', plan: planView(structuredPlan) }, apiKey);
                            assistantText = `已生成 ${structuredPlan.steps.length} 步计划「${structuredPlan.title}」。请先检查每一步，再选择开始。计划内容本身不会修改项目。`;
                        } catch (error) {
                            assistantText = `计划没有通过结构校验（${String(error.message || error)}）。项目未修改；请重新生成计划。`;
                        }
                    } else {
                        assistantText = '无法生成计划：尚未取得本轮 Creator 就绪实例和能力目录回执。项目未修改。';
                    }
                } else {
                    assistantText = assistantAnswer(result, message.mode);
                }
                if (activePlan) {
                    finishPlanStep(activePlan, result);
                    writeEvent(result.tracePath, { event: 'plan.step.finished', plan: planView(activePlan),
                        stepIndex: message.planExecution.stepIndex, runStatus: result.status, reason: result.reason }, apiKey);
                }
                conversation.push({ role: 'assistant', content: assistantText.slice(0, MAX_MESSAGE_LENGTH) });
                conversations.set(message.conversationId, conversation.slice(-MAX_HISTORY));
                runRecord.status = result.status;
                runRecord.reason = result.reason;
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
