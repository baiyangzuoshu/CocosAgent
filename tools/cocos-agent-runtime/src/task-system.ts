import type { AgentGoal, AgentGoalCriterion, AgentReceipt, AgentTool, AgentToolResult, JsonObject, ToolRegistry } from './contracts.js';

export type CreatorTaskStatus = 'pending' | 'in_progress' | 'completed';

export interface CreatorTaskCriterion extends AgentGoalCriterion {
    evidence: Array<{ callId: string; toolName: string }>;
    status: 'pending' | 'satisfied';
}

export type CriterionReceiptVerifier = (criterion: AgentGoalCriterion, receipt: AgentReceipt, receipts: AgentReceipt[]) => boolean;

function matchesCriterion(criterion: AgentGoalCriterion, receipt: AgentReceipt, receipts: AgentReceipt[], verifier?: CriterionReceiptVerifier): boolean {
    const toolMatches = criterion.requiredTools.includes(receipt.toolName)
        || (criterion.requiredTools.includes('*') && receipt.role === 'task');
    if (!toolMatches) return false;
    return criterion.receiptRequirement ? verifier?.(criterion, receipt, receipts) === true : successfulReceipt(receipt);
}

function criterionSatisfied(criterion: AgentGoalCriterion, evidence: Array<{ toolName: string }>): boolean {
    if (criterion.requiredTools.length === 0) return false;
    return criterion.toolMatch === 'any' ? evidence.length > 0
        : criterion.requiredTools.every((name) => name === '*' ? evidence.length > 0 : evidence.some((item) => item.toolName === name));
}

export interface CreatorTask {
    id: string;
    subject: string;
    description: string;
    status: CreatorTaskStatus;
    blockedBy: string[];
    acceptanceCriteria: CreatorTaskCriterion[];
    owner: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreatorTaskPersistence {
    load(): Promise<CreatorTask[]> | CreatorTask[];
    save(tasks: CreatorTask[]): Promise<void> | void;
}

const TASK_ID = /^task_[0-9a-f]{8}$/;
const MAX_TASKS = 100;
const MAX_CRITERIA = 64;
const MAX_TASK_TEXT = 1200;
const SENSITIVE_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})\b/gi;

function isRecord(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, max: number, code: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError(code);
    return value.trim().replace(SENSITIVE_VALUE, '[redacted]');
}

function cloneTask(task: CreatorTask): CreatorTask {
    return { ...task, blockedBy: [...task.blockedBy], acceptanceCriteria: task.acceptanceCriteria.map((criterion) => ({
        ...criterion, requiredTools: [...criterion.requiredTools], evidence: criterion.evidence.map((item) => ({ ...item })),
    })) };
}

function successfulReceipt(receipt: AgentReceipt): boolean {
    const data = receipt.result.structuredContent;
    return !receipt.result.isError && data?.success === true
        && !['needs-review', 'in-progress', 'needs-preview', 'pending'].includes(String(data.outcome || data.status || ''));
}

function taskSystemTools(): AgentTool[] {
    const schema = (properties: JsonObject, required: string[] = []): JsonObject => ({ type: 'object', properties, required, additionalProperties: false });
    return [
        { name: 'agent_task_list', description: 'List persistent Creator Agent tasks and their dependency/acceptance states.', inputSchema: schema({}), access: 'read', role: 'task-system' },
        { name: 'agent_task_get', description: 'Read one persistent Creator Agent task by its exact task ID.', inputSchema: schema({ taskId: { type: 'string', pattern: '^task_[0-9a-f]{8}$' } }, ['taskId']), access: 'read', role: 'task-system' },
        { name: 'agent_task_create', description: 'Create a project-scoped Agent task with explicit tool-receipt acceptance criteria and dependencies. This only changes the local Agent task graph, not Creator content.', inputSchema: schema({
            subject: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: 'string', minLength: 1, maxLength: MAX_TASK_TEXT },
            blockedBy: { type: 'array', maxItems: 20, items: { type: 'string', pattern: '^task_[0-9a-f]{8}$' } },
            acceptanceCriteria: { type: 'array', minItems: 1, maxItems: MAX_CRITERIA, items: { type: 'object', properties: {
                id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,64}$' }, description: { type: 'string', minLength: 1, maxLength: 300 },
                requiredTools: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 120 } },
            }, required: ['id', 'description', 'requiredTools'], additionalProperties: false } },
        }, ['subject', 'description', 'acceptanceCriteria']), access: 'read', role: 'task-system' },
        { name: 'agent_task_update', description: 'Update a pending task description or dependencies. Completion is computed from successful evidence and cannot be set manually.', inputSchema: schema({
            taskId: { type: 'string', pattern: '^task_[0-9a-f]{8}$' }, description: { type: 'string', minLength: 1, maxLength: MAX_TASK_TEXT },
            blockedBy: { type: 'array', maxItems: 20, items: { type: 'string', pattern: '^task_[0-9a-f]{8}$' } },
        }, ['taskId']), access: 'read', role: 'task-system' },
        { name: 'agent_task_claim', description: 'Claim a pending task whose dependencies are completed.', inputSchema: schema({ taskId: { type: 'string', pattern: '^task_[0-9a-f]{8}$' } }, ['taskId']), access: 'read', role: 'task-system' },
    ];
}

