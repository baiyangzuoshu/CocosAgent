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
    const matches = [...task.matchAll(/(?:将|把|set\s+|move\s+)?([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_ -]+)*)\s*(?:的\s*|['’]s\s+)?(?:node\.)?(?:position\.)?([xy])\s*(?:坐标\s*)?(?:移动到|调整为|设置为|改为|设为|到|为|=|to\s+)\s*(-?\d+(?:\.\d+)?)(?![\d.])/gi)];
    try { return validateCreatorTargets(matches.map((match) => ({ target: match[1]!.trim(), field: `node.position.${match[2]!.toLowerCase()}`, equals: Number(match[3]) }))); }
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
