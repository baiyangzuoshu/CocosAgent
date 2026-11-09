import type {
  JsonSchema,
  ParameterSchemaSpec,
  ToolDefinition,
  ToolSpec,
} from "./types.ts";

/** Compile the author-facing property map into the model-facing object schema. */
export function compileParameters(spec: ParameterSchemaSpec): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(spec)) {
    const { required: isRequired, ...schema } = field;
    properties[name] = { ...schema };
    if (isRequired === true) required.push(name);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/** Build the registered definition while keeping runtime callbacks local. */
export function defineTool(spec: ToolSpec): ToolDefinition {
  if (spec.name.length === 0) throw new Error("tool name must not be empty");
  if (spec.description.length === 0) {
    throw new Error(`tool ${spec.name} needs a description`);
  }
  if (
    spec.timeoutMs !== undefined &&
    (!Number.isFinite(spec.timeoutMs) || spec.timeoutMs <= 0)
  ) {
    throw new Error(
      `tool ${spec.name} timeout must be a positive finite number`,
    );
  }

  return {
    name: spec.name,
    description: spec.description,
    parameters: compileParameters(spec.parameters),
    output: {
      schema: structuredClone(spec.output.schema),
      render: spec.output.render,
    },
    execute: spec.execute,
    ...(spec.deferLoading === true ? { deferLoading: true as const } : {}),
    ...(spec.timeoutMs === undefined ? {} : { timeoutMs: spec.timeoutMs }),
  };
}
