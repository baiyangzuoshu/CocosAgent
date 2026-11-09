import type {
  HarnessToolDefinition,
  JsonRecord,
  McpClient,
  McpTool,
} from "./types.ts";
import { ToolRegistry } from "./tool-registry.ts";

export interface McpBridgeConnection {
  readonly publicNames: readonly string[];
  dispose(): void;
}

/** Discover one server's tools and publish them in the Harness tool registry. */
export async function connectMcpServer(
  client: McpClient,
  registry: ToolRegistry,
  serverName: string,
): Promise<McpBridgeConnection> {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(serverName)) {
    throw new Error(`Invalid MCP server namespace: ${serverName}`);
  }

  const remoteTools = await client.listTools();
  const rawNames = new Set<string>();
  const definitions: HarnessToolDefinition[] = [];
  for (const remoteTool of remoteTools) {
    validateRemoteTool(remoteTool);
    if (rawNames.has(remoteTool.name)) {
      throw new Error(`MCP server listed duplicate tool: ${remoteTool.name}`);
    }
    rawNames.add(remoteTool.name);

    const publicName = `mcp__${serverName}__${remoteTool.name}`;
    if (publicName.length > 64) {
      throw new Error(`Public tool name is too long: ${publicName}`);
    }
    definitions.push(adaptTool(publicName, remoteTool, client));
  }

  const unregister: Array<() => void> = [];
  try {
    for (const definition of definitions) {
      unregister.push(registry.register(definition));
    }
  } catch (error) {
    for (const dispose of unregister.reverse()) dispose();
    throw error;
  }

  let connected = true;
  return {
    publicNames: definitions.map(({ name }) => name),
    dispose() {
      if (!connected) return;
      connected = false;
      for (const dispose of unregister.reverse()) dispose();
    },
  };
}

function adaptTool(
  publicName: string,
  remoteTool: McpTool,
  client: McpClient,
): HarnessToolDefinition {
  return {
    name: publicName,
    description: remoteTool.description ?? "",
    parameters: remoteTool.inputSchema,
    async execute(args: JsonRecord) {
      // Keep the original MCP name in this closure; never parse it from publicName.
      const result = await client.callTool({
        name: remoteTool.name,
        arguments: args,
      });
      return {
        content: result.content.map(({ text }) => text).join("\n"),
        isError: result.isError === true,
        ...(result.structuredContent === undefined
          ? {}
          : { structuredContent: result.structuredContent }),
      };
    },
  };
}

function validateRemoteTool(tool: McpTool): void {
  if (!/^[A-Za-z0-9_-]+$/.test(tool.name)) {
    throw new Error(
      `This lesson expects a constrained MCP tool name: ${tool.name}`,
    );
  }
  if (tool.inputSchema.type !== "object") {
    throw new Error(`MCP input schema must be an object: ${tool.name}`);
  }
}
