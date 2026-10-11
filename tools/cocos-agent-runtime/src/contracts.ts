export type AgentMode = 'Ask' | 'Plan' | 'Agent';
export type ToolAccess = 'read' | 'write';
export type ToolRole = 'setup' | 'task' | 'recovery';

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

export interface ToolApprovalRequest {
    runId: string;
    tool: AgentTool;
    arguments: JsonObject;
}

export interface AgentPolicy {
    approveWrite(request: ToolApprovalRequest): Promise<boolean>;
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
    | { type: 'tool.started'; runId: string; callId: string; tool: AgentTool }
    | { type: 'tool.finished'; runId: string; callId: string; tool: AgentTool; result: AgentToolResult }
    | { type: 'run.finished'; runId: string; status: AgentRunStatus; reason: string };

export type AgentRunStatus = 'completed' | 'stopped' | 'awaiting-approval' | 'needs-review' | 'cancelled';

export interface AgentReceipt {
    callId: string;
    toolName: string;
    access: ToolAccess;
    role: ToolRole;
    result: AgentToolResult;
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
    maxTurns?: number;
    maxToolCalls?: number;
    contextBudget?: ContextBudgetOptions;
    systemPrompt: string;
}

export interface RunAgentInput {
    runId?: string;
    task: string;
    mode: AgentMode;
    history?: AgentMessage[];
    signal?: AbortSignal;
}
