export type ParameterType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";
export type JsonScalar = string | number | boolean | null;

export interface JsonSchema {
  readonly type: ParameterType;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchema;
  readonly enum?: readonly JsonScalar[];
}

export interface ParameterField {
  readonly type: Exclude<ParameterType, "object"> | "object";
  readonly description?: string;
  readonly required?: true;
  readonly enum?: readonly JsonScalar[];
  readonly items?: JsonSchema;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly additionalProperties?: boolean;
}

export type ParameterSchemaSpec = Readonly<Record<string, ParameterField>>;

export interface ToolRunContext {
  readonly signal: AbortSignal;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
  readonly output: {
    readonly schema: JsonSchema;
    render(args: unknown, value: unknown): string;
  };
  readonly timeoutMs?: number;
  execute(args: unknown, context: ToolRunContext): Promise<unknown>;
}

export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: ParameterSchemaSpec;
  readonly output: ToolDefinition["output"];
  readonly timeoutMs?: number;
  execute(args: unknown, context: ToolRunContext): Promise<unknown>;
}

export interface ToolCall {
  readonly name: string;
  readonly arguments: unknown;
}

export interface TextContent {
  readonly type: "text";
  readonly text: string;
}

export type ToolExecutionResult =
  | {
    readonly isError: false;
    readonly content: readonly TextContent[];
    readonly value: unknown;
  }
  | {
    readonly isError: true;
    readonly content: readonly TextContent[];
    readonly error: { readonly code: string; readonly message: string };
  };
