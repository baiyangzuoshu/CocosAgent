import type { AgentMode, AgentTool, AgentToolResult, JsonObject, ToolRegistry } from './contracts.js';

const LOAD = 'cocos_2x_tools_load';
const COMMAND = 'cocos_2x_command_execute';
const COMMON = new Set(['cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read',
    'cocos_2x_project_instructions_read', 'cocos_2x_project_skills_list', 'cocos_2x_project_tools_list']);
const GROUPS: Record<string, { tools: string[]; commands: string[] }> = {
    scene: { tools: ['scene_snapshot', 'scene_node_inspect', 'asset_search_png', 'operation_get', 'operation_reconcile',
        'operation_preview_accept', 'workflow_plan', 'workflow_execute', 'workflow_get', 'workflow_compensate', 'workflow_replay'],
    commands: ['scene.node.create', 'scene.node.patch', 'scene.pngSprite'] },
    script: { tools: ['project_search', 'script_read', 'script_patch_plan', 'script_patch', 'script_operation_get',
        'script_create_reconcile', 'scene_snapshot', 'scene_node_inspect', 'operation_get', 'operation_preview_accept'],
    commands: ['script.create', 'scene.node.create'] },
    prefab: { tools: ['project_search', 'scene_snapshot', 'scene_node_inspect', 'operation_get', 'operation_reconcile', 'operation_preview_accept'],
    commands: ['prefab.source.inspect', 'prefab.source.patch', 'scene.node.create', 'scene.node.patch'] },
    assets: { tools: ['asset_search_png', 'asset_validate_png', 'scene_snapshot', 'scene_node_inspect', 'assets_scene_*',
        'operation_get', 'operation_reconcile', 'operation_preview_accept'],
    commands: ['asset.importPng', 'asset.removeImportedPng', 'asset.validatePng', 'asset.refreshPng', 'asset.refreshFolder', 'scene.pngSprite', 'scene.node.create'] },
    runtime: { tools: ['runtime_observe', 'runtime_interact', 'scene_snapshot', 'scene_node_inspect', 'script_read',
        'script_patch_plan', 'script_patch', 'script_operation_get', 'operation_get', 'operation_preview_accept'],
    commands: ['runtime.preview.start'] },
    content: { tools: ['content_from_scene_*', 'content_bundle_*', 'content_get', 'content_select', 'content_rollback', 'bundle_dependencies_*'], commands: [] },
    build: { tools: ['content_build_*', 'content_preview_*', 'content_get'], commands: [] },
    performance: { tools: ['content_stress_run', 'content_build_get', 'content_preview_get', 'content_get', 'runtime_observe'], commands: [] },
    project: { tools: ['project_search', 'project_instructions_read', 'project_skills_list', 'project_skill_read', 'project_tools_list',
        'project_tool_read', 'project_tool_write'], commands: [] },
    memory: { tools: ['memory_*'], commands: [] },
};
const SKILL_GROUPS: Record<string, string[]> = {
    'cocos2-scene-composition': ['scene'], 'cocos2-scene-node-operations': ['scene'],
    'cocos2-script-development': ['script', 'project'], 'cocos2-project-development': ['script', 'project'],
    'cocos2-prefab-workflows': ['prefab'], 'cocos2-prefab-source-edit': ['prefab'],
    'cocos2-resource-scene-pipeline': ['assets'], 'cocos2-runtime-observation': ['runtime'],
    'cocos2-asset-bundle-content': ['content'], 'cocos2-content-build': ['build'],
    'cocos2-dynamic-content-performance': ['performance'], 'cocos2-runtime-performance': ['performance'],
    'cocos2-project-extensions': ['project'],
};
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const failure = (code: string): AgentToolResult => ({ isError: true, structuredContent: { success: false, error: { code, sideEffect: 'none' } } });

function commandBranches(tool: AgentTool): Array<{ id: string; schema: JsonObject }> {
    const schema = tool.inputSchema;
    if (!Array.isArray(schema.oneOf)) return [];
    return schema.oneOf.flatMap((value) => {
        const branch = object(value), command = object(object(branch.properties).command);
        return typeof command.const === 'string' ? [{ id: command.const, schema: branch }] : [];
    });
}