/** Project-scoped Task System. It stores task metadata only; Creator writes retain their own approvals and operation ledger. */
export class CreatorTaskSystem {
    private tasks: CreatorTask[] | null = null;

    constructor(private readonly persistence: CreatorTaskPersistence, private readonly verifyReceipt?: CriterionReceiptVerifier) {}

    private async current(): Promise<CreatorTask[]> {
        if (!this.tasks) {
            const loaded = await this.persistence.load();
            this.tasks = (Array.isArray(loaded) ? loaded : []).filter((task) => task && TASK_ID.test(task.id)
                && typeof task.subject === 'string' && Array.isArray(task.blockedBy) && Array.isArray(task.acceptanceCriteria))
                .slice(-MAX_TASKS).map(cloneTask);
        }
        return this.tasks;
    }

    async list(): Promise<CreatorTask[]> { return (await this.current()).map(cloneTask); }

    async get(taskId: string): Promise<CreatorTask | null> {
        const task = (await this.current()).find((item) => item.id === taskId);
        return task ? cloneTask(task) : null;
    }

    async create(input: { subject: unknown; description: unknown; blockedBy?: unknown; acceptanceCriteria: unknown }): Promise<CreatorTask> {
        const tasks = await this.current();
        if (tasks.length >= MAX_TASKS) throw new Error('TASK_LIMIT_REACHED');
        const subject = boundedText(input.subject, 160, 'TASK_SUBJECT_INVALID');
        const description = boundedText(input.description, MAX_TASK_TEXT, 'TASK_DESCRIPTION_INVALID');
        const blockedBy = this.validateDependencies(input.blockedBy ?? [], null, tasks);
        if (!Array.isArray(input.acceptanceCriteria) || input.acceptanceCriteria.length < 1 || input.acceptanceCriteria.length > MAX_CRITERIA) {
            throw new TypeError('TASK_CRITERIA_INVALID');
        }
        const ids = new Set<string>();
        const acceptanceCriteria = input.acceptanceCriteria.map((item): CreatorTaskCriterion => {
            if (!isRecord(item)) throw new TypeError('TASK_CRITERION_INVALID');
            const id = boundedText(item.id, 64, 'TASK_CRITERION_ID_INVALID');
            if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new TypeError('TASK_CRITERION_ID_DUPLICATE');
            ids.add(id);
            const criterionDescription = boundedText(item.description, 300, 'TASK_CRITERION_DESCRIPTION_INVALID');
            if (!Array.isArray(item.requiredTools) || item.requiredTools.length < 1 || item.requiredTools.length > 12
                || item.requiredTools.some((tool) => typeof tool !== 'string' || !tool.trim() || tool.length > 120)
                || new Set(item.requiredTools).size !== item.requiredTools.length) throw new TypeError('TASK_CRITERION_TOOLS_INVALID');
            if (item.toolMatch !== undefined && !['all', 'any'].includes(String(item.toolMatch))) throw new TypeError('TASK_CRITERION_MATCH_INVALID');
            if (item.receiptRequirement !== undefined && (typeof item.receiptRequirement !== 'string'
                || !/^[a-z0-9-]{1,64}$/.test(item.receiptRequirement))) throw new TypeError('TASK_CRITERION_REQUIREMENT_INVALID');
            return { id, description: criterionDescription, requiredTools: [...item.requiredTools] as string[],
                ...(item.expectation && isRecord(item.expectation) ? { expectation: structuredClone(item.expectation) } : {}),
                ...(item.toolMatch ? { toolMatch: item.toolMatch as 'all' | 'any' } : {}),
                ...(item.receiptRequirement ? { receiptRequirement: item.receiptRequirement as string } : {}),
                evidence: [], status: 'pending' };
        });
        const timestamp = new Date().toISOString();
        const task: CreatorTask = { id: `task_${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`,
            subject, description, status: 'pending', blockedBy, acceptanceCriteria, owner: null, createdAt: timestamp, updatedAt: timestamp };
        tasks.push(task);
        await this.persist();
        return cloneTask(task);
    }

