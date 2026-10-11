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
            error: structured.error ? { code: structured.error.code, message: structured.error.message } : undefined,
            phases: structured.phases,
            reconciliation: structured.reconciliation ? { disposition: structured.reconciliation.disposition } : undefined,
        };
        for (const key of ['packageName', 'packageVersion', 'packageFingerprint', 'skillsIndexSha256',
            'skillName', 'referenceId', 'uri', 'sha256', 'mimeType', 'byteLength']) {
            if (structured[key] !== undefined) compact[key] = structured[key];
        }
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

function assistantAnswer(result, mode) {
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
    const conversations = new Map();
    const plans = new Map();
    const pendingApprovals = new Map();
    let activeRun = false;

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
                    plans: [...plans.values()].filter((plan) => plan.conversationId === message.conversationId).map(planView) });
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
            if (message?.type !== 'run' || activeRun || typeof message.requestId !== 'string'
                || typeof message.conversationId !== 'string' || message.conversationId.length > 80
                || !MODE_NAMES.has(message.mode)
                || (planExecutionRequested
                    ? (message.mode !== 'Agent' || !message.planExecution || typeof message.planExecution.planId !== 'string'
                        || !Number.isInteger(message.planExecution.stepIndex))
                    : (typeof message.text !== 'string' || !message.text.trim() || message.text.length > MAX_MESSAGE_LENGTH))) {
                if (message?.type === 'run') send(socket, { type: 'run.rejected', requestId: message.requestId || null,
                    reason: activeRun ? 'assistant_busy' : 'invalid_request' });
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

            activeRun = true;
            const history = conversations.get(message.conversationId) || [];
            const conversation = [...history, { role: 'user', content: taskText }];
            send(socket, { type: 'run.started', requestId: message.requestId, mode: message.mode });

            const approveWrite = (tool, args) => new Promise((resolve) => {
                if (socket.readyState !== 1) { resolve(false); return; }
                const approvalId = crypto.randomUUID();
                const timer = setTimeout(() => {
                    pendingApprovals.delete(approvalId);
                    resolve(false);
                }, APPROVAL_TIMEOUT_MS);
                pendingApprovals.set(approvalId, { socket, resolve, timer });
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
                allowWrite: message.mode === 'Agent',
                approveWrite,
                onEvent: (event) => {
                    if (event.type.startsWith('run.')) return;
                    if (event.type === 'tool.finished') event.result = compactResult(event.result);
                    if (event.type === 'run.finished' && Array.isArray(event.receipts)) {
                        event.receipts = event.receipts.map(compactReceipt);
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
                send(socket, { type: 'run.result', requestId: message.requestId, mode: message.mode,
                    result: { status: result.status, reason: result.reason, finalText: assistantText,
                        toolCalls: result.toolCalls, tracePath: result.tracePath,
                        receipts: (result.receipts || []).map(compactReceipt),
                        plan: structuredPlan ? planView(structuredPlan) : undefined,
                        planProgress: activePlan ? planView(activePlan) : undefined } });
            }).catch((error) => {
                const detail = String(error?.message || error).slice(0, 500);
                if (activePlan) activePlan.status = 'needs-review';
                send(socket, { type: 'run.failed', requestId: message.requestId, message: detail,
                    planProgress: activePlan ? planView(activePlan) : undefined });
            }).finally(() => {
                activeRun = false;
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

export { parseArgs, compactResult, compactReceipt, assistantAnswer };
