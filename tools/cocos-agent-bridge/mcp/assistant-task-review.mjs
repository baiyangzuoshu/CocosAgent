function boundedString(value, limit = 500) {
    return typeof value === 'string' ? value.slice(0, limit) : undefined;
}

function boundedDiff(value) {
    if (!Array.isArray(value)) return undefined;
    return value.slice(0, 16).map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const item = {};
        for (const key of ['path', 'before', 'after', 'oldText', 'newText']) {
            if (entry[key] === undefined) continue;
            const field = entry[key];
            item[key] = typeof field === 'string' ? field.slice(0, 2000)
                : (field === null || ['number', 'boolean'].includes(typeof field) ? field : '[omitted]');
        }
        return Object.keys(item).length ? item : null;
    }).filter(Boolean);
}

function reviewOperation(receipt) {
    const command = boundedString(receipt?.command || receipt?.toolName, 120) || 'unknown';
    const operationId = boundedString(receipt?.operationId, 80);
    const unresolved = ['unknown', 'possible'].includes(receipt?.sideEffect) || receipt?.outcome === 'needs-review';
    const status = unresolved ? 'needs-review'
        : receipt?.success === true ? (boundedString(receipt?.outcome, 80) || 'success')
            : (boundedString(receipt?.outcome, 80) || 'failed-or-no-receipt');
    return { command, ...(operationId ? { operationId } : {}), status,
        ...(receipt?.errorCode ? { errorCode: boundedString(receipt.errorCode, 120) } : {}) };
}

export function buildTaskReview(run) {
    const receipts = Array.isArray(run?.receipts) ? run.receipts.slice(-32) : [];
    const codeChanges = [];
    const sceneChanges = [];
    const otherWrites = [];
    const operations = [];
    for (const receipt of receipts) {
        if (!receipt || receipt.access === 'read') continue;
        const command = String(receipt.command || receipt.toolName || '');
        const diff = boundedDiff(receipt.expectedDiff || receipt.script?.expectedDiff);
        const operation = reviewOperation(receipt);
        operations.push(operation);
        const item = {
            ...operation,
            ...(receipt.sceneTarget && typeof receipt.sceneTarget === 'object' ? { sceneTarget: {
                ...(boundedString(receipt.sceneTarget.path, 240) ? { path: boundedString(receipt.sceneTarget.path, 240) } : {}),
                ...(boundedString(receipt.sceneTarget.uuid, 80) ? { uuid: boundedString(receipt.sceneTarget.uuid, 80) } : {}),
                ...(boundedString(receipt.sceneTarget.name, 120) ? { name: boundedString(receipt.sceneTarget.name, 120) } : {}),
            } } : {}),
            ...(receipt.sceneName ? { sceneName: boundedString(receipt.sceneName, 120) } : {}),
            ...(receipt.script?.scriptPath ? { path: boundedString(receipt.script.scriptPath, 240) } : {}),
            ...(receipt.script?.scriptUuid ? { uuid: boundedString(receipt.script.scriptUuid, 80) } : {}),
            ...(receipt.script?.sourceSha256 ? { beforeSha256: boundedString(receipt.script.sourceSha256, 64) } : {}),
            ...(receipt.script?.afterSha256 ? { afterSha256: boundedString(receipt.script.afterSha256, 64) } : {}),
            ...(diff?.length ? { expectedDiff: diff } : {}),
            evidence: 'tool-receipt',
        };
        if (command.startsWith('script.') || String(receipt.toolName || '').includes('script_patch')) codeChanges.push(item);
        else if (command.startsWith('scene.') || command.startsWith('prefab.') || command.startsWith('workflow.')
            || command.startsWith('assets.scene.') || String(receipt.toolName || '').includes('scene_')) sceneChanges.push(item);
        else otherWrites.push(item);
    }
    const uncertain = operations.some((item) => item.status === 'needs-review')
        || Boolean(run?.activeTool && run.activeTool.access !== 'read');
    const verificationPending = operations.some((item) => ['needs-preview', 'needs-runtime', 'in-progress', 'pending']
        .some((state) => item.status.includes(state)));
    const recovery = run?.recovery?.receipt;
    const recoveryDisposition = recovery?.reconciliation?.disposition || recovery?.operation?.reconciliation?.disposition;
    const recoveryConflict = recoveryDisposition === 'conflict' || recoveryDisposition === 'blocked';
    return {
        version: 1,
        source: 'recorded-command-receipts',
        completeness: 'receipt-scope-only',
        status: recoveryConflict ? 'conflict' : uncertain ? 'needs-review'
            : verificationPending ? 'verification-pending' : (run?.status || 'running'),
        codeChanges: codeChanges.slice(-24),
        sceneChanges: sceneChanges.slice(-24),
        otherWrites: otherWrites.slice(-24),
        operations: operations.slice(-32),
        ...(recovery ? { recovery: {
            operationId: boundedString(run.recovery.operationId, 80),
            status: recoveryConflict ? 'conflict' : boundedString(recovery.outcome || recovery.status, 80) || 'read-back',
            disposition: boundedString(recoveryDisposition, 80),
        } } : {}),
        note: 'This review summarizes CocosAgent receipts only. It is not a complete project/Git diff and does not prove unreported disk or editor changes are absent.',
    };
}
