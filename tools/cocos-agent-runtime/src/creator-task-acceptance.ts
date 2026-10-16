import type { AgentGoalCriterion, AgentReceipt, JsonObject } from './contracts.js';
import { creatorNodeField, literalCreatorTargets, matchesCreatorTarget, validateCreatorTargets, type CreatorExpectedTarget } from './creator-targets.js';
import { creatorActionText, parseCreatorTaskIntent, type CreatorTaskIntent } from './creator-task-intent.js';

const READ_TOOLS = ['cocos_2x_scene_snapshot', 'cocos_2x_scene_node_inspect', 'cocos_2x_script_read',
    'cocos_2x_asset_search_png', 'cocos_2x_operation_get', 'cocos_2x_script_operation_get', 'cocos_2x_runtime_observe',
    'cocos_2x_command_execute', 'cocos_2x_memory_search', 'cocos_2x_memory_get', 'cocos_2x_memory_operation_get'];
const REQUESTABLE_READ_TOOLS = [
    'cocos_2x_instances_list', 'cocos_2x_instances_get', 'cocos_2x_capabilities_list', 'cocos_2x_skills_list',
    'cocos_2x_skill_read', 'cocos_2x_skill_reference_read', 'cocos_2x_project_instructions_read',
    'cocos_2x_memory_search', 'cocos_2x_memory_get', 'cocos_2x_memory_operation_get'];
const WRITE_TOOLS = ['cocos_2x_command_execute', 'cocos_2x_script_patch'];
const LEDGER_TOOLS = ['cocos_2x_operation_get', 'cocos_2x_script_operation_get'];
const READBACK_TOOLS = [...LEDGER_TOOLS, 'cocos_2x_scene_node_inspect', 'cocos_2x_script_read', 'cocos_2x_command_execute'];
const CONTENT_COMMANDS = new Set(['scene.node.create', 'scene.node.patch', 'scene.pngSprite', 'prefab.source.patch', 'script.patch']);
const READ_COMMANDS = new Set(['scene.snapshot', 'scene.node.inspect', 'asset.searchPng', 'asset.validatePng',
    'prefab.source.inspect', 'script.read', 'script.patch.plan', 'script.operation.get', 'content.stress.run']);
const MEMORY_WRITES = ['cocos_2x_memory_remember', 'cocos_2x_memory_correct', 'cocos_2x_memory_delete', 'cocos_2x_memory_compact'];
const NON_CONTENT_WRITES = new Set(['cocos_2x_operation_preview_accept', 'cocos_2x_operation_reconcile', ...MEMORY_WRITES]);
const record = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const object = (value: unknown): JsonObject => record(value) ? value : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const data = (receipt: AgentReceipt): JsonObject => object(receipt.result.structuredContent);
const detail = (receipt: AgentReceipt): JsonObject => record(data(receipt).result) ? data(receipt).result as JsonObject : data(receipt);
const operationId = (receipt: AgentReceipt): string => text(data(receipt).operationId || detail(receipt).operationId);
const command = (receipt: AgentReceipt): string => text(data(receipt).command) || (receipt.toolName === 'cocos_2x_script_patch' ? 'script.patch' : '');
const good = (receipt: AgentReceipt): boolean => !receipt.result.isError && data(receipt).success === true
    && !data(receipt).error && !['needs-review', 'failed', 'in-progress', 'pending'].includes(text(data(receipt).outcome));

function criterion(id: string, description: string, tools: string[], receiptRequirement: string): AgentGoalCriterion {
    return { id, description, requiredTools: tools, toolMatch: 'any', receiptRequirement };
}

function removeNegatedScopes(task: string): string {
    return task
        // Chinese task prompts commonly enumerate forbidden actions up to a comma,
        // then continue with the permitted read-only request.
        .replace(/(?:禁止|严禁|不得|不允许|不可以|不要|无需|不必|无须|不需要)\s*(?:进行|执行|调用|任何|再)?[^，,。；;.!?\n]*/g, ' ')
        .replace(/不(?:写入|修改|审批|预览|运行|补偿|恢复|重放|构建|删除|创建|保存)[^，,。；;.!?\n]*/g, ' ')
        // English prompts often list several prohibited actions separated by commas.
        .replace(/\b(?:no|never|without|do\s+not|don['’]t|must\s+not|mustn['’]t|prohibit(?:ed)?)\b[^.!?;\n]*?(?=,\s*(?:then|finally)\b|[.!?;\n]|$)/gi, ' ')
        .replace(/^[\s,，。；;]+|[\s,，。；;]+$/g, '')
        .trim();
}

