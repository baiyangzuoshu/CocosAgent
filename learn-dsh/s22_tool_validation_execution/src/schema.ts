import type {
  JsonSchema,
  ParameterSchemaSpec,
  ToolDefinition,
  ToolSpec,
} from "./types.ts";

/** Compile the parameter property map; the root remains an open object. */
export function compileParameters(spec: ParameterSchemaSpec): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(spec)) {
    const { required: isRequired, ...schema } = field;
    properties[name] = structuredClone(schema);
    if (isRequired === true) required.push(name);
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/** Validate a JSON-like value and return path-qualified failures. */
export function validateJsonSchemaValue(
  schema: JsonSchema,
  value: unknown,
  path: string,
): string[] {
  const failures: string[] = [];
  validate(schema, value, path, failures);
  return failures;
}

function validate(
  schema: JsonSchema,
  value: unknown,
  path: string,
  failures: string[],
): void {
  switch (schema.type) {
    case "string":
      if (typeof value !== "string") failures.push(`${path} must be a string`);
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        failures.push(`${path} must be a finite number`);
      }
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        failures.push(`${path} must be an integer`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        failures.push(`${path} must be a boolean`);
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        failures.push(`${path} must be an array`);
        break;
      }
      if (schema.items !== undefined) {
        value.forEach((item, index) =>
          validate(schema.items!, item, `${path}.${index}`, failures)
        );
      }
      break;
    case "object":
      if (!isRecord(value)) {
        failures.push(`${path} must be an object`);
        break;
      }
      for (const key of schema.required ?? []) {
        if (!Object.hasOwn(value, key)) {
          failures.push(`${path}.${key} is required`);
        }
      }
      for (
        const [key, propertySchema] of Object.entries(schema.properties ?? {})
      ) {
        if (Object.hasOwn(value, key)) {
          validate(propertySchema, value[key], `${path}.${key}`, failures);
        }
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!Object.hasOwn(schema.properties ?? {}, key)) {
            failures.push(`${path}.${key} is not allowed`);
          }
        }
      }
      break;
  }

  if (
    failures.length === 0 && schema.enum !== undefined &&
    !schema.enum.some((item) => Object.is(item, value))
  ) {
    failures.push(`${path} must match one of the declared values`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class ToolArgsError extends Error {
  readonly code = "INVALID_ARGS";

  constructor(readonly violations: readonly string[]) {
    super(`invalid arguments: ${violations.join("; ")}`);
    this.name = "ToolArgsError";
  }
}

export class ToolOutputError extends Error {
  readonly code = "INVALID_OUTPUT";

  constructor(toolName: string, violations: readonly string[]) {
    super(`tool ${toolName} returned invalid output: ${violations.join("; ")}`);
    this.name = "ToolOutputError";
  }
}

/** Keep the schema check at the registered execute boundary. */
export function defineTool(spec: ToolSpec): ToolDefinition {
  const parameters = compileParameters(spec.parameters);
  const output = {
    schema: structuredClone(spec.output.schema),
    render: spec.output.render,
  };
  return {
    name: spec.name,
    description: spec.description,
    parameters,
    output,
    ...(spec.timeoutMs === undefined ? {} : { timeoutMs: spec.timeoutMs }),
    async execute(args, context) {
      const violations = validateJsonSchemaValue(parameters, args, "arguments");
      if (violations.length > 0) throw new ToolArgsError(violations);
      return spec.execute(args, context);
    },
  };
}