/** The complete registry remains authoritative. Only its model-facing projection is narrowed. */
export class CreatorToolLoader implements ToolRegistry {
    private readonly selected = new Set(COMMON);
    private readonly commands = new Set<string>();
    private readonly offered = new Set<string>();
    private offeredCommands = new Set<string>();
    private recoveryOnly = false;
    readonly tool: AgentTool = {
        name: LOAD, access: 'read', role: 'setup',
        description: 'Load task tools for the next response. Reading a matching installed skill automatically loads its task group. Use groups for related tools, exact toolNames/commands for a narrow extension, or list=true for catalog metadata. Loading grants no write permission; Ask/Plan remain read-only. Commands need exact IDs; their original input schema is supplied next round.',
        inputSchema: { type: 'object', properties: {
            groups: { type: 'array', items: { type: 'string', enum: Object.keys(GROUPS) }, maxItems: 10, uniqueItems: true },
            toolNames: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 128 }, maxItems: 32, uniqueItems: true },
            commands: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, maxItems: 24, uniqueItems: true },
            list: { type: 'boolean' },
        }, additionalProperties: false },
    };

    constructor(private readonly inner: ToolRegistry, seedTools: string[] = [],
        private readonly onLoad?: (event: JsonObject) => void,
        private readonly mode: AgentMode = 'Agent', private readonly catalog: AgentTool[] = [], preparedSkillCatalog = false) {
        for (const name of seedTools) if (name !== COMMAND) this.selected.add(name);
        if (preparedSkillCatalog) this.selected.delete('cocos_2x_skills_list');
    }

    async listTools(): Promise<AgentTool[]> { return [...await this.inner.listTools(), this.tool]; }

    filterTools(available: AgentTool[], recoveryOnly = false): AgentTool[] {
        this.recoveryOnly = recoveryOnly;
        const result: AgentTool[] = [];
        this.offered.clear();
        this.offeredCommands.clear();
        for (const tool of available) {
            if (this.mode !== 'Agent' && tool.access !== 'read') continue;
            if (recoveryOnly && tool.role !== 'recovery') continue;
            if (!recoveryOnly && tool.name !== LOAD && !this.selected.has(tool.name)
                && !['todo', 'context', 'task-system'].includes(tool.role) && tool.name !== COMMAND) continue;
            if (tool.name === COMMAND && !recoveryOnly) {
                const branches = commandBranches(tool).filter((branch) => this.commands.has(branch.id));
                if (!branches.length) continue;
                result.push({ ...tool, inputSchema: { ...tool.inputSchema, oneOf: branches.map((branch) => branch.schema) } });
                this.offeredCommands = new Set(branches.map((branch) => branch.id));
            } else result.push(tool);
            this.offered.add(tool.name);
        }
        return result;
    }

    /** Seed groups only from skill reads that the Host already verified in this run. */
    seedVerifiedSkills(skillNames: string[]): void {
        const verified = [...new Set(skillNames.filter((name) => Object.hasOwn(SKILL_GROUPS, name)))];
        const groups = [...new Set(verified.flatMap((name) => SKILL_GROUPS[name] || []))];
        if (!groups.length) return;
        this.selectGroups(groups, this.catalog);
        this.onLoad?.({ source: 'host-verified-skill', skillNames: verified, groups,
            selectedToolCount: this.selected.size, selectedCommands: [...this.commands] });
    }

    async callTool(input: { name: string; arguments: JsonObject; callId?: string }): Promise<AgentToolResult> {
        if (!this.offered.has(input.name)) return failure('TOOL_NOT_LOADED');
        if (input.name === LOAD) {
            if (this.recoveryOnly) return failure('PROJECT_RECOVERY_REQUIRED');
            return this.load(input.arguments);
        }
        if (input.name === COMMAND && !this.recoveryOnly && !this.offeredCommands.has(String(input.arguments.command))) {
            return failure('COMMAND_NOT_LOADED');
        }
        const result = await this.inner.callTool(input);
        if (input.name === 'cocos_2x_skill_read' && !result.isError && result.structuredContent?.success === true) {
            const skill = result.structuredContent.skillName;
            if (typeof skill === 'string') {
                const groups = Object.hasOwn(SKILL_GROUPS, skill) ? SKILL_GROUPS[skill]! : [];
                const tools = this.mergeCatalog(await this.inner.listTools());
                this.selectGroups(groups, tools);
                if (groups.length) this.onLoad?.({ source: 'verified-skill', skillName: skill, groups,
                    selectedToolCount: this.selected.size, selectedCommands: [...this.commands] });
                if (groups.length && this.mode === 'Plan') return { ...result,
                    structuredContent: { ...result.structuredContent, planningToolSchemas: this.planningSchemas(tools) } };
            }
        }
        return result;
    }

    private mergeCatalog(tools: AgentTool[]): AgentTool[] {
        return [...new Map([...this.catalog, ...tools].map((tool) => [tool.name, tool])).values()];
    }

    private planningSchemas(tools: AgentTool[]): JsonObject[] {
        const result: JsonObject[] = [];
        for (const tool of tools) {
            if (tool.name === COMMAND) {
                const branches = commandBranches(tool).filter((branch) => this.commands.has(branch.id));
                if (branches.length) result.push({ name: tool.name, access: tool.access,
                    inputSchema: { ...tool.inputSchema, oneOf: branches.map((branch) => branch.schema) } });
                continue;
            }
            if (this.selected.has(tool.name) && tool.access === 'write') result.push({ name: tool.name,
                access: tool.access, description: tool.description, inputSchema: tool.inputSchema });
        }
        return result;
    }

    private selectGroups(groups: string[], tools: AgentTool[]): void {
        for (const group of groups) {
            const entry = GROUPS[group];
            if (!entry) continue;
            for (const tool of tools) if (entry.tools.some((pattern) => pattern.endsWith('*')
                ? tool.name.startsWith('cocos_2x_' + pattern.slice(0, -1)) : tool.name === 'cocos_2x_' + pattern)) this.selected.add(tool.name);
            for (const command of entry.commands) this.commands.add(command);
        }
    }

    private async load(args: JsonObject): Promise<AgentToolResult> {
        if (!args || typeof args !== 'object' || Array.isArray(args)
            || Object.keys(args).some((key) => !['groups', 'toolNames', 'commands', 'list'].includes(key))
            || args.list !== undefined && typeof args.list !== 'boolean') return failure('TOOL_LOAD_INPUT_INVALID');
        const arrays: Record<string, string[]> = {};
        for (const [key, limit] of [['groups', 10], ['toolNames', 32], ['commands', 24]] as const) {
            const value = args[key] === undefined ? [] : args[key];
            if (!Array.isArray(value) || value.length > limit || value.some((item) => typeof item !== 'string' || !item || item.length > 128)
                || new Set(value).size !== value.length) return failure('TOOL_LOAD_INPUT_INVALID');
            arrays[key] = value as string[];
        }
        const tools = this.mergeCatalog(await this.inner.listTools());
        const names = new Set(tools.map((tool) => tool.name));
        const commandTool = tools.find((tool) => tool.name === COMMAND);
        const commandIds = commandTool ? commandBranches(commandTool).map((branch) => branch.id) : [];
        const groups = arrays.groups!, toolNames = arrays.toolNames!, commands = arrays.commands!;
        if (groups.some((group) => !Object.hasOwn(GROUPS, group)) || toolNames.some((name) => !names.has(name))
            || commands.some((command) => !commandIds.includes(command))) return failure('TOOL_LOAD_NOT_IN_CATALOG');
        if (toolNames.includes(COMMAND) && !commands.length && !groups.some((group) => GROUPS[group]!.commands.length)) {
            return failure('COMMAND_SELECTION_REQUIRED');
        }
        this.selectGroups(groups, tools);
        for (const name of toolNames) this.selected.add(name);
        for (const command of commands) this.commands.add(command);
        this.onLoad?.({ source: 'model-requested', groups, toolNames, commands });
        return { structuredContent: { success: true, data: {
            loadedToolNames: [...this.selected].filter((name) => names.has(name)), loadedCommands: [...this.commands].filter((id) => commandIds.includes(id)),
            ...(this.mode === 'Plan' ? { planningToolSchemas: this.planningSchemas(tools) } : {}),
            ...(args.list === true ? { groups: Object.keys(GROUPS), tools: tools.map((tool) => ({
                name: tool.name, access: tool.access,
            })), commands: commandIds } : {}),
        } } };
    }
}
