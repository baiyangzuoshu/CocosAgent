import type {
    AgentTool,
    AgentToolResult,
    JsonObject,
    ToolContentBlock,
    ToolRegistry,
} from './contracts.js';

const MAX_TOOL_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOOL_IMAGE_BASE64_CHARS = Math.ceil(MAX_TOOL_IMAGE_BYTES * 4 / 3) + 8;

export interface McpToolClassification {
    access: AgentTool['access'];
    role: AgentTool['role'];
}

export interface McpClientPort {
    listTools(): Promise<unknown>;
    callTool(input: { name: string; arguments: JsonObject }): Promise<unknown>;
}

export class McpToolRegistry implements ToolRegistry {
    constructor(
        private readonly client: McpClientPort,
        private readonly classify: (name: string, definition: JsonObject) => McpToolClassification,
    ) {}

    async listTools(): Promise<AgentTool[]> {
        const response = await this.client.listTools();
        if (!isRecord(response) || !Array.isArray(response.tools)) {
            throw new TypeError('MCP tools/list returned an invalid catalog.');
        }
        const seen = new Set<string>();
        return response.tools.map((value) => {
            if (!isRecord(value) || typeof value.name !== 'string' || !value.name
                || typeof value.description !== 'string' || !isRecord(value.inputSchema)) {
                throw new TypeError('MCP tool definition is incomplete.');
            }
            if (seen.has(value.name)) throw new TypeError(`MCP tool catalog contains duplicate name ${value.name}.`);
            seen.add(value.name);
            const classification = this.classify(value.name, value);
            if (!['read', 'write'].includes(classification.access)
                || !['setup', 'task', 'recovery'].includes(classification.role)) {
                throw new TypeError(`Local classification is invalid for MCP tool ${value.name}.`);
            }
            return {
                name: value.name,
                description: value.description,
                inputSchema: value.inputSchema,
                access: classification.access,
                role: classification.role,
            };
        });
    }

    async callTool(input: { name: string; arguments: JsonObject; callId?: string }): Promise<AgentToolResult> {
        const value: unknown = await this.client.callTool({ name: input.name, arguments: input.arguments });
        if (!isRecord(value)) throw new TypeError('MCP tools/call returned an invalid result.');
        const result: AgentToolResult = {};
        if (value.isError === true) result.isError = true;
        if (isRecord(value.structuredContent)) result.structuredContent = value.structuredContent;
        if (Array.isArray(value.content)) {
            const blocks: ToolContentBlock[] = [];
            for (const block of value.content) {
                if (!isRecord(block)) continue;
                if (block.type === 'text' && typeof block.text === 'string') {
                    blocks.push({ type: 'text', text: block.text });
                    continue;
                }
                if (block.type === 'image' && typeof block.mimeType === 'string' && typeof block.data === 'string'
                    && isSupportedImage(block.mimeType, block.data)) {
                    blocks.push({ type: 'image', mimeType: block.mimeType, data: block.data });
                }
            }
            result.content = blocks;
        }
        return result;
    }
}

function isSupportedImage(mimeType: string, data: string): boolean {
    if (typeof mimeType !== 'string' || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
        || typeof data !== 'string' || data.length === 0 || data.length > MAX_TOOL_IMAGE_BASE64_CHARS
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return false;
    return atob(data).length <= MAX_TOOL_IMAGE_BYTES;
}

function isRecord(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
