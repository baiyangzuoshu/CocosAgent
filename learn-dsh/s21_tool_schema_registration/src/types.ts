export type ParameterType = "string" | "number" | "integer" | "boolean";

export interface ParameterField {
  readonly type: ParameterType;
  readonly required?: true;
  readonly description?: string;
  readonly enum?: readonly (string | number | boolean)[];
}

/** Parameter map is an implicit object root; each field declares requiredness. */
export type ParameterSchemaSpec = Readonly<Record<string, ParameterField>>;

export interface JsonSchema {
  readonly type: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly enum?: readonly (string | number | boolean)[];
  readonly items?: JsonSchema;
}

/** The allowlisted model-facing projection of a registered tool. */
export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
  readonly deferLoading?: true;
}

/** The runtime owns fields that are deliberately omitted from ToolSchema. */
export interface ToolDefinition extends ToolSchema {
  readonly output: {
    readonly schema: JsonSchema;
    render(value: unknown): string;
  };
  readonly execute: (args: unknown) => Promise<unknown>;
  readonly timeoutMs?: number;
}

export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: ParameterSchemaSpec;
  readonly output: ToolDefinition["output"];
  readonly execute: ToolDefinition["execute"];
  readonly deferLoading?: true;
  readonly timeoutMs?: number;
}
