import type { AgentTodoItem, AgentTodoStatus, AgentTool, AgentToolResult, JsonObject } from './contracts.js';

export const AGENT_TODO_TOOL: AgentTool = {
    name: 'agent_todo_write',
    description: 'Create or replace the current run execution checklist. Use only for task progress; this does not approve or perform project changes.',
    inputSchema: {
        type: 'object', additionalProperties: false, required: ['items'],
        properties: { items: { type: 'array', maxItems: 20, items: {
            type: 'object', additionalProperties: false, required: ['content', 'status'],
            properties: { content: { type: 'string', minLength: 1, maxLength: 240 },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] } },
        } } },
    },
    access: 'read',
    role: 'todo',
};

export function updateExecutionChecklist(current: AgentTodoItem[], args: JsonObject): {
    items: AgentTodoItem[]; result: AgentToolResult;
} {
    if (!Array.isArray(args.items) || args.items.length > 20 || Object.keys(args).some((key) => key !== 'items')) {
        return invalid(current, 'items must contain at most 20 checklist entries and no extra fields.');
    }
    const items: AgentTodoItem[] = [];
    let inProgress = 0;
    const used = new Set<string>();
    for (let index = 0; index < args.items.length; index += 1) {
        const value = args.items[index];
        if (!isRecord(value) || Object.keys(value).some((key) => key !== 'content' && key !== 'status')
            || typeof value.content !== 'string' || !value.content.trim()
            || value.content.length > 240 || !isStatus(value.status)) {
            return invalid(current, `items[${index}] must have non-empty content (max 240 chars) and a valid status.`);
        }
        if (value.status === 'in_progress') inProgress += 1;
        const previous = current.find((item) => item.content === value.content && !used.has(item.id));
        let id = previous?.id || `todo-${index + 1}`;
        while (used.has(id)) id = `${id}-${index + 1}`;
        used.add(id);
        items.push({ id, content: value.content.trim(), status: value.status });
    }
    if (inProgress > 1) return invalid(current, 'At most one checklist entry may be in_progress.');
    return { items, result: { structuredContent: { success: true, updated: true, itemCount: items.length,
        completedCount: items.filter((item) => item.status === 'completed').length,
        executionChecklist: items }, content: [{ type: 'text', text: render(items) }] } };
}

export function todoToolResultError(message: string): AgentToolResult {
    return { isError: true, structuredContent: { success: false, error: { code: 'INVALID_EXECUTION_CHECKLIST', message } } };
}

function invalid(current: AgentTodoItem[], message: string): { items: AgentTodoItem[]; result: AgentToolResult } {
    return { items: current, result: todoToolResultError(message) };
}
function isRecord(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isStatus(value: unknown): value is AgentTodoStatus { return value === 'pending' || value === 'in_progress' || value === 'completed'; }
function render(items: AgentTodoItem[]): string {
    const mark = (status: AgentTodoStatus) => status === 'completed' ? '[x]' : status === 'in_progress' ? '[>]' : '[ ]';
    return items.map((item) => `${mark(item.status)} ${item.content}`).join('\n');
}