function requestedReadCriteria(task: string): AgentGoalCriterion[] {
    const requested: Array<[string, RegExp, string]> = [
        ['instance', /\b(?:registered\s+)?instance\b|\binstances?\s+(?:list|get|query)\b|实例|工程实例/i, 'cocos_2x_instances_get'],
        ['capabilities', /\bcapabilit(?:y|ies)\s+(?:catalog|list|directory)\b|能力(?:目录|目錄|清单|清單)/i, 'cocos_2x_capabilities_list'],
        ['skills-index', /\bskills?\s+index\b|技能(?:索引|目录|目錄)/i, 'cocos_2x_skills_list'],
        ['skill-body', /\b(?:read|inspect|verify)\b.{0,100}\b(?:skill|cocos2-mcp-tools)\b|读取.{0,80}skill|技能正文|skill\s+[`'"“][^`'"”]+[`'"“]/i, 'cocos_2x_skill_read'],
        ['skill-reference', /\bdeclared\b.{0,120}\breferences?\b|\bcontract\s+references?\b|合同引用|声明的引用/i, 'cocos_2x_skill_reference_read'],
        ['scene-snapshot', /\bscene\s+snapshot\b|场景快照/i, 'cocos_2x_scene_snapshot'],
    ];
    const criteria = requested.filter(([, pattern]) => pattern.test(task)).map(([id, , tool]) =>
        criterion(`requested-${id}`, `取得 ${tool} 的本轮成功只读回执`, [tool], 'creator-requested-read'));
    const scripts = [...new Set([...task.matchAll(/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.[jt]s\b/g)].map((match) => match[0].trim().replace(/^assets\//, '')))];
    scripts.forEach((scriptPath, index) => criteria.push({
        ...criterion(`requested-script-${index + 1}`, `读取 ${scriptPath} 的本轮源码回执`, ['cocos_2x_script_read', 'cocos_2x_command_execute'], 'creator-requested-script'),
        expectation: { scriptPath },
    }));
    return criteria;
}

/** Conservative scope recognition. Unknown requests require clarification, never a generic successful receipt. */
export function creatorTaskCriteria(task: string, approvedTargets?: CreatorExpectedTarget[], proposal?: CreatorTaskIntent): AgentGoalCriterion[] {
    const intent = proposal ? parseCreatorTaskIntent(proposal, task) : undefined;
    const value = creatorActionText(removeNegatedScopes(task));
    const inferredRead = /只读|只讀|read[ -]only|\b(?:read|inspect|check|query|analy[sz]e|explain|summari[sz]e|list|show|verify)\b|(?:阅读|读取|查看|检查|查询|分析|解释|总结|列出|核对)/i.test(value);
    const inferredRestore = /补偿|恢复|撤销|回滚|\bcompensate\b|\brestore\b|\bundo\b|\brollback\b/i.test(value);
    const inferredMemory = /记住|忘记|(?:创建|新建|新增|添加|保存|写入|记录|删除|修改|更新|纠正|压缩|整合|合并|整理).*记忆|\bremember\b|\bforget\b|\b(?:create|save|write|delete|remove|modify|update|correct|compact|consolidate|merge|organize).*\bmemory\b/i.test(value);
    const contentScope = value.replace(/(?:记住|忘记|删除|修改|更新|纠正|压缩|整合|合并|整理|创建|新建|新增|增加|添加|保存|写入|记录)(?:这条|该|一条|所有|项目|临时|测试|工程)?(?:\s+[A-Za-z0-9_-]+)?\s*记忆|\b(?:remember|forget|create|save|write|delete|remove|modify|update|correct|compact|consolidate|merge|organize)\s+(?:the\s+|this\s+|project\s+)?memory\b/gi, '');
    const inferredContentModifies = inferredRestore || literalCreatorTargets(contentScope).length > 0
        || /写入|保存|创建|新建|新增|增加|添加|制作|搭建|修改|改名|重命名|改为|改成|更新|删除|实现|修复|重构|移动|调整|替换|实例化|生成|导入|做一个|建一个|帮我做|\b(?:write|save|create|make|build|add|modify|change|rename|update|delete|remove|implement|fix|refactor|move|replace|instantiate|import)\b/i.test(contentScope);
    const inferredModifies = inferredContentModifies || inferredMemory;
    if (intent && ['read', 'explain'].includes(intent.kind) && (inferredModifies || inferredMemory)) throw new Error('CREATOR_TASK_INTENT_DOWNGRADED');
    if (intent && ['write', 'mixed', 'restore', 'memory'].includes(intent.kind)
        && (!value.trim() || inferredRead && !inferredModifies && !inferredMemory)) throw new Error('CREATOR_TASK_INTENT_NOT_AUTHORIZED');
    if (intent && inferredMemory && !inferredContentModifies && intent.kind !== 'memory' && intent.kind !== 'clarify'
        || intent?.kind === 'memory' && inferredContentModifies) throw new Error('CREATOR_TASK_INTENT_SCOPE_MISMATCH');
    if (intent && intent.kind !== 'clarify' && (inferredRestore && intent.kind !== 'restore'
        || inferredMemory && !inferredModifies && intent.kind !== 'memory'
        || intent.kind === 'memory' && !inferredMemory)) throw new Error('CREATOR_TASK_INTENT_SCOPE_MISMATCH');
    if (intent?.kind === 'clarify') return [criterion('request-scope', intent.question, READ_TOOLS, 'creator-scope-unknown')];
    const read = intent ? ['read', 'mixed'].includes(intent.kind) || intent.reads.length > 0 : inferredRead;
    const restore = intent ? intent.kind === 'restore' : inferredRestore;
    const modifies = intent ? ['write', 'mixed', 'restore'].includes(intent.kind) : inferredModifies;
    const memoryMutation = intent ? intent.kind === 'memory' : inferredMemory && !inferredContentModifies;
    const explicitReads = requestedReadCriteria(value);
    for (const name of intent?.reads || []) if (!explicitReads.some((item) => item.requiredTools.includes(name))) {
        explicitReads.push(criterion(`intent-read-${explicitReads.length + 1}`, `取得 ${name} 的本轮成功回执`, [name],
            REQUESTABLE_READ_TOOLS.includes(name) ? 'creator-requested-read' : 'creator-read'));
    }
    if (intent?.kind === 'explain' || !intent && !value.trim()) return [];
    if (memoryMutation) {
        const requirements = [criterion('memory-mutation', '取得经批准、已持久化的记忆变更回执', MEMORY_WRITES, 'creator-memory-write')];
        if (read) requirements.unshift(...(explicitReads.length ? explicitReads
            : [criterion('requested-read', '取得本次记忆变更所需的记忆或项目上下文只读回执', [...READ_TOOLS, ...REQUESTABLE_READ_TOOLS], 'creator-read')]));
        return requirements;
    }
    // A read prefix must not downgrade a mixed inspect-and-create request.
    if (read && !modifies) return explicitReads.length ? explicitReads
        : [criterion('requested-read', '取得本次只读检查所需的 Creator 内容回执', READ_TOOLS, 'creator-read')];
    if (!modifies) return [criterion('request-scope', '任务目标尚不明确：请明确仅检查还是修改，以及要验收的对象', READ_TOOLS, 'creator-scope-unknown')];
    const requirements = [
        ...(read ? (explicitReads.length ? explicitReads
            : [criterion('requested-read', '取得本次只读检查所需的 Creator 内容回执', READ_TOOLS, 'creator-read')]) : []),
        criterion('content-written', restore ? '取得经批准且保存读回通过的补偿/恢复操作' : '取得经批准且编辑器与磁盘验证通过的实际内容写入', WRITE_TOOLS,
            restore ? 'creator-restoration-write' : 'creator-content-write'),
        criterion('operation-readback', '在最后一次内容写入之后，重新核对本轮每个操作 ID 的保存账本', LEDGER_TOOLS, 'creator-ledger'),
        criterion('target-readback', '在最后一次内容写入之后，读回相同 UUID/哈希及预期字段；其他对象或旧读取不能替代', READBACK_TOOLS,
            restore ? 'creator-restoration-readback' : 'creator-readback'),
        criterion('script-compiled', '本轮脚本写入必须有对应源码哈希的 Creator 编译回执；无脚本写入时不适用', [...WRITE_TOOLS, ...LEDGER_TOOLS], 'creator-compile'),
    ];
    const temporalRestore = restore && /临时|暂时|再.*(?:补偿|恢复)|then.*(?:restore|undo)|temporary/i.test(value);
    const targets = [...new Map([...(temporalRestore ? [] : literalCreatorTargets(value)), ...validateCreatorTargets(approvedTargets || [])]
        .map((target) => [`${target.target}:${target.field}:${JSON.stringify(target.equals)}`, target])).values()];
    if (!restore || targets.length) requirements.push(...(targets.length ? targets.map((target, index) => ({
        ...criterion(`requested-target-${index + 1}`, `核对目标 ${target.target} 的 ${target.field} = ${String(target.equals)}`.slice(0, 280), READBACK_TOOLS, 'creator-user-target'), expectation: target,
    })) : [criterion('requested-target-unbound', '最终目标尚未绑定：请在 Plan 中审阅目标 UUID/路径、字段和预期值，不能仅凭写入回执宣告完成', READBACK_TOOLS, 'creator-scope-unknown')]));
    const compileOnly = /仅编译|只需编译|不要运行|无需运行|不验证运行|不预览|不要预览|无需预览|\bcompile only\b|\bdo not run\b|\bno preview\b/i.test(task);
    const functional = /点击|按钮|网络|连接|登录|存档|交互|玩法|碰撞|\b(?:click|button|network|connect|login|save game|interactive|gameplay|collision)\b/i.test(value)
        || intent?.verification === 'interaction';
    const visual = /界面|弹窗|窗口|场景|预览|运行|脚本|代码|\b(?:ui|gui|dialog|popup|scene|preview|runtime|script|code)\b|\.[jt]s\b/i.test(value)
        || intent?.verification === 'runtime';
    if (!restore && !compileOnly && (functional || visual)) {
        requirements.push(criterion('runtime-observed', '写入后观察相同场景/目标：帧推进、无捕获错误、截图可用；需要预览验收的操作须按相同 operationId 验收',
            ['cocos_2x_runtime_observe'], 'creator-runtime'));
    }
    if (!restore && !compileOnly && functional) {
        requirements.push(criterion('interaction-verified', '实际点击/网络等功能仍未验收：运行观察不自动提供交互结果断言，尚无原生交互验收入口',
            ['cocos_2x_runtime_observe'], 'creator-interaction'));
    }
    return requirements;
}

function writes(receipts: AgentReceipt[]): AgentReceipt[] {
    return receipts.filter((receipt) => receipt.access === 'write'
        && !NON_CONTENT_WRITES.has(receipt.toolName) && !READ_COMMANDS.has(command(receipt))
        && command(receipt) !== 'runtime.preview.start');
}

function finalTargets(attempts: AgentReceipt[]): AgentReceipt[] {
    const targets = new Map<string, AgentReceipt>();
    for (const write of attempts) {
        const payload = detail(write);
        const key = command(write) === 'script.patch' ? object(payload.record).scriptUuid
            : payload.prefabUuid || payload.targetNodeUuid || payload.nodeUuid;
        targets.set(`${command(write) === 'script.patch' ? 'script' : 'node'}:${text(key) || operationId(write)}`, write);
    }
    return [...targets.values()];
}

function scriptMatches(receipt: AgentReceipt, restoring: boolean): boolean {
    const payload = detail(receipt), saved = object(payload.record), current = object(payload.current);
    const expected = restoring ? saved.beforeSha256 : saved.afterSha256;
    return saved.state === (restoring ? 'compensated' : 'completed') && typeof expected === 'string'
        && current.sourceSha256 === expected && current.scriptUuid === saved.scriptUuid
        && current.metaSha256 === saved.metaSha256;
}

function verifiedWrite(receipt: AgentReceipt, restoring: boolean): boolean {
    if (!good(receipt) || !WRITE_TOOLS.includes(receipt.toolName) || !CONTENT_COMMANDS.has(command(receipt)) || !operationId(receipt)) return false;
    if (command(receipt) === 'script.patch') return scriptMatches(receipt, restoring);
    const phases = object(data(receipt).phases);
    return phases.editor === 'passed' && phases.disk === 'passed'
        && (restoring ? detail(receipt).action === 'compensate' && phases.recovery === 'passed' : detail(receipt).action !== 'compensate');
}

function afterWrites(receipt: AgentReceipt, receipts: AgentReceipt[]): boolean {
    const attempts = writes(receipts);
    return attempts.length > 0 && receipts.indexOf(receipt) > Math.max(...attempts.map((write) => receipts.indexOf(write)));
}

function nodeField(node: JsonObject, field: string): unknown {
    return creatorNodeField(node, field);
}

function targetMatches(receipt: AgentReceipt, write: AgentReceipt, restoring: boolean): boolean {
    if (!good(receipt)) return false;
    const payload = detail(receipt), target = detail(write);
    if (command(write) === 'script.patch') {
        const saved = object(target.record);
        if (receipt.toolName === 'cocos_2x_script_operation_get') return operationId(receipt) === operationId(write) && scriptMatches(receipt, restoring);
        return receipt.toolName === 'cocos_2x_script_read' && payload.scriptUuid === saved.scriptUuid
            && payload.sourceSha256 === (restoring ? saved.beforeSha256 : saved.afterSha256) && payload.metaSha256 === saved.metaSha256;
    }
    if (command(write) === 'prefab.source.patch') {
        return command(receipt) === 'prefab.source.inspect' && payload.prefabUuid === target.prefabUuid
            && payload.sourceSha256 === target.afterSha256;
    }
    if (receipt.toolName !== 'cocos_2x_scene_node_inspect') return false;
    const node = object(payload.node);
    const uuid = target.targetNodeUuid || target.nodeUuid;
    if (!uuid) return false;
    if (restoring && command(write) === 'scene.node.create') return node.status === 'not-found' && node.uuid === uuid;
    if (node.status !== 'found' || node.uuid !== uuid) return false;
    if (Array.isArray(target.expectedDiff)) return target.expectedDiff.length > 0 && target.expectedDiff.every((item) => record(item)
        && typeof item.path === 'string' && nodeField(node, item.path) !== undefined && Object.is(nodeField(node, item.path), item.after));
    if (typeof target.nodeName !== 'string' || node.name !== target.nodeName) return false;
    const components = Array.isArray(target.components) ? target.components : [];
    if (!components.every((spec) => {
        if (!record(spec)) return false;
        const matches = (Array.isArray(node.componentDetails) ? node.componentDetails : []).filter((item) => record(item) && item.classId === spec.classId);
        if (matches.length !== 1) return false;
        const actual = object(matches[0]);
        return (spec.text === undefined || actual.text === spec.text)
            && (spec.spriteFrameUuid === undefined || actual.spriteFrameUuid === spec.spriteFrameUuid);
    })) return false;
    const transform = object(target.transform);
    return ['position', 'scale'].every((kind) => ['x', 'y'].every((axis) => {
        const expected = object(transform[kind])[axis];
        return expected === undefined || Object.is(nodeField(node, `node.${kind}.${axis}`), expected);
    }));
}

/** Product evidence checks consume actual receipts only. Unsupported checks fail closed. */
export function verifyCreatorTaskReceipt(criterion: AgentGoalCriterion, receipt: AgentReceipt, receipts: AgentReceipt[]): boolean {
    const requirement = criterion.receiptRequirement;
    if (requirement === 'creator-read') return criterion.requiredTools.includes(receipt.toolName) && good(receipt)
        && (receipt.toolName === 'cocos_2x_command_execute'
            ? receipt.role === 'task' && READ_COMMANDS.has(command(receipt))
            : receipt.access === 'read' && READ_TOOLS.includes(receipt.toolName));
    if (requirement === 'creator-requested-read') return ['setup', 'task'].includes(receipt.role) && receipt.access === 'read'
        && good(receipt) && criterion.requiredTools.includes(receipt.toolName);
    if (requirement === 'creator-requested-script') {
        const path = text(detail(receipt).scriptPath), requested = text(criterion.expectation?.scriptPath);
        return good(receipt) && (receipt.toolName === 'cocos_2x_script_read' || command(receipt) === 'script.read')
            && !!requested && (path === requested || path.endsWith(`/${requested}`));
    }
    if (requirement === 'creator-user-target') return afterWrites(receipt, receipts)
        && matchesCreatorTarget(receipt, criterion.expectation as CreatorExpectedTarget);
    if (requirement === 'creator-memory-write') return receipt.access === 'write' && good(receipt) && MEMORY_WRITES.includes(receipt.toolName)
        && ['remembered', 'corrected', 'deleted', 'compacted'].includes(text(data(receipt).outcome)) && !!operationId(receipt);
    if (requirement === 'creator-scope-unknown' || requirement === 'creator-interaction') return false;
    const attempts = writes(receipts);
    if (!attempts.length) return false;
    const restoring = requirement?.startsWith('creator-restoration') === true;
    if (requirement === 'creator-content-write' || requirement === 'creator-restoration-write') {
        const compensating = (write: AgentReceipt) => detail(write).action === 'compensate'
            || command(write) === 'script.patch' && object(detail(write).record).state === 'compensated';
        return attempts.includes(receipt) && attempts.every((write) => verifiedWrite(write, compensating(write)))
            && (restoring ? finalTargets(attempts).every(compensating) : finalTargets(attempts).every((write) => !compensating(write)));
    }
    if (requirement === 'creator-compile') {
        return good(receipt) && attempts.every((write) => command(write) !== 'script.patch'
            || object(object(detail(write).record).compilation).status === 'compiled');
    }
    if (requirement === 'creator-ledger') {
        const matches = (candidate: AgentReceipt, write: AgentReceipt) => LEDGER_TOOLS.includes(candidate.toolName)
            && afterWrites(candidate, receipts) && good(candidate) && operationId(candidate) === operationId(write)
            && (command(write) === 'script.patch' ? object(detail(candidate).record).operationId === operationId(write)
                && object(detail(candidate).record).afterSha256 === object(detail(write).record).afterSha256
                && ['completed', 'compensated'].includes(text(object(detail(candidate).record).state))
                : object(data(candidate).phases).editor === 'passed' && object(data(candidate).phases).disk === 'passed');
        return attempts.every((write) => receipts.some((candidate) => matches(candidate, write))) && attempts.some((write) => matches(receipt, write));
    }
    if (requirement === 'creator-readback' || requirement === 'creator-restoration-readback') {
        const targets = finalTargets(attempts);
        return targets.every((write) => receipts.some((candidate) => afterWrites(candidate, receipts) && targetMatches(candidate, write, restoring)))
            && afterWrites(receipt, receipts) && targets.some((write) => targetMatches(receipt, write, restoring));
    }
    if (requirement === 'creator-runtime') {
        const matches = (candidate: AgentReceipt, write: AgentReceipt) => {
            if (candidate.toolName !== 'cocos_2x_runtime_observe' || !afterWrites(candidate, receipts) || !good(candidate)) return false;
            const observed = data(candidate), scene = object(observed.scene), runtime = object(observed.runtime), diagnostics = object(observed.diagnostics);
            if (scene.matchesExpected !== true || runtime.status !== 'running' || !(Number(runtime.frameDelta) > 0)
                || runtime.capturedErrorCount !== 0 || !Array.isArray(diagnostics.errors) || diagnostics.errors.length !== 0
                || object(observed.screenshot).available !== true) return false;
            const expectedScene = object(data(write).instance).activeSceneUuid;
            if (typeof expectedScene !== 'string' || scene.uuid !== expectedScene) return false;
            const uuid = detail(write).targetNodeUuid || detail(write).nodeUuid;
            if (uuid && object(observed.targetNode).uuid !== uuid) return false;
            return object(data(write).phases).preview !== 'pending' || receipts.some((accepted) => good(accepted)
                && accepted.toolName === 'cocos_2x_operation_preview_accept' && operationId(accepted) === operationId(write)
                && receipts.indexOf(accepted) > receipts.indexOf(candidate) && object(data(accepted).phases).preview === 'passed');
        };
        const targets = finalTargets(attempts);
        return targets.every((write) => receipts.some((candidate) => matches(candidate, write))) && targets.some((write) => matches(receipt, write));
    }
    return false;
}
