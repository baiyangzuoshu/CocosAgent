import type {
    AgentMessage,
    AgentReceipt,
    AgentTool,
    AgentToolCall,
    CompactedToolInteraction,
    ContextBudgetOptions,
    ContextCompactionReport,
    JsonObject,
    OutstandingAcceptanceItem,
    ToolMessage,
    UnpairedToolResult,
} from './contracts.js';

const OPERATION_ID_FIELDS = ['operationId', 'memoryId', 'pipelineId', 'workflowId', 'buildId', 'batchId', 'releaseId'] as const;
const ACCEPTANCE_FIELDS = new Set([
    'preview', 'runtime', 'validation', 'acceptance', 'recovery', 'editor', 'disk', 'compile', 'build', 'phase', 'phases',
]);
const PENDING_WORDS = [
    'needs-preview', 'needs-runtime', 'needs-review', 'pending', 'not-run', 'not-started', 'unverified',
    'in-progress', 'compensating', 'running', 'awaiting-approval', 'failed', 'rejected', 'blocked', 'unknown',
];
const ACCEPTED_WORDS = ['passed', 'accepted', 'completed', 'verified', 'observed', 'reconciled', 'compensated', 'rolled-back', 'no-effect'];
// Creator Agent exposes the full 2.4 tool contract catalog to the model. The
// conservative UTF-8/3 estimate for that catalog alone is above 24k tokens, so
// the old default stopped real tasks before their first provider request.
// Keep a bounded local budget while leaving room for the catalog and task data.
const DEFAULT_MAX_ESTIMATED_TOKENS = 64_000;
const DEFAULT_KEEP_RECENT_MESSAGES = 10;
const DEFAULT_KEEP_RECENT_TOOL_INTERACTIONS = 4;
const SUMMARY_PREVIEW_CHARS = 360;

export interface PreparedAgentContext {
    messages: AgentMessage[];
    fitsBudget: boolean;
    report: ContextCompactionReport;
}

interface AcceptanceSignal {
    kind: string;
    status: string;
}

interface ToolInteraction {
    call: AgentToolCall;
    assistantIndex: number;
    resultIndex: number | null;
    tool: AgentTool | undefined;
    resultMessage: ToolMessage | null;
    resultReceipt: AgentReceipt | null;
    operationIdentities: string[];
    acceptanceSignals: AcceptanceSignal[];
    success: boolean;
    pairStatus: CompactedToolInteraction['pairStatus'];
}

export function estimateContextTokens(messages: AgentMessage[], tools: AgentTool[]): number {
    const projected = {
        messages: messages.map((message) => estimateMessageProjection(message)),
        tools,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(projected)).length;
    const imagePayloadTokens = messages.reduce((total, message) => total + estimateImagePayloadTokens(message), 0);
    // UTF-8 bytes / 3 is a conservative estimate for mixed English and CJK JSON.
    return Math.ceil(bytes / 3 + imagePayloadTokens);
}

