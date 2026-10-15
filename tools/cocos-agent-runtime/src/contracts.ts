export type AgentMode = 'Ask' | 'Plan' | 'Agent';
export type ToolAccess = 'read' | 'write';
export type ToolRole = 'setup' | 'task' | 'recovery' | 'todo' | 'context' | 'task-system';

export type JsonObject = Record<string, unknown>;

export interface AgentTool {
    name: string;
    description: string;
    inputSchema: JsonObject;
    access: ToolAccess;
    role: ToolRole;
}

export interface TextBlock {
    type: 'text';
    text: string;
}

export interface ImageBlock {
    type: 'image';
    mimeType: string;
    data: string;
}

export type ToolContentBlock = TextBlock | ImageBlock;

export interface AgentToolResult {
    isError?: boolean;
    structuredContent?: JsonObject;
    content?: ToolContentBlock[];
}

export interface SystemMessage {
    role: 'system';
    content: string;
}

export interface UserMessage {
    role: 'user';
    content: string | UserContentBlock[];
}

export type UserContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

export interface AssistantMessage {
    role: 'assistant';
    content: string | null;
    toolCalls?: AgentToolCall[];
}

export interface ToolMessage {
    role: 'tool';
    toolCallId: string;
    name: string;
    content: string;
}

export type AgentMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export interface AgentToolCall {
    id: string;
    name: string;
    arguments: JsonObject;
}

export interface ModelResponse {
    message: AssistantMessage;
    finishReason: string | null;
}

export interface ModelProvider {
    supportsImages?: boolean;
    complete(input: {
        messages: AgentMessage[];
        tools: AgentTool[];
        mode: AgentMode;
        signal?: AbortSignal;
    }): Promise<ModelResponse>;
    /** Optional tool-free summary of historical dialogue during context compaction. */
    summarizeContext?(input: { task: string; dialogue: string; signal?: AbortSignal }): Promise<string>;
}

export interface ToolRegistry {
    listTools(): Promise<AgentTool[]>;
    callTool(input: {
        name: string;
        arguments: JsonObject;
        /** Provider-generated ID for exact recovery of local durable tools. */
        callId?: string;
    }): Promise<AgentToolResult>;
}

/** Run-scoped store for the exact model-facing text of oversized tool results. */
export interface AgentToolResultArchive {
    save(input: { runId: string; callId: string; toolName: string; payload: string }): Promise<void>;
    read(input: { runId: string; callId: string; offset: number; limit: number }): Promise<{
        payload: string; totalChars: number; nextOffset: number | null;
    } | null>;
}

export interface ToolApprovalRequest {
    runId: string;
    tool: AgentTool;
    arguments: JsonObject;
}

export interface AgentPolicy {
    approveWrite(request: ToolApprovalRequest): Promise<boolean>;
    createRunPolicy?(input: { runId: string; mode: AgentMode; task: string }): AgentRunPolicy;
}

export interface AgentPolicyToolContext {
    tool: AgentTool;
    arguments: JsonObject;
    receipts: AgentReceipt[];
    availableTools: AgentTool[];
}

export type AgentPolicyToolDecision =
    | { action: 'allow' }
    | { action: 'block'; code: string; message: string; continue: boolean; reason?: string };

export type AgentPolicyStopDecision =
    | { action: 'continue'; message: string }
    | { action: 'finish'; reason: string; finalText?: string | null };

export interface AgentGoalCriterion {
    id: string;
    description: string;
    requiredTools: string[];
    toolMatch?: 'all' | 'any';
    receiptRequirement?: string;
    /** Host-bound target/query, persisted with the criterion; never inferred from a write receipt. */
    expectation?: JsonObject;
}

export interface AgentGoal {
    taskId: string;
    criteria: AgentGoalCriterion[];
    maxContinuationAttempts?: number;
}

/** Per-run product policy. The kernel only orchestrates these generic hooks. */
export interface AgentRunPolicy {
    systemPrompt?: string;
    filterTools?(tools: AgentTool[], mode: AgentMode): AgentTool[];
    beforeTool?(context: AgentPolicyToolContext): Promise<AgentPolicyToolDecision> | AgentPolicyToolDecision;
    normalizeResult?(tool: AgentTool, result: AgentToolResult): AgentToolResult;
    afterTool?(receipt: AgentReceipt, toolArguments: JsonObject): Promise<void> | void;
    onAssistantMessage?(message: AssistantMessage, receipts: AgentReceipt[]): Promise<void> | void;
    onAssistantStop?(input: {
        message: AssistantMessage;
        finishReason: string | null;
        receipts: AgentReceipt[];
        availableTools: AgentTool[];
    }): Promise<AgentPolicyStopDecision | undefined> | AgentPolicyStopDecision | undefined;
    evaluateGoal?(input: { goal: AgentGoal; receipts: AgentReceipt[] }): Promise<{
        satisfied: boolean;
        outstanding: Array<{ id: string; description: string; missingTools: string[] }>;
    }> | { satisfied: boolean; outstanding: Array<{ id: string; description: string; missingTools: string[] }> };
    recoveryRequired?(): boolean;
    getFinalStatus?(reason: string): AgentRunStatus | undefined;
}

export interface ContextBudgetOptions {
    maxEstimatedTokens?: number;
    keepRecentMessages?: number;
    keepRecentToolInteractions?: number;
}

export interface OutstandingAcceptanceItem {
    key: string;
    kind: string;
    status: string;
    callId: string;
    toolName: string;
}

