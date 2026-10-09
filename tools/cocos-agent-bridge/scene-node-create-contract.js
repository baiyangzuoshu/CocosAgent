'use strict';

const path = require('path');

function prefabRootName(manifest) {
    if (!manifest || manifest.prefabMode !== 'create' || typeof manifest.prefabUrl !== 'string'
        || !/^db:\/\/assets\/CocosAgentPrefab_[0-9a-f-]{36}\.prefab$/i.test(manifest.prefabUrl)) return null;
    return path.basename(manifest.prefabUrl, '.prefab');
}

function expectedDiffFor({ action, parentPath, parentUuid, nodeName, components, transform,
    prefabMode, prefabUuid, prefabUrl }) {
    const node = { exists: true, name: nodeName, parentPath, parentUuid,
        components: components || [], transform: transform || {},
        ...(prefabMode ? { prefabMode,
            prefabUuid: prefabMode === 'create' && action !== 'compensate' ? '$assetdb-generated' : prefabUuid } : {}) };
    const expectedDiff = {
        node: { before: action === 'compensate' ? node : { exists: false },
            after: action === 'compensate' ? { exists: false } : node },
    };
    if (prefabMode === 'create') {
        expectedDiff.prefabAsset = {
            url: prefabUrl,
            before: action === 'compensate' ? { exists: true, uuid: prefabUuid } : { exists: false },
            after: action === 'compensate' ? { exists: false } : { exists: true, uuid: '$assetdb-generated' },
        };
    }
    return expectedDiff;
}

module.exports = { expectedDiffFor, prefabRootName };
