import type { JsonRecord, McpClient, McpTool, McpToolResult } from "./types.ts";

/** In-process fixture whose methods model MCP tools/list and tools/call. */
export class LocalNotesMcpServer implements McpClient {
  readonly requests: string[] = [];

  async listTools(): Promise<readonly McpTool[]> {
    this.requests.push("tools/list");
    return [{
      name: "search_notes",
      description: "Search course notes by a filename fragment.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Filename fragment." },
        },
        required: ["query"],
      },
    }];
  }

  async callTool(request: {
    readonly name: string;
    readonly arguments: JsonRecord;
  }): Promise<McpToolResult> {
    this.requests.push(`tools/call name=${request.name}`);
    if (request.name !== "search_notes") {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown MCP tool: ${request.name}` }],
      };
    }

    const query = request.arguments.query;
    if (typeof query !== "string" || query.length === 0) {
      return {
        isError: true,
        content: [{ type: "text", text: "query must be a non-empty string" }],
      };
    }

    const notes = ["cache-design.md", "tool-loop.md", "session-history.md"];
    const matches = notes.filter((note) => note.includes(query));
    return {
      content: [{
        type: "text",
        text: matches.length > 0 ? matches.join(", ") : "No matching notes.",
      }],
      structuredContent: { query, matches },
    };
  }
}
