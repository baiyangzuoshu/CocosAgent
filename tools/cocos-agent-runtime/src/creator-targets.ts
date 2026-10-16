import type { AgentReceipt, JsonObject } from './contracts.js';

export interface CreatorExpectedTarget extends JsonObject {
    target: string;
    field: string;
    equals: string | number | boolean;
}
const NODE_FIELDS = new Set(['node.name', 'node.active', 'node.position.x', 'node.position.y',
    'node.scale.x', 'node.scale.y', 'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid', 'component.cc.Label.enabled']);
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};

export function validateCreatorTargets(value: unknown): CreatorExpectedTarget[] {
    if (!Array.isArray(value) || value.length > 16) throw new Error('CREATOR_TARGETS_INVALID');
    const keys = new Set<string>();
    return value.map((raw) => {
        const item = object(raw);
        if (Object.keys(item).length !== 3 || typeof item.target !== 'string' || !item.target.trim() || item.target.length > 240
            || typeof item.field !== 'string' || ![...NODE_FIELDS, 'script.sourceSha256', 'prefab.sourceSha256'].includes(item.field)
            || !['string', 'number', 'boolean'].includes(typeof item.equals)
            || typeof item.equals === 'number' && !Number.isFinite(item.equals)
            || typeof item.equals === 'string' && item.equals.length > 256) throw new Error('CREATOR_TARGET_INVALID');
        if (/\.(?:position|scale)\.[xy]$/.test(item.field) && typeof item.equals !== 'number'
            || /\.(?:active|enabled)$/.test(item.field) && typeof item.equals !== 'boolean'
            || /(?:name|Uuid|Sha256)$/.test(item.field) && typeof item.equals !== 'string') throw new Error('CREATOR_TARGET_VALUE_INVALID');
        const key = `${item.target}:${item.field}`;
        if (keys.has(key)) throw new Error('CREATOR_TARGET_DUPLICATE');
        keys.add(key);
        return { target: item.target, field: item.field, equals: item.equals as CreatorExpectedTarget['equals'] };
    });
}

/** Recognize only literal, unambiguous property requests. Other writes need reviewed Plan targets. */
export function literalCreatorTargets(task: string): CreatorExpectedTarget[] {
    const actionText = task.split(/[，,。；;\n]|\b(?:and then|then)\b/i)
        .filter((part) => !/^\s*(?:并|再|然后|and\s+)?\s*(?:请|please\s+)?(?:读取|查看|检查|核对|确认|查询|验证|报告|\bread\b|\binspect\b|\bcheck\b|\bconfirm\b|\bverify\b|\breport\b)/i.test(part))
        .join('，');
    const matches = [...actionText.matchAll(/(?:将|把|set\s+|move\s+|change\s+)?([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_ -]+)*?)(?:\s+local)?\s*(?:的\s*|['’]s\s+)?(?:node\.)?(?:position\.)?(?:local\s+)?([xy])(?:\s*(?:position|coordinate))?\s*(?:坐标\s*)?(?:移动到|调整为|设置为|改为|设为|到|为|=|to\s+)\s*(-?\d+(?:\.\d+)?)(?!\d|\.\d)/gi)];
    const propertyFirst = [...actionText.matchAll(/(?:将|把|set\s+(?:only\s+)?(?:the\s+)?|move\s+(?:only\s+)?(?:the\s+)?|change\s+(?:only\s+)?(?:the\s+)?)(?:local\s+)?([xy])\s+position\s+(?:of|for)\s+([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_ -]+)*)\s*(?:to|=|设置为|改为|设为|移动到)\s*(-?\d+(?:\.\d+)?)(?!\d|\.\d)/gi)];
    const candidates = [
        ...matches.map((match) => ({ target: match[1]!.trim().replace(/\s+local$/i, ''), axis: match[2]!, value: match[3]! })),
        ...propertyFirst.map((match) => ({ target: match[2]!.trim(), axis: match[1]!, value: match[3]! })),
    ].filter((item) => !/^(?:preserve|keep|maintain|leave|to|from|of|for|at|on|in|the|only|local|position|coordinate|target|node|it|its|same|then|back|recorded|before|state)$/i.test(item.target));
    const nodeNameChanges: CreatorExpectedTarget[] = [];
    const addNameTarget = (rawTarget: string, value: string) => {
        const uuid = rawTarget.match(/UUID\s*[:：]?\s*([A-Za-z0-9_+/=-]{20,64})/i)?.[1];
        const target = uuid || rawTarget.replace(/[（(][^）)]*[）)]/g, '').trim().replace(/\s+节点$/, '');
        if (!target || !value) return;
        nodeNameChanges.push({ target, field: 'node.name', equals: value });
    };
    for (const part of actionText.split(/[，,。；;\n]/)) {
        const chinese = part.match(/(?:将|把)\s*(.+?)\s*(?:节点)?(?:的\s*)?(?:node\.)?(?:name|名称|名字)\s*(?:从\s*([^\s，,。；;]+)\s*)?(?:改为|改成|设置为|设为|变为|为|=)\s*([^\s，,。；;]+)/i);
        if (chinese) addNameTarget(chinese[1]!, chinese[3]!);
        const english = part.match(/\b(?:rename|change|set)\s+(?:the\s+)?(.+?)\s+(?:node\.)?name\s+(?:from\s+\S+\s+)?(?:to|=)\s*([^\s,.;]+)/i)
            || part.match(/\brename\s+(.+?)\s+from\s+\S+\s+to\s+([^\s,.;]+)/i);
        if (english) addNameTarget(english[1]!, english[2]!);
    }
    try { return validateCreatorTargets([
        ...candidates.map((item) => ({ target: item.target,
            field: `node.position.${item.axis.toLowerCase()}`, equals: Number(item.value) })),
        ...nodeNameChanges,
    ]); }
    catch { return []; }
}

export function creatorNodeField(node: JsonObject, field: string): unknown {
    if (field === 'node.name') return node.name;
    if (field === 'node.active') return node.active;
    const transform = field.match(/^node\.(position|scale)\.([xy])$/);
    if (transform) return object(object(node.transform)[transform[1]!])[transform[2]!];
    const component = field.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
    if (!component) return undefined;
    const matches = (Array.isArray(node.componentDetails) ? node.componentDetails : []).filter((value) => object(value).classId === component[1]);
    return matches.length === 1 ? object(matches[0])[component[2]!] : undefined;
}

export function matchesCreatorTarget(receipt: AgentReceipt, target: CreatorExpectedTarget): boolean {
    if (!target || typeof target.target !== 'string' || receipt.result.isError) return false;
    const data = object(receipt.result.structuredContent);
    if (data.success !== true || data.error) return false;
    const detail = data.result ? object(data.result) : data;
    if (target.field === 'script.sourceSha256') {
        const current = receipt.toolName === 'cocos_2x_script_operation_get' ? object(detail.current) : detail;
        return (receipt.toolName === 'cocos_2x_script_read' || receipt.toolName === 'cocos_2x_script_operation_get' || data.command === 'script.read')
            && [current.scriptUuid, detail.scriptPath].includes(target.target) && current.sourceSha256 === target.equals;
    }
    if (target.field === 'prefab.sourceSha256') return data.command === 'prefab.source.inspect'
        && detail.prefabUuid === target.target && detail.sourceSha256 === target.equals;
    if (receipt.toolName !== 'cocos_2x_scene_node_inspect' && data.command !== 'scene.node.inspect') return false;
    const node = object(detail.node);
    return node.status === 'found' && [node.uuid, node.path].includes(target.target)
        && Object.is(creatorNodeField(node, target.field), target.equals);
}