export function prepareAgentContext(input: {
    messages: AgentMessage[];
    tools: AgentTool[];
    activeTask: string;
    receipts?: AgentReceipt[];
    options?: ContextBudgetOptions;
}): PreparedAgentContext {
    const maxEstimatedTokens = input.options?.maxEstimatedTokens ?? DEFAULT_MAX_ESTIMATED_TOKENS;
    const keepRecentMessages = input.options?.keepRecentMessages ?? DEFAULT_KEEP_RECENT_MESSAGES;
    const keepRecentToolInteractions = input.options?.keepRecentToolInteractions ?? DEFAULT_KEEP_RECENT_TOOL_INTERACTIONS;
    validatePositiveInteger(maxEstimatedTokens, 'maxEstimatedTokens', 512, 200_000);
    validatePositiveInteger(keepRecentMessages, 'keepRecentMessages', 1, 128);
    validatePositiveInteger(keepRecentToolInteractions, 'keepRecentToolInteractions', 1, 128);

    const original = [...input.messages];
    const beforeTokens = estimateContextTokens(original, input.tools);
    const interactions = analyzeInteractions(original, input.tools, input.receipts || []);
    const outstandingAcceptance = findOutstandingAcceptance(interactions);
    const operationIdentities = [...new Set(interactions.flatMap((interaction) => interaction.operationIdentities))];
    const unpairedToolResults = findUnpairedToolResults(original, interactions);
    if (beforeTokens <= maxEstimatedTokens) {
        return {
            messages: original,
            fitsBudget: true,
            report: {
                maxEstimatedTokens,
                estimatedTokens: beforeTokens,
                compacted: false,
                summarizedToolCalls: 0,
                compactedToolResults: 0,
                retainedToolCalls: interactions.length,
                operationIdentities,
                outstandingAcceptance,
                compactedInteractions: [],
                unpairedToolResults: [],
            },
        };
    }

    const selected = selectRecentAndCriticalMessages(original, interactions, outstandingAcceptance,
        keepRecentMessages, keepRecentToolInteractions);
    const summarized = interactions.filter((interaction) => !selected.has(interaction.assistantIndex));
    const omittedText = collectDialogueNotes(original, selected);
    const compactionMessage: AgentMessage = {
        role: 'user',
        content: createCompactionSummary(input.activeTask, omittedText, summarized, outstandingAcceptance, unpairedToolResults),
    };
    const initialMessage = original[0];
    const compacted: AgentMessage[] = [];
    if (initialMessage) compacted.push(cloneAgentMessage(initialMessage));
    compacted.push(compactionMessage);
    for (let index = 1; index < original.length; index += 1) {
        if (selected.has(index)) compacted.push(cloneAgentMessage(original[index]!));
    }

    const compactedResultCallIds = compactReadOnlyResults(compacted, interactions, selected,
        outstandingAcceptance, keepRecentToolInteractions);
    let estimatedTokens = estimateContextTokens(compacted, input.tools);

    if (estimatedTokens > maxEstimatedTokens) {
        const minimalSummary: AgentMessage = {
            role: 'user',
            content: createCompactionSummary(input.activeTask, [], summarized, outstandingAcceptance, unpairedToolResults),
        };
        compacted[initialMessage ? 1 : 0] = minimalSummary;
        for (const callId of compactReadOnlyResults(compacted, interactions, selected,
            outstandingAcceptance, keepRecentToolInteractions, true)) compactedResultCallIds.add(callId);
        estimatedTokens = estimateContextTokens(compacted, input.tools);
    }

    const compactedCallIds = new Set([
        ...summarized.map((interaction) => interaction.call.id),
        ...compactedResultCallIds,
    ]);
    const compactedInteractions = interactions.filter((interaction) => compactedCallIds.has(interaction.call.id));

    return {
        messages: compacted,
        fitsBudget: estimatedTokens <= maxEstimatedTokens,
        report: {
            maxEstimatedTokens,
            estimatedTokens,
            compacted: true,
            summarizedToolCalls: summarized.length,
            compactedToolResults: compactedResultCallIds.size,
            retainedToolCalls: interactions.length - summarized.length,
            operationIdentities,
            outstandingAcceptance,
            compactedInteractions: compactedInteractions.map(toCompactedInteraction),
            unpairedToolResults,
        },
    };
}

function validatePositiveInteger(value: number, name: string, min: number, max: number): void {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new RangeError(`${name} must be an integer from ${min} to ${max}.`);
    }
}

function estimateMessageProjection(message: AgentMessage): unknown {
    if (message.role !== 'user' || !Array.isArray(message.content)) return message;
    return {
        ...message,
        content: message.content.map((block) => block.type === 'image_url'
            ? { type: 'image_url', detail: block.image_url.detail, payloadEstimate: 2_048 }
            : block),
    };
}

function estimateImagePayloadTokens(message: AgentMessage): number {
    if (message.role !== 'user' || !Array.isArray(message.content)) return 0;
    return message.content.reduce((total, block) => {
        if (block.type !== 'image_url') return total;
        return total + 2_048;
    }, 0);
}

