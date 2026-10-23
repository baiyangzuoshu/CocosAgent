'use strict';

const SHA256 = /^[a-f0-9]{64}$/;

function classifyPrefabInstanceOverride(plan, after) {
    if (!plan || !after || !['apply', 'revert'].includes(plan.action)) return 'conflict';
    if (after.sceneUuid !== plan.sceneUuid || after.prefabUuid !== plan.prefabUuid
        || after.prefabRootUuid !== plan.prefabRootUuid || after.targetUrl !== plan.targetUrl)
        return 'conflict';

    const prefabChanged = after.prefabSourceSha256 !== plan.expectedBefore.prefabSourceSha256;
    const prefabMetaChanged = after.prefabMetaSha256 !== plan.expectedBefore.prefabMetaSha256;
    const sceneMetaChanged = after.sceneMetaSha256 !== plan.expectedBefore.sceneMetaSha256;
    const sceneChanged = after.sceneSourceSha256 !== plan.expectedBefore.sceneSourceSha256;
    const instanceChanged = after.instanceStateSha256 !== plan.expectedBefore.instanceStateSha256;
    if (prefabMetaChanged || sceneMetaChanged) return 'conflict';

    if (plan.action === 'apply') {
        if (prefabChanged) return 'effect-observed';
        if (!sceneChanged && !instanceChanged) return 'not-applied';
        return 'needs-reconciliation';
    }

    if (prefabChanged) return 'conflict';
    if (sceneChanged && instanceChanged) return 'effect-observed';
    if (!sceneChanged && !instanceChanged) return 'not-applied';
    return 'needs-reconciliation';
}

function classifyPrefabInstanceOverrideAction(plan, after) {
    if (!plan || !after || !['apply', 'revert'].includes(plan.action)) return 'conflict';
    if (after.sceneUuid !== plan.sceneUuid || after.prefabUuid !== plan.prefabUuid
        || after.prefabRootUuid !== plan.prefabRootUuid || after.targetUrl !== plan.targetUrl
        || after.prefabMetaSha256 !== plan.expectedBefore.prefabMetaSha256
        || after.sceneMetaSha256 !== plan.expectedBefore.sceneMetaSha256) return 'conflict';

    const prefabChanged = after.prefabSourceSha256 !== plan.expectedBefore.prefabSourceSha256;
    const instanceChanged = after.instanceStateSha256 !== plan.expectedBefore.instanceStateSha256;
    if (plan.action === 'apply') return prefabChanged ? 'action-observed' : 'pending';
    if (prefabChanged) return 'conflict';
    return instanceChanged ? 'action-observed' : 'pending';
}

function validPrefabInstanceOverridePlan(plan) {
    return !!plan && plan.operation === 'creator.prefab.instance.override'
        && ['apply', 'revert'].includes(plan.action)
        && typeof plan.sceneUuid === 'string' && typeof plan.selectedNodeUuid === 'string'
        && typeof plan.prefabRootUuid === 'string' && typeof plan.prefabUuid === 'string'
        && typeof plan.targetUrl === 'string' && plan.targetUrl.startsWith('db://assets/')
        && plan.expectedBefore && SHA256.test(plan.expectedBefore.instanceStateSha256 || '')
        && SHA256.test(plan.expectedBefore.sceneSourceSha256 || '')
        && SHA256.test(plan.expectedBefore.sceneMetaSha256 || '')
        && SHA256.test(plan.expectedBefore.prefabSourceSha256 || '')
        && SHA256.test(plan.expectedBefore.prefabMetaSha256 || '');
}

module.exports = {
    classifyPrefabInstanceOverride,
    classifyPrefabInstanceOverrideAction,
    validPrefabInstanceOverridePlan,
};