    async update(taskId: string, input: { description?: unknown; blockedBy?: unknown }): Promise<CreatorTask> {
        const tasks = await this.current();
        const task = tasks.find((item) => item.id === taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        if (task.status !== 'pending') throw new Error('TASK_UPDATE_REQUIRES_PENDING');
        if (input.description !== undefined) task.description = boundedText(input.description, MAX_TASK_TEXT, 'TASK_DESCRIPTION_INVALID');
        if (input.blockedBy !== undefined) task.blockedBy = this.validateDependencies(input.blockedBy, taskId, tasks);
        task.updatedAt = new Date().toISOString();
        await this.persist();
        return cloneTask(task);
    }

    async claim(taskId: string): Promise<CreatorTask> {
        const tasks = await this.current();
        const task = tasks.find((item) => item.id === taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        if (task.status === 'completed') throw new Error('TASK_ALREADY_COMPLETED');
        const incomplete = task.blockedBy.filter((id) => tasks.find((dependency) => dependency.id === id)?.status !== 'completed');
        if (incomplete.length) throw new Error(`TASK_BLOCKED_BY:${incomplete.join(',')}`);
        task.status = 'in_progress';
        task.owner = 'creator-agent';
        task.updatedAt = new Date().toISOString();
        await this.persist();
        return cloneTask(task);
    }

    async recordReceipts(taskId: string, receipts: AgentReceipt[], finalizeSatisfiedTasks = true): Promise<{ task: CreatorTask; outstanding: Array<{ id: string; description: string; missingTools: string[] }> }> {
        const tasks = await this.current();
        const task = tasks.find((item) => item.id === taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        for (const currentTask of tasks.filter((item) => item.id === taskId || item.status === 'in_progress')) {
          for (const criterion of currentTask.acceptanceCriteria) {
            const matched = receipts.filter((receipt) => matchesCriterion(criterion, receipt, receipts, this.verifyReceipt));
            if (criterion.receiptRequirement) {
                // Re-evaluate current receipts: a later write invalidates earlier readback.
                criterion.evidence = matched.map(({ callId, toolName }) => ({ callId, toolName }));
            } else {
                criterion.evidence.push(...matched.filter((receipt) => !criterion.evidence.some((item) => item.toolName === receipt.toolName))
                    .map(({ callId, toolName }) => ({ callId, toolName })));
            }
            criterion.status = criterionSatisfied(criterion, criterion.evidence) ? 'satisfied' : 'pending';
          }
          const taskCriteriaSatisfied = currentTask.acceptanceCriteria.every((criterion) => criterion.status === 'satisfied');
          const taskDependenciesReady = currentTask.blockedBy.every((id) => tasks.find((dependency) => dependency.id === id)?.status === 'completed');
          if (finalizeSatisfiedTasks && taskCriteriaSatisfied && taskDependenciesReady) currentTask.status = 'completed';
          else if (currentTask.acceptanceCriteria.some((criterion) => criterion.receiptRequirement)) currentTask.status = 'in_progress';
          currentTask.updatedAt = new Date().toISOString();
        }
        const outstanding = task.acceptanceCriteria.filter((criterion) => criterion.status !== 'satisfied').map((criterion) => ({
            id: criterion.id, description: criterion.description,
            missingTools: criterion.requiredTools.filter((name) => name === '*' ? criterion.evidence.length === 0
                : !criterion.evidence.some((evidence) => evidence.toolName === name)),
        }));
        const dependenciesReady = task.blockedBy.every((id) => tasks.find((dependency) => dependency.id === id)?.status === 'completed');
        if (!dependenciesReady) outstanding.push({ id: 'dependencies', description: 'Complete prerequisite tasks first.',
            missingTools: task.blockedBy.filter((id) => tasks.find((dependency) => dependency.id === id)?.status !== 'completed') });
        if (finalizeSatisfiedTasks && dependenciesReady && outstanding.length === 0) task.status = 'completed';
        else if (task.status !== 'completed') task.status = 'in_progress';
        task.updatedAt = new Date().toISOString();
        await this.persist();
        return { task: cloneTask(task), outstanding };
    }

    goal(taskId: string, maxContinuationAttempts = 2): AgentGoal {
        if (!Number.isInteger(maxContinuationAttempts) || maxContinuationAttempts < 0 || maxContinuationAttempts > 4) {
            throw new RangeError('maxContinuationAttempts must be an integer from 0 to 4.');
        }
        // The caller creates the task before building this run goal; criteria are loaded asynchronously by goalForTask.
        return { taskId, criteria: [], maxContinuationAttempts };
    }

    async goalForTask(taskId: string, maxContinuationAttempts = 2): Promise<AgentGoal> {
        const task = await this.get(taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        if (!Number.isInteger(maxContinuationAttempts) || maxContinuationAttempts < 0 || maxContinuationAttempts > 4) {
            throw new RangeError('maxContinuationAttempts must be an integer from 0 to 4.');
        }
        return { taskId, criteria: task.acceptanceCriteria.map(({ id, description, requiredTools, toolMatch, receiptRequirement, expectation }) => ({
            id, description, requiredTools, ...(toolMatch ? { toolMatch } : {}), ...(receiptRequirement ? { receiptRequirement } : {}),
            ...(expectation ? { expectation: structuredClone(expectation) } : {}),
        })), maxContinuationAttempts };
    }

    tools(): AgentTool[] { return taskSystemTools(); }

    async invoke(name: string, args: JsonObject): Promise<AgentToolResult | null> {
        try {
            if (name === 'agent_task_list') return { structuredContent: { success: true, tasks: await this.list() } };
            if (name === 'agent_task_get') return { structuredContent: { success: true, task: await this.get(String(args.taskId || '')) } };
            if (name === 'agent_task_create') return { structuredContent: { success: true, task: await this.create(args as unknown as Parameters<CreatorTaskSystem['create']>[0]) } };
            if (name === 'agent_task_update') return { structuredContent: { success: true, task: await this.update(String(args.taskId || ''), args) } };
            if (name === 'agent_task_claim') return { structuredContent: { success: true, task: await this.claim(String(args.taskId || '')) } };
            return null;
        } catch (error) {
            return { structuredContent: { success: false, outcome: 'rejected', error: { code: error instanceof Error ? error.message : 'TASK_OPERATION_FAILED' } } };
        }
    }

    private validateDependencies(value: unknown, selfId: string | null, tasks: CreatorTask[]): string[] {
        if (!Array.isArray(value) || value.length > 20 || value.some((id) => typeof id !== 'string' || !TASK_ID.test(id))) {
            throw new TypeError('TASK_DEPENDENCIES_INVALID');
        }
        if (new Set(value).size !== value.length) throw new TypeError('TASK_DEPENDENCIES_DUPLICATE');
        const ids = value as string[];
        if (ids.some((id) => id === selfId)) throw new Error('TASK_DEPENDENCY_CYCLE');
        if (ids.some((id) => !tasks.some((task) => task.id === id))) throw new Error('TASK_DEPENDENCY_NOT_FOUND');
        const reaches = (fromId: string, targetId: string, visited = new Set<string>()): boolean => {
            if (fromId === targetId) return true;
            if (visited.has(fromId)) return false;
            visited.add(fromId);
            const from = tasks.find((task) => task.id === fromId);
            return from?.blockedBy.some((id) => reaches(id, targetId, visited)) || false;
        };
        if (selfId && ids.some((id) => reaches(id, selfId))) throw new Error('TASK_DEPENDENCY_CYCLE');
        return [...ids];
    }

    private async persist(): Promise<void> {
        await this.persistence.save((await this.current()).map(cloneTask));
    }
}

export class CreatorTaskToolRegistry implements ToolRegistry {
    constructor(private readonly inner: ToolRegistry, private readonly tasks: CreatorTaskSystem) {}

    async listTools(): Promise<AgentTool[]> { return [...await this.inner.listTools(), ...this.tasks.tools()]; }

    async callTool(input: { name: string; arguments: JsonObject; callId?: string }): Promise<AgentToolResult> {
        const taskResult = await this.tasks.invoke(input.name, input.arguments);
        return taskResult || this.inner.callTool(input);
    }
}

export function evaluateGoalEvidence(goal: AgentGoal, receipts: AgentReceipt[], verifier?: CriterionReceiptVerifier): {
    satisfied: boolean;
    outstanding: Array<{ id: string; description: string; missingTools: string[] }>;
} {
    const outstanding = goal.criteria.filter((criterion) => !criterionSatisfied(criterion,
        receipts.filter((receipt) => matchesCriterion(criterion, receipt, receipts, verifier)))).map((criterion) => ({
        id: criterion.id, description: criterion.description,
        missingTools: criterion.requiredTools.filter((name) => name === '*'
            ? !receipts.some((receipt) => matchesCriterion(criterion, receipt, receipts, verifier))
            : !receipts.some((receipt) => receipt.toolName === name && matchesCriterion(criterion, receipt, receipts, verifier))),
    }));
    return { satisfied: goal.criteria.length > 0 && outstanding.length === 0, outstanding };
}