function analyzeInteractions(messages: AgentMessage[], tools: AgentTool[], receipts: AgentReceipt[]): ToolInteraction[] {
    const toolByName = new Map(tools.map((tool) => [tool.name, tool]));
    const resultByCallId = new Map<string, Array<{ index: number; message: ToolMessage }>>();
    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (message?.role === 'tool') {
            const matches = resultByCallId.get(message.toolCallId) || [];
            matches.push({ index, message });
            resultByCallId.set(message.toolCallId, matches);
        }
    }
    const receiptByCallId = new Map<string, AgentReceipt[]>();
    for (const receipt of receipts) {
        const matches = receiptByCallId.get(receipt.callId) || [];
        matches.push(receipt);
        receiptByCallId.set(receipt.callId, matches);
    }

    const interactions: ToolInteraction[] = [];
    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (message?.role !== 'assistant' || !message.toolCalls?.length) continue;
        for (const call of message.toolCalls) {
            const results = resultByCallId.get(call.id) || [];
            const exact = results.filter((result) => result.message.name === call.name);
            const result = exact.length === 1 ? exact[0] : null;
            const pairStatus: CompactedToolInteraction['pairStatus'] = results.length > 1 || exact.length > 1
                ? 'ambiguous'
                : exact.length === 0
                    ? results.length ? 'name-mismatch' : 'missing'
                    : result!.index <= index ? 'out-of-order' : 'matched';
            const tool = toolByName.get(call.name);
            const matchingReceipts = (receiptByCallId.get(call.id) || []).filter((receipt) => receipt.toolName === call.name);
            const receipt = matchingReceipts.length === 1 ? matchingReceipts[0]! : null;
            const parsed = result && pairStatus === 'matched' ? parseToolResult(result.message.content) : null;
            const identities = new Set<string>([
                ...collectOperationIdentities(call.arguments),
                ...collectOperationIdentities(parsed?.structuredContent),
                ...collectOperationIdentities(receipt?.result.structuredContent),
            ]);
            interactions.push({
                call,
                assistantIndex: index,
                resultIndex: pairStatus === 'matched' ? result!.index : null,
                tool,
                resultMessage: pairStatus === 'matched' ? result!.message : null,
                resultReceipt: receipt,
                operationIdentities: [...identities],
                acceptanceSignals: deduplicateAcceptanceSignals([
                    ...collectAcceptanceSignals(parsed?.structuredContent),
                    ...collectAcceptanceSignals(receipt?.result.structuredContent),
                ]),
                success: receipt?.result.structuredContent?.success === true
                    || parsed?.success === true || parsed?.structuredContent?.success === true,
                pairStatus,
            });
        }
    }
    return interactions;
}

