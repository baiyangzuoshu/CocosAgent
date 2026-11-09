export type JsonRecord = Record<string, unknown>;

export interface McpTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface McpTextBlock {
  readonly type: "text";
  readonly text: string;
}

export interface McpToolResult {
  readonly content: readonly McpTextBlock[];
  readonly structuredContent?: JsonRecord;
  readonly isError?: boolean;
}

/** The local seam corresponding to MCP tools/list and tools/call. */
export interface McpClient {
  listTools(): Promise<readonly McpTool[]>;
  callTool(request: {
    readonly name: string;
    readonly arguments: JsonRecord;
  }): Promise<McpToolResult>;
}

export interface ModelToolSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface HarnessToolResult {
  readonly content: string;
  readonly isError: boolean;
  readonly structuredContent?: JsonRecord;
}

export interface HarnessToolDefinition extends ModelToolSchema {
  execute(args: JsonRecord): Promise<HarnessToolResult>;
}

export type ModelMessage =
  | { readonly role: "user"; readonly content: string }
  | {
    readonly role: "assistant";
    readonly content: string;
    readonly toolCall?: {
      readonly id: string;
      readonly name: string;
      readonly arguments: JsonRecord;
    };
  }
  | {
    readonly role: "tool";
    readonly name: string;
    readonly toolCallId: string;
    readonly content: string;
    readonly isError: boolean;
  };

export type ModelReply =
  | {
    readonly kind: "tool-call";
    readonly id: string;
    readonly name: string;
    readonly arguments: JsonRecord;
  }
  | { readonly kind: "final"; readonly content: string };