export interface CompactedToolInteraction {
    callId: string;
    resultCallId: string | null;
    pairStatus: 'matched' | 'missing' | 'ambiguous' | 'name-mismatch' | 'out-of-order';
    toolName: string;
    access: ToolAccess | 'unknown';
    operationIdentities: string[];
    acceptance: string[];
    receiptSummary: string;
}

export interface UnpairedToolResult {
    resultCallId: string;
    toolName: string;
    reason: 'missing-call' | 'ambiguous-call' | 'name-mismatch' | 'out-of-order';
    receiptSummary: string;
}

export interface ContextCompactionReport {
    maxEstimatedTokens: number;
    estimatedTokens: number;
    compacted: boolean;
    dialogueSummarySource: 'provider' | 'deterministic' | 'none';
    summarizedToolCalls: number;
    compactedToolResults: number;
    retainedToolCalls: number;
    operationIdentities: string[];
    outstandingAcceptance: OutstandingAcceptanceItem[];
    compactedInteractions: CompactedToolInteraction[];
    unpairedToolResults: UnpairedToolResult[];
}

export type AgentEvent =
    | { type: 'run.started'; runId: string; mode: AgentMode }
    | { type: 'model.requested'; runId: string; round: number }
    | { type: 'model.responded'; runId: string; round: number; toolCount: number }
    | { type: 'context.compacted'; runId: string; round: number; report: ContextCompactionReport }
    | { type: 'context.budget-exceeded'; runId: string; round: number; report: ContextCompactionReport }
    | { type: 'tool.approval-required'; request: ToolApprovalRequest }
    | { type: 'tool.started'; runId: string; callId: string; tool: AgentTool; arguments?: JsonObject }
    | { type: 'tool.finished'; runId: string; callId: string; tool: AgentTool; result: AgentToolResult }
    | { type: 'todo.updated'; runId: string; items: AgentTodoItem[] }
    | { type: 'goal.evaluated'; runId: string; taskId: string; satisfied: boolean; outstanding: Array<{ id: string; description: string; missingTools: string[] }>; continuationAttempt: number; maxContinuationAttempts: number }
    | { type: 'run.finished'; runId: string; status: AgentRunStatus; reason: string; executionChecklist: AgentTodoItem[] };

export type AgentTodoStatus = 'pending' | 'in_progress' | 'completed';
export interface AgentTodoItem { id: string; content: string; status: AgentTodoStatus }

export type AgentRunStatus = 'completed' | 'stopped' | 'awaiting-approval' | 'needs-review' | 'cancelled';

export interface AgentReceipt {
    callId: string;
    toolName: string;
    access: ToolAccess;
    role: ToolRole;
    result: AgentToolResult;
}

export type AgentLifecycleEvent = 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop';
export interface AgentLifecycleInputs {
    UserPromptSubmit: { runId: string; mode: AgentMode; task: string; history: AgentMessage[] };
    PreToolUse: { runId: string; tool: AgentTool; arguments: JsonObject };
    PostToolUse: { runId: string; tool: AgentTool; arguments: JsonObject; result: AgentToolResult; receipt: AgentReceipt };
    Stop: { runId: string; mode: AgentMode; task: string; reason: string; messages: AgentMessage[]; receipts: AgentReceipt[] };
}
export interface AgentLifecycleResults {
    UserPromptSubmit: string | void;
    PreToolUse: string | void;
    PostToolUse: void;
    Stop: { action: 'continue'; message: string } | { action: 'finish' } | void;
}

export interface AgentRunResult {
    runId: string;
    mode: AgentMode;
    status: AgentRunStatus;
    reason: string;
    finalText: string | null;
    receipts: AgentReceipt[];
    messages: AgentMessage[];
    contextCompactions: ContextCompactionReport[];
    executionChecklist: AgentTodoItem[];
    goalEvaluation?: { satisfied: boolean; outstanding: Array<{ id: string; description: string; missingTools: string[] }> };
}

export interface AgentHooks {
    beforeTool?(tool: AgentTool, args: JsonObject): Promise<string | null | undefined> | string | null | undefined;
    afterTool?(tool: AgentTool, args: JsonObject, result: AgentToolResult): Promise<void> | void;
    onEvent?(event: AgentEvent): Promise<void> | void;
}

export interface AgentKernelOptions {
    provider: ModelProvider;
    tools: ToolRegistry;
    policy: AgentPolicy;
    hooks?: AgentHooks;
    lifecycleHooks?: AgentLifecycleHookRegistry;
    maxTurns?: number;
    maxToolCalls?: number;
    contextBudget?: ContextBudgetOptions;
    toolResultArchive?: AgentToolResultArchive;
    toolResultArchiveThreshold?: number;
    systemPrompt: string;
}

export interface AgentLifecycleHookRegistry {
    register<E extends AgentLifecycleEvent>(event: E,
        handler: (input: AgentLifecycleInputs[E]) => AgentLifecycleResults[E] | Promise<AgentLifecycleResults[E]>): () => void;
    dispatch<E extends AgentLifecycleEvent>(event: E, input: AgentLifecycleInputs[E], stopOnResult?: boolean): Promise<Array<AgentLifecycleResults[E]>>;
}

export interface RunAgentInput {
    runId?: string;
    task: string;
    mode: AgentMode;
    history?: AgentMessage[];
    signal?: AbortSignal;
    goal?: AgentGoal;
}