function deduplicateAcceptanceSignals(signals: AcceptanceSignal[]): AcceptanceSignal[] {
    const seen = new Set<string>();
    return signals.filter((signal) => {
        const key = `${signal.kind}:${signal.status}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parseToolResult(content: string): { success?: boolean; structuredContent?: JsonObject } | null {
    try {
        const value: unknown = JSON.parse(content);
        if (!isRecord(value)) return null;
        return {
            ...(typeof value.success === 'boolean' ? { success: value.success } : {}),
            ...(isRecord(value.structuredContent) ? { structuredContent: value.structuredContent } : {}),
        };
    } catch {
        return null;
    }
}

function collectOperationIdentities(value: unknown, depth = 0): string[] {
    if (!isRecord(value) || depth > 10) return [];
    const identities: string[] = [];
    for (const field of OPERATION_ID_FIELDS) {
        if (typeof value[field] === 'string' && value[field]) identities.push(`${field}=${value[field]}`);
    }
    for (const child of Object.values(value)) {
        if (isRecord(child)) identities.push(...collectOperationIdentities(child, depth + 1));
        else if (Array.isArray(child)) {
            for (const item of child.slice(0, 64)) identities.push(...collectOperationIdentities(item, depth + 1));
        }
    }
    return [...new Set(identities)];
}

function collectAcceptanceSignals(value: unknown, parentKey = '', depth = 0): AcceptanceSignal[] {
    if (depth > 10) return [];
    const signals: AcceptanceSignal[] = [];
    if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        const pending = PENDING_WORDS.find((word) => normalized.includes(word));
        if (pending) {
            signals.push({ kind: kindFor(parentKey, pending), status: value.slice(0, 100) });
        } else if (ACCEPTED_WORDS.includes(normalized) && ACCEPTANCE_FIELDS.has(parentKey.toLowerCase())) {
            signals.push({ kind: kindFor(parentKey, normalized), status: value.slice(0, 100) });
        }
        return signals;
    }
    if (Array.isArray(value)) {
        for (const item of value.slice(0, 128)) signals.push(...collectAcceptanceSignals(item, parentKey, depth + 1));
        return signals;
    }
    if (!isRecord(value)) return signals;
    for (const [key, child] of Object.entries(value)) {
        if (key.toLowerCase() === 'error' && isRecord(child)) {
            if (child.sideEffect === 'unknown' || child.sideEffect === 'possible') {
                signals.push({ kind: 'recovery', status: `sideEffect=${String(child.sideEffect)}` });
            }
        }
        signals.push(...collectAcceptanceSignals(child, key, depth + 1));
    }
    return signals;
}

function kindFor(parentKey: string, status: string): string {
    const key = parentKey.toLowerCase();
    if (key.includes('preview') || status === 'needs-preview') return 'preview';
    if (key.includes('runtime') || key.includes('compile') || status === 'needs-runtime') return 'runtime';
    if (key.includes('recovery') || key.includes('sideeffect') || status === 'needs-review'
        || status === 'compensating' || status === 'unknown') return 'recovery';
    if (key.includes('validation') || key.includes('acceptance') || key.includes('check')) return 'validation';
    if (key.includes('editor') || key.includes('disk')) return key;
    if (key.includes('approval')) return 'approval';
    return 'operation';
}

function findOutstandingAcceptance(interactions: ToolInteraction[]): OutstandingAcceptanceItem[] {
    const current = new Map<string, OutstandingAcceptanceItem>();
    for (const interaction of interactions) {
        const keys = interaction.operationIdentities.length ? interaction.operationIdentities : [`callId=${interaction.call.id}`];
        if (interaction.pairStatus !== 'matched') {
            for (const key of keys) current.set(`${key}:recovery`, {
                key,
                kind: 'recovery',
                status: `tool-result-${interaction.pairStatus}`,
                callId: interaction.call.id,
                toolName: interaction.call.name,
            });
        }
        for (const key of keys) {
            for (const signal of interaction.acceptanceSignals) {
                const itemKey = `${key}:${signal.kind}`;
                if (isAccepted(signal.status)) current.delete(itemKey);
                else current.set(itemKey, {
                    key,
                    kind: signal.kind,
                    status: signal.status,
                    callId: interaction.call.id,
                    toolName: interaction.call.name,
                });
            }
            if (isPreviewAcceptanceTool(interaction.call.name) && interaction.success) current.delete(`${key}:preview`);
            if (interaction.tool?.role === 'recovery' && interaction.success && hasTerminalRecovery(interaction)) {
                current.delete(`${key}:recovery`);
                current.delete(`${key}:operation`);
            }
        }
    }
    return [...current.values()].sort((a, b) => a.key.localeCompare(b.key) || a.kind.localeCompare(b.kind));
}

function isAccepted(status: string): boolean {
    const normalized = status.toLowerCase();
    return ACCEPTED_WORDS.includes(normalized) || normalized.startsWith('passed:') || normalized.endsWith('/passed');
}

function isPreviewAcceptanceTool(name: string): boolean {
    return name === 'cocos_2x_operation_preview_accept' || name === 'cocos_2x_assets_scene_preview_accept';
}

function hasTerminalRecovery(interaction: ToolInteraction): boolean {
    const parsed = interaction.resultMessage ? parseToolResult(interaction.resultMessage.content) : null;
    const structured = interaction.resultReceipt?.result.structuredContent || parsed?.structuredContent;
    if (!structured || interaction.resultReceipt?.result.isError === true
        || parsed?.success !== true && structured.success !== true) return false;
    const outcome = String(structured.outcome || structured.status || '').toLowerCase();
    if (['completed', 'compensated', 'reconciled', 'rolled-back', 'no-effect', 'resolved',
        'remembered', 'corrected', 'deleted', 'already-applied'].includes(outcome)) return true;
    return collectAcceptanceSignals(structured).some((signal) => signal.kind === 'recovery' && isAccepted(signal.status));
}

function selectRecentAndCriticalMessages(
    messages: AgentMessage[],
    interactions: ToolInteraction[],
    outstanding: OutstandingAcceptanceItem[],
    keepRecentMessages: number,
    keepRecentToolInteractions: number,
): Set<number> {
    const selected = new Set<number>();
    if (messages.length) selected.add(0);
    const recentStart = Math.max(1, messages.length - keepRecentMessages);
    for (let index = recentStart; index < messages.length; index += 1) selected.add(index);
    const grouped = groupInteractions(interactions);
    for (const group of grouped.slice(-keepRecentToolInteractions)) addCompleteGroup(selected, group);
    for (const group of grouped) {
        if (group.some((interaction) => isCriticalInteraction(interaction, outstanding))) addCompleteGroup(selected, group);
    }

    const latestImage = findLatestImageMessage(messages);
    if (latestImage >= 0) selected.add(latestImage);
    const dynamicSystem = messages.map((message, index) => ({ message, index }))
        .filter(({ message, index }) => index > 0 && message.role === 'system')
        .slice(-2);
    for (const item of dynamicSystem) selected.add(item.index);
    for (const group of grouped) {
        if (group.some((interaction) => selected.has(interaction.assistantIndex)
            || (interaction.resultIndex !== null && selected.has(interaction.resultIndex)))) {
            addCompleteGroup(selected, group);
        }
    }
    const matchedResultIndexes = new Set(interactions
        .filter((interaction) => interaction.pairStatus === 'matched' && interaction.resultIndex !== null)
        .map((interaction) => interaction.resultIndex));
    for (let index = 0; index < messages.length; index += 1) {
        if (messages[index]?.role === 'tool' && !matchedResultIndexes.has(index)) selected.delete(index);
    }
    return selected;
}

function groupInteractions(interactions: ToolInteraction[]): ToolInteraction[][] {
    const groups = new Map<number, ToolInteraction[]>();
    for (const interaction of interactions) {
        const group = groups.get(interaction.assistantIndex) || [];
        group.push(interaction);
        groups.set(interaction.assistantIndex, group);
    }
    return [...groups.values()].sort((a, b) => a[0]!.assistantIndex - b[0]!.assistantIndex);
}

function addGroup(selected: Set<number>, group: ToolInteraction[]): void {
    for (const interaction of group) {
        selected.add(interaction.assistantIndex);
        if (interaction.resultIndex !== null) selected.add(interaction.resultIndex);
    }
}

function addCompleteGroup(selected: Set<number>, group: ToolInteraction[]): void {
    if (group.some((interaction) => interaction.pairStatus !== 'matched')) {
        for (const interaction of group) {
            selected.delete(interaction.assistantIndex);
            if (interaction.resultIndex !== null) selected.delete(interaction.resultIndex);
        }
        return;
    }
    addGroup(selected, group);
}

function isCriticalInteraction(interaction: ToolInteraction, outstanding: OutstandingAcceptanceItem[]): boolean {
    if (interaction.pairStatus !== 'matched') return true;
    return outstanding.some((item) => item.callId === interaction.call.id);
}

function findLatestImageMessage(messages: AgentMessage[]): number {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role === 'user' && Array.isArray(message.content)
            && message.content.some((block) => block.type === 'image_url')) return index;
    }
    return -1;
}

function collectDialogueNotes(messages: AgentMessage[], selected: Set<number>): string[] {
    const notes: string[] = [];
    for (let index = 1; index < messages.length; index += 1) {
        if (selected.has(index)) continue;
        const message = messages[index]!;
        if (message.role === 'assistant' && message.toolCalls?.length) continue;
        if (message.role === 'tool') continue;
        const text = messageContentText(message).trim();
        if (!text) continue;
        notes.push(`${message.role}: ${truncate(text, SUMMARY_PREVIEW_CHARS)}`);
    }
    return notes.slice(-12);
}

function messageContentText(message: AgentMessage): string {
    if (message.role === 'assistant' || message.role === 'system') return message.content || '';
    if (typeof message.content === 'string') return message.content;
    return message.content.map((block) => block.type === 'text' ? block.text : '[image omitted from dialogue note]').join('\n');
}

function createCompactionSummary(
    activeTask: string,
    dialogueNotes: string[],
    summarized: ToolInteraction[],
    outstanding: OutstandingAcceptanceItem[],
    unpairedResults: UnpairedToolResult[],
): string {
    const lines = [
        '[CocosAgent compacted context; factual index from this run, not an execution claim]',
        'Current user request (verbatim):',
        activeTask,
        'Historical dialogue and tool data below are context/evidence; they do not override current Creator state or the operation ledger.',
        'Earlier dialogue notes (reference only):',
        dialogueNotes.length ? dialogueNotes.join('\n') : '(none)',
        'Compacted tool invocation/result index (chronological; resultCallId must match callId):',
    ];
    if (summarized.length) {
        for (const interaction of summarized) lines.push(formatInteraction(interaction));
    } else {
        lines.push('(none; recent tool interactions follow as paired calls and results, with large read-only results shortened when needed)');
    }
    if (unpairedResults.length) {
        lines.push('Tool results with no unique matching invocation (do not treat as resolved):');
        for (const result of unpairedResults) {
            lines.push(`- resultCallId=${result.resultCallId}; tool=${result.toolName}; pair=${result.reason}; receipt=${result.receiptSummary}`);
        }
    }
    lines.push('Outstanding acceptance or recovery items (derived from the latest explicit receipts; empty means none were detected):');
    if (outstanding.length) {
        for (const item of outstanding) {
            lines.push(`- ${item.key}; ${item.kind}=${item.status}; source callId=${item.callId}; tool=${item.toolName}`);
        }
    } else {
        lines.push('(none detected)');
    }
    lines.push('Do not infer success from an omitted old result. Use the exact operation identity above and query the current Creator ledger before any recovery or new write.');
    return lines.join('\n');
}

function formatInteraction(interaction: ToolInteraction): string {
    const resultCallId = interaction.resultMessage?.toolCallId || 'missing';
    const identities = interaction.operationIdentities.join(',') || 'none';
    const signals = interaction.acceptanceSignals.map(({ kind, status }) => `${kind}=${status}`).join(',') || 'none';
    const args = compactArguments(interaction.call.arguments);
    const result = interaction.resultReceipt ? compactReceiptForIndex(interaction.resultReceipt)
        : interaction.resultMessage ? compactResultForIndex(interaction.resultMessage.content) : 'missing';
    return `- callId=${interaction.call.id} -> resultCallId=${resultCallId}; pair=${interaction.pairStatus}; tool=${interaction.call.name}; access=${interaction.tool?.access || 'unknown'}; operation=${identities}; acceptance=${signals}; args=${args}; receipt=${result}`;
}

function toCompactedInteraction(interaction: ToolInteraction): CompactedToolInteraction {
    return {
        callId: interaction.call.id,
        resultCallId: interaction.resultMessage?.toolCallId || null,
        pairStatus: interaction.pairStatus,
        toolName: interaction.call.name,
        access: interaction.tool?.access || 'unknown',
        operationIdentities: interaction.operationIdentities,
        acceptance: interaction.acceptanceSignals.map(({ kind, status }) => `${kind}=${status}`),
        receiptSummary: interaction.resultReceipt ? compactReceiptForIndex(interaction.resultReceipt)
            : interaction.resultMessage ? compactResultForIndex(interaction.resultMessage.content) : 'missing',
    };
}

function findUnpairedToolResults(messages: AgentMessage[], interactions: ToolInteraction[]): UnpairedToolResult[] {
    const pairedIndexes = new Set(interactions
        .filter((interaction) => interaction.pairStatus === 'matched' && interaction.resultIndex !== null)
        .map((interaction) => interaction.resultIndex));
    const callNames = new Map<string, string[]>();
    for (const message of messages) {
        if (message.role !== 'assistant') continue;
        for (const call of message.toolCalls || []) {
            const names = callNames.get(call.id) || [];
            names.push(call.name);
            callNames.set(call.id, names);
        }
    }
    const results: UnpairedToolResult[] = [];
    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (message?.role !== 'tool' || pairedIndexes.has(index)) continue;
        const callNamesForId = callNames.get(message.toolCallId) || [];
        const reason: UnpairedToolResult['reason'] = callNamesForId.length > 1 ? 'ambiguous-call'
            : callNamesForId.length === 1
                ? callNamesForId[0] === message.name
                    ? 'out-of-order'
                    : 'name-mismatch'
                : 'missing-call';
        results.push({
            resultCallId: message.toolCallId,
            toolName: message.name,
            reason,
            receiptSummary: compactResultForIndex(message.content),
        });
    }
    return results;
}

function compactArguments(arguments_: JsonObject): string {
    const candidates: Record<string, unknown> = {};
    for (const key of ['operationId', 'memoryId', 'expectedRevision', 'revision', 'pipelineId', 'workflowId', 'buildId', 'batchId', 'releaseId', 'action', 'targetNodeName', 'assetUuid', 'sceneUuid']) {
        if (arguments_[key] !== undefined) candidates[key] = arguments_[key];
    }
    for (const [key, value] of Object.entries(arguments_)) {
        if (Object.keys(candidates).length >= 8) break;
        if (candidates[key] === undefined && isSmallJsonValue(value)) candidates[key] = value;
    }
    return truncate(JSON.stringify(candidates), 240);
}

function compactResultForIndex(content: string): string {
    const parsed = parseToolResult(content);
    if (!parsed) return truncate(content.replace(/\s+/g, ' '), 180);
    const structured = parsed.structuredContent || {};
    const fields: Record<string, unknown> = {};
    for (const key of ['success', 'outcome', 'status', 'operationId', 'memoryId', 'revision', 'deletedRevision', 'pipelineId', 'workflowId', 'buildId', 'batchId', 'releaseId', 'preview', 'runtime', 'validation', 'recovery', 'error']) {
        if (structured[key] !== undefined && isSmallJsonValue(structured[key])) fields[key] = structured[key];
    }
    if (parsed.success !== undefined) fields.wrapperSuccess = parsed.success;
    return truncate(JSON.stringify(fields), 240);
}

function compactReceiptForIndex(receipt: AgentReceipt): string {
    const structured = receipt.result.structuredContent || {};
    const fields: Record<string, unknown> = {};
    for (const key of ['success', 'outcome', 'status', 'operationId', 'memoryId', 'revision', 'deletedRevision', 'pipelineId', 'workflowId', 'buildId',
        'batchId', 'releaseId', 'preview', 'runtime', 'validation', 'recovery', 'error']) {
        if (structured[key] !== undefined && isSmallJsonValue(structured[key])) fields[key] = structured[key];
    }
    if (receipt.result.isError === true) fields.isError = true;
    return truncate(JSON.stringify(fields), 240);
}

function compactReadOnlyResults(
    messages: AgentMessage[],
    interactions: ToolInteraction[],
    selected: Set<number>,
    outstanding: OutstandingAcceptanceItem[],
    keepRecentToolInteractions: number,
    force = false,
): Set<string> {
    const compactedCallIds = new Set<string>();
    const newestInteraction = interactions.at(-1);
    const protectedCallIds = new Set<string>();
    for (const group of groupInteractions(interactions).slice(-keepRecentToolInteractions)) {
        for (const interaction of group) protectedCallIds.add(interaction.call.id);
    }
    for (const interaction of interactions) {
        if (interaction.pairStatus !== 'matched'
            || outstanding.some((item) => item.callId === interaction.call.id)) protectedCallIds.add(interaction.call.id);
    }
    if (newestInteraction) protectedCallIds.add(newestInteraction.call.id);

    const candidates = interactions
        .filter((interaction) => interaction.resultIndex !== null && selected.has(interaction.resultIndex)
            && interaction.tool?.access === 'read' && interaction.tool.role !== 'recovery'
            && !protectedCallIds.has(interaction.call.id))
        .sort((a, b) => (b.resultMessage?.content.length || 0) - (a.resultMessage?.content.length || 0));

    for (const interaction of candidates) {
        const message = messages.find((candidate) => candidate.role === 'tool' && candidate.toolCallId === interaction.call.id);
        if (!message || message.role !== 'tool' || !force && message.content.length < 1_200) continue;
        const parsed = parseToolResult(message.content);
        const identities = interaction.operationIdentities;
        const states = interaction.acceptanceSignals.map(({ kind, status }) => `${kind}=${status}`);
        const summary: Record<string, unknown> = {
            compacted: true,
            callId: interaction.call.id,
            resultCallId: interaction.resultMessage?.toolCallId || null,
            tool: interaction.call.name,
            success: interaction.resultReceipt?.result.structuredContent?.success
                ?? parsed?.success ?? parsed?.structuredContent?.success ?? null,
            operationIdentities: identities,
            acceptance: states,
            receipt: interaction.resultReceipt ? compactReceiptForIndex(interaction.resultReceipt)
                : compactResultForIndex(message.content),
        };
        message.content = JSON.stringify(summary);
        compactedCallIds.add(interaction.call.id);
    }
    return compactedCallIds;
}

function cloneAgentMessage(message: AgentMessage): AgentMessage {
    return JSON.parse(JSON.stringify(message)) as AgentMessage;
}

function isSmallJsonValue(value: unknown): boolean {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return JSON.stringify(value).length <= 280;
    if (Array.isArray(value)) return value.length <= 8 && value.every((item) => isSmallJsonValue(item));
    return isRecord(value) && Object.keys(value).length <= 8
        && Object.values(value).every((item) => isSmallJsonValue(item));
}

function truncate(value: string, maxChars: number): string {
    return value.length <= maxChars ? value : `${value.slice(0, Math.max(0, maxChars - 16))}...[truncated]`;
}

function isRecord(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
