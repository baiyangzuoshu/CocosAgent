import {
  ToolArgsError,
  ToolOutputError,
  validateJsonSchemaValue,
} from "./schema.ts";
import type { ToolCall, ToolDefinition, ToolExecutionResult } from "./types.ts";
import { ToolRegistry } from "./tool-registry.ts";

/** A small analogue of the registry's validate → dispatch → normalize path. */
export class ToolExecutionPipeline {
  constructor(private readonly registry: ToolRegistry) {}

  async execute(call: ToolCall): Promise<ToolExecutionResult> {
    const tool = this.registry.get(call.name);
    if (tool === undefined) {
      return failure("UNKNOWN_TOOL", `unknown tool: ${call.name}`);
    }

    let args: unknown;
    try {
      args = freezeJson(snapshotJson(call.arguments));
    } catch (error: unknown) {
      return failure("INVALID_ARGS", errorMessage(error));
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = tool.timeoutMs === undefined ? undefined : setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("tool deadline reached"));
    }, tool.timeoutMs);

    try {
      const value = await tool.execute(args, { signal: controller.signal });
      if (timedOut) {
        return failure(
          "TOOL_TIMEOUT",
          `tool call timed out after ${tool.timeoutMs}ms`,
        );
      }

      let stableValue: unknown;
      try {
        stableValue = snapshotJson(value);
      } catch (error: unknown) {
        throw new ToolOutputError(tool.name, [errorMessage(error)]);
      }
      const violations = validateJsonSchemaValue(
        tool.output.schema,
        stableValue,
        "value",
      );
      if (violations.length > 0) {
        throw new ToolOutputError(tool.name, violations);
      }

      const rendered = tool.output.render(args, stableValue);
      return {
        isError: false,
        value: stableValue,
        content: [{ type: "text", text: rendered }],
      };
    } catch (error: unknown) {
      if (timedOut) {
        return failure(
          "TOOL_TIMEOUT",
          `tool call timed out after ${tool.timeoutMs}ms`,
        );
      }
      const code =
        error instanceof ToolArgsError || error instanceof ToolOutputError
          ? error.code
          : "UNKNOWN";
      return failure(code, errorMessage(error));
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

function snapshotJson(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("value must be JSON-serializable");
  }
  return JSON.parse(serialized);
}

function freezeJson<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function failure(code: string, message: string): ToolExecutionResult {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
    error: { code, message },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { ToolDefinition };
