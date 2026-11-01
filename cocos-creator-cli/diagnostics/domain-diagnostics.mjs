export const DIAGNOSTIC_DOMAINS = Object.freeze(['physics', 'audio', 'font', 'render']);
export const DIAGNOSTIC_PLATFORMS = Object.freeze(['web-mobile', 'web-desktop', 'android', 'ios', 'mac', 'win32']);

const error = (code) => Object.assign(new Error(code), { code });
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => plain(value) && Object.prototype.hasOwnProperty.call(value, key);
const classIn = (value, names) => names.some((name) => value === name);
const COLLIDERS = ['cc.PhysicsCollider', 'cc.PhysicsBoxCollider', 'cc.PhysicsCircleCollider',
  'cc.PhysicsPolygonCollider', 'cc.PhysicsChainCollider'];
const PHYSICS_COMPONENTS = ['cc.RigidBody', ...COLLIDERS];
const SIMPLE_COLLIDERS = ['cc.BoxCollider', 'cc.CircleCollider', 'cc.PolygonCollider'];
const COLLISION_COMPONENTS = [...PHYSICS_COMPONENTS, ...SIMPLE_COLLIDERS];
const MATERIAL_TYPES = ['cc.Material', 'cc.MaterialVariant'];

export function normalizeDiagnosticDomains(value = 'all') {
  if (value === 'all') return [...DIAGNOSTIC_DOMAINS];
  if (!DIAGNOSTIC_DOMAINS.includes(value)) throw error('DIAGNOSTICS_DOMAIN_INVALID');
  return [value];
}

export function validateDiagnosticPlatform(value = 'unknown') {
  if (value === 'unknown' || DIAGNOSTIC_PLATFORMS.includes(value)) return value;
  throw error('DIAGNOSTICS_PLATFORM_INVALID');
}

export function validateDiagnosticSessionId(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) return value;
  throw error('DIAGNOSTICS_SESSION_ID_INVALID');
}

export function validateDiagnosticEvidence(snapshotReceipt, runtimeReceipt, instanceId) {
  const snapshot = snapshotReceipt?.result;
  if (!plain(snapshot) || snapshot.available !== true)
    throw error('DIAGNOSTICS_EDITOR_SNAPSHOT_UNAVAILABLE');
  if (snapshotReceipt.instanceId !== instanceId || snapshot.instanceId !== instanceId
    || snapshotReceipt.projectRoot !== snapshot.projectRoot)
    throw error('DIAGNOSTICS_PROJECT_IDENTITY_MISMATCH');
  if (snapshotReceipt.creatorVersion !== snapshot.creatorVersion)
    throw error('DIAGNOSTICS_CREATOR_VERSION_MISMATCH');
  if (!plain(snapshot.scene) || snapshot.scene.available !== true || typeof snapshot.scene.sceneUuid !== 'string')
    throw error('DIAGNOSTICS_EDITOR_SNAPSHOT_UNAVAILABLE');
  let runtime = null;
  if (runtimeReceipt) {
    runtime = runtimeReceipt.result;
    if (!plain(runtime) || runtimeReceipt.instanceId !== instanceId || runtime.instanceId !== instanceId
      || runtimeReceipt.projectRoot !== snapshot.projectRoot || runtime.projectRoot !== snapshot.projectRoot)
      throw error('DIAGNOSTICS_PROJECT_IDENTITY_MISMATCH');
    if (runtimeReceipt.creatorVersion !== snapshot.creatorVersion || runtime.creatorVersion !== snapshot.creatorVersion)
      throw error('DIAGNOSTICS_CREATOR_VERSION_MISMATCH');
    if (runtime.sceneUuid !== snapshot.scene.sceneUuid || runtime.runtime?.scene?.uuid !== snapshot.scene.sceneUuid)
      throw error('DIAGNOSTICS_SCENE_IDENTITY_MISMATCH');
  }
  return { snapshot, runtime };
}

function makeCheck({ ruleId, domain, severity, status, title, evidence = [], recommendation,
  requiresPreview = false, targetPlatform, limitations = [] }) {
  return { ruleId, domain, severity, status, title, evidence: evidence.slice(0, 32),
    recommendation, applicability: { creatorVersions: ['2.4.15'], targetPlatform,
      requiresPreview, limitations } };
}

function componentsOf(scene) {
  return (scene?.nodes || []).flatMap((node) => (node.componentDetails || []).map((component) => ({
    node, component, type: component.className,
  })));
}

function runtimeComponents(runtime) {
  return (runtime?.runtime?.scene?.nodes || []).flatMap((node) => (node.components || []).map((component) => ({ node, component })));
}

function evidence(source, node, component, property, value, extra = {}) {
  return { source, ...(node?.uuid ? { nodeUuid: node.uuid } : {}), ...(node?.path ? { nodePath: node.path } : {}),
    ...(component?.type || component?.className ? { component: component.type || component.className } : {}),
    ...(property ? { property } : {}), ...(value === undefined ? {} : { value }), ...extra };
}

function reportAssetSet(snapshot) {
  const assetIndex = snapshot.assetIndex;
  if (!assetIndex?.available || !Array.isArray(assetIndex.assets))
    return { ready: false, ids: new Set(), typesById: new Map() };
  const ids = new Set();
  const typesById = new Map();
  for (const asset of assetIndex.assets) {
    if (typeof asset?.uuid !== 'string') continue;
    ids.add(asset.uuid);
    if (typeof asset.type !== 'string') continue;
    if (!typesById.has(asset.uuid)) typesById.set(asset.uuid, new Set());
    typesById.get(asset.uuid).add(asset.type);
  }
  return { ready: assetIndex.complete === true, ids, typesById };
}

function inspectAssetReference(assetIndex, reference, expectedTypes) {
  const uuid = reference?.assetUuid;
  if (typeof uuid !== 'string' || !uuid) return { status: 'missing', observedTypes: [] };
  if (typeof reference.assetClass === 'string' && !expectedTypes.includes(reference.assetClass))
    return { status: 'wrong-type', observedTypes: [reference.assetClass] };
  const observedTypes = [...(assetIndex.typesById.get(uuid) || [])];
  if (observedTypes.length) return { status: observedTypes.some((type) => expectedTypes.includes(type))
    ? 'resolved' : 'wrong-type', observedTypes };
  if (assetIndex.ids.has(uuid)) return { status: 'unknown-type', observedTypes: [] };
  return { status: assetIndex.ready ? 'unresolved' : 'unknown', observedTypes: [] };
}

function staticCheck({ ruleId, domain, severity, title, recommendation, entries, truncated, targetPlatform,
  requiresPreview = false, source = 'creator-editor' }) {
  if (entries.length) return makeCheck({ ruleId, domain, severity, status: 'finding', title,
    recommendation, requiresPreview, targetPlatform,
    limitations: truncated ? ['The authoring scene snapshot is truncated.'] : [],
    evidence: entries.slice(0, 32) });
  if (truncated) return makeCheck({ ruleId, domain, severity, status: 'inconclusive', title,
    recommendation, requiresPreview, targetPlatform, limitations: ['The authoring scene snapshot is truncated.'],
    evidence: [evidence(source, null, null, 'truncated', true)] });
  return makeCheck({ ruleId, domain, severity, status: 'pass', title, recommendation, requiresPreview,
    targetPlatform, evidence: [evidence(source, null, null, 'matchingComponents', 0)] });
}

export function buildDomainDiagnostics({ snapshot, runtime = null, screenshot = null, consoleEntries = [],
  domains = [...DIAGNOSTIC_DOMAINS], targetPlatform = 'unknown' }) {
  const selected = new Set(domains);
  const checks = [];
  const entries = componentsOf(snapshot.scene);
  const assetIndex = reportAssetSet(snapshot);
  const staticTruncated = snapshot.scene.truncated === true;
  const runtimeScene = runtime?.runtime?.scene;
  const runtimeTruncated = runtimeScene?.truncated === true;
  const live = runtimeComponents(runtime);
  const visualLimitations = ['Preview is a Web runtime and does not prove rendering on the requested target platform.'];

  if (selected.has('physics')) {
    const colliders = entries.filter(({ type }) => COLLIDERS.includes(type));
    checks.push(staticCheck({ ruleId: 'physics.collider-without-body', domain: 'physics', severity: 'error',
      title: 'A physics collider has no rigid body on its node.',
      recommendation: 'Add a cc.RigidBody to the same node as the collider, or remove the collider if it is unused.',
      entries: colliders.filter(({ node }) => !(node.components || []).includes('cc.RigidBody'))
        .map(({ node, component }) => evidence('creator-editor', node, component, 'components', node.components)),
      truncated: staticTruncated, targetPlatform }));

    const physicsStaticCount = entries.filter(({ type }) => PHYSICS_COMPONENTS.includes(type)).length;
    const simpleStaticCount = entries.filter(({ type }) => SIMPLE_COLLIDERS.includes(type)).length;
    const runtimePhysics = live.filter(({ component }) => PHYSICS_COMPONENTS.includes(component.type));
    const runtimeSimpleColliders = live.filter(({ component }) => SIMPLE_COLLIDERS.includes(component.type));
    const physicsComponentCount = Math.max(physicsStaticCount, runtimePhysics.length);
    const simpleColliderCount = Math.max(simpleStaticCount, runtimeSimpleColliders.length);
    const physicsExists = physicsStaticCount > 0 || runtimePhysics.length > 0;
    const simpleCollisionExists = simpleStaticCount > 0 || runtimeSimpleColliders.length > 0;
    const componentPresenceUnknown = staticTruncated && (!runtime || runtimeTruncated);
    const runtimePhysicsManager = runtime?.runtime?.physics;
    const physicsManagerReady = runtimePhysicsManager?.managerAvailable === true
      && typeof runtimePhysicsManager.managerEnabled === 'boolean';
    if (!physicsExists && !componentPresenceUnknown) {
      checks.push(makeCheck({ ruleId: 'physics.manager-disabled', domain: 'physics', severity: 'error', status: 'pass',
        title: 'No 2D rigid-body physics components are present in the inspected scene.', recommendation: 'No change is needed.',
        targetPlatform, evidence: [evidence('creator-editor', null, null, 'physicsComponentCount', 0)] }));
    } else if (!runtime || !physicsManagerReady || (componentPresenceUnknown && !physicsExists)) {
      checks.push(makeCheck({ ruleId: 'physics.manager-disabled', domain: 'physics', severity: 'error', status: 'inconclusive',
        title: 'The 2D rigid-body physics manager state could not be confirmed.',
        recommendation: 'Attach the matching Web Preview session and inspect the physics manager state.',
        requiresPreview: true, targetPlatform, limitations: [...visualLimitations,
          ...(runtimeTruncated ? ['The Preview scene snapshot is truncated.'] : [])],
        evidence: [evidence(runtime ? 'preview-runtime' : 'creator-editor', null, null, 'managerEnabled',
          runtimePhysicsManager?.managerEnabled, { physicsComponentCount })] }));
    } else {
      const enabled = runtimePhysicsManager.managerEnabled;
      checks.push(makeCheck({ ruleId: 'physics.manager-disabled', domain: 'physics', severity: 'error',
        status: enabled ? 'pass' : 'finding', title: enabled ? 'The 2D rigid-body physics manager is enabled.'
          : 'Physics components are present while the 2D rigid-body physics manager is disabled.',
        recommendation: enabled ? 'No change is needed.' : 'Enable the 2D physics manager for this runtime, or remove unused physics components.',
        requiresPreview: true, targetPlatform, limitations: visualLimitations,
        evidence: [evidence('preview-runtime', null, null, 'managerEnabled', enabled,
          { physicsComponentCount })] }));
    }

    const collisionManagerReady = runtime?.runtime?.physics?.collisionManagerAvailable === true
      && typeof runtime.runtime.physics.collisionManagerEnabled === 'boolean';
    if (!simpleCollisionExists && !componentPresenceUnknown) {
      checks.push(makeCheck({ ruleId: 'physics.collision-manager-disabled', domain: 'physics', severity: 'warning', status: 'pass',
        title: 'No simple 2D collision components are present in the inspected scene.', recommendation: 'No change is needed.',
        targetPlatform, evidence: [evidence('creator-editor', null, null, 'simpleColliderCount', 0)] }));
    } else if (!runtime || !collisionManagerReady || (componentPresenceUnknown && !simpleCollisionExists)) {
      checks.push(makeCheck({ ruleId: 'physics.collision-manager-disabled', domain: 'physics', severity: 'warning', status: 'inconclusive',
        title: 'The simple 2D collision manager state could not be confirmed.',
        recommendation: 'Attach the matching Web Preview session and inspect the collision manager state.',
        requiresPreview: true, targetPlatform, limitations: [...visualLimitations,
          ...(runtimeTruncated ? ['The Preview scene snapshot is truncated.'] : [])],
        evidence: [evidence(runtime ? 'preview-runtime' : 'creator-editor', null, null, 'collisionManagerEnabled',
          runtimePhysicsManager?.collisionManagerEnabled, { simpleColliderCount })] }));
    } else {
      const enabled = runtimePhysicsManager.collisionManagerEnabled;
      checks.push(makeCheck({ ruleId: 'physics.collision-manager-disabled', domain: 'physics', severity: 'warning',
        status: enabled ? 'pass' : 'finding', title: enabled ? 'The simple 2D collision manager is enabled.'
          : 'Simple colliders are present while the collision manager is disabled.',
        recommendation: enabled ? 'No change is needed.' : 'Enable the 2D collision manager or remove unused simple colliders.',
        requiresPreview: true, targetPlatform, limitations: visualLimitations,
        evidence: [evidence('preview-runtime', null, null, 'collisionManagerEnabled', enabled,
          { simpleColliderCount })] }));
    }

    const runtimeColliders = live.filter(({ component }) => COLLIDERS.includes(component.type));
    const noBody = runtimeColliders.filter(({ component }) => component.bodyAvailable === false);
    if (runtime && runtimeColliders.length && !runtimeTruncated) {
      if (noBody.length) {
        const check = makeCheck({ ruleId: 'physics.collider-without-body', domain: 'physics', severity: 'error', status: 'finding',
          title: 'A runtime physics collider has no rigid body.',
          recommendation: 'Add a cc.RigidBody to the same node as the collider, or remove the collider if it is unused.',
          requiresPreview: true, targetPlatform, limitations: visualLimitations,
          evidence: noBody.map(({ node, component }) => evidence('preview-runtime', node, component, 'bodyAvailable', false)) });
        const existing = checks.find((item) => item.ruleId === 'physics.collider-without-body');
        if (existing.status === 'pass') Object.assign(existing, check);
        else if (existing.status === 'finding') existing.evidence.push(...check.evidence);
      }
    }

    const groups = [...new Set([
      ...entries.filter(({ type }) => COLLISION_COMPONENTS.includes(type)).map(({ node }) => node.groupIndex),
      ...live.filter(({ component }) => COLLISION_COMPONENTS.includes(component.type)).map(({ node }) => node.groupIndex),
    ].filter(Number.isInteger))];
    const anyCollisionComponents = physicsExists || simpleCollisionExists;
    if (groups.length === 0 && !anyCollisionComponents && !staticTruncated && !runtimeTruncated) {
      checks.push(makeCheck({ ruleId: 'physics.collision-group-unmatched', domain: 'physics', severity: 'warning', status: 'pass',
        title: 'No 2D collision node groups require matrix checks.', recommendation: 'No change is needed.', targetPlatform,
        evidence: [evidence('creator-editor', null, null, 'physicsGroups', [])] }));
    } else if (!runtime || runtimeTruncated || !Array.isArray(runtime.runtime?.physics?.collisionMatrix)) {
      checks.push(makeCheck({ ruleId: 'physics.collision-group-unmatched', domain: 'physics', severity: 'warning', status: 'inconclusive',
        title: 'Runtime collision-group pairs could not be confirmed.',
        recommendation: 'Attach the matching Preview session to inspect the runtime collision matrix.', requiresPreview: true,
        targetPlatform, limitations: visualLimitations, evidence: [evidence('creator-editor', null, null, 'groupIndices', groups)] }));
    } else {
      const matrix = runtime.runtime.physics.collisionMatrix;
      const unmatched = groups.filter((group) => !Array.isArray(matrix[group]) || !matrix[group].some((value) => value === true));
      checks.push(makeCheck({ ruleId: 'physics.collision-group-unmatched', domain: 'physics', severity: 'warning',
        status: unmatched.length ? 'finding' : 'pass',
        title: unmatched.length ? 'A physics group has no enabled collision pair.' : 'Each referenced physics group has an enabled collision pair.',
        recommendation: unmatched.length ? 'Review Project Settings > Physics collision matrix for the reported groups.' : 'No change is needed.',
        requiresPreview: true, targetPlatform, limitations: visualLimitations,
        evidence: [evidence('preview-runtime', null, null, 'unmatchedGroups', unmatched)] }));
    }

    const bodies = live.filter(({ component }) => component.type === 'cc.RigidBody');
    if (!physicsExists && !staticTruncated) {
      checks.push(makeCheck({ ruleId: 'physics.contact-listener-without-handler', domain: 'physics', severity: 'warning', status: 'pass',
        title: 'No rigid bodies require contact-handler checks.', recommendation: 'No change is needed.', targetPlatform,
        evidence: [evidence('creator-editor', null, null, 'rigidBodies', 0)] }));
    } else if (!runtime || runtimeTruncated || !bodies.length) {
      checks.push(makeCheck({ ruleId: 'physics.contact-listener-without-handler', domain: 'physics', severity: 'warning', status: 'inconclusive',
        title: 'Physics contact-listener callbacks could not be confirmed.',
        recommendation: 'Attach the matching Preview session to inspect enabled listeners and component handlers.',
        requiresPreview: true, targetPlatform, limitations: visualLimitations,
        evidence: [evidence('creator-editor', null, null, 'rigidBodies', entries.filter(({ type }) => type === 'cc.RigidBody').length)] }));
    } else {
      const missingHandlers = bodies.filter(({ component }) => component.enabledContactListener && component.contactHandlers?.length === 0);
      checks.push(makeCheck({ ruleId: 'physics.contact-listener-without-handler', domain: 'physics', severity: 'warning',
        status: missingHandlers.length ? 'finding' : 'pass',
        title: missingHandlers.length ? 'A contact listener is enabled without a handler on its node.' : 'Enabled contact listeners have handlers, or no listener is enabled.',
        recommendation: missingHandlers.length ? 'Add an onBeginContact/onEndContact/onPreSolve/onPostSolve method to a component on the rigid body node.' : 'No change is needed.',
        requiresPreview: true, targetPlatform, limitations: visualLimitations,
        evidence: missingHandlers.map(({ node, component }) => evidence('preview-runtime', node, component, 'contactHandlers', component.contactHandlers)) }));
    }

    const simpleColliders = live.filter(({ node, component }) => SIMPLE_COLLIDERS.includes(component.type)
      && node.active && component.enabled !== false);
    if (simpleStaticCount === 0 && !staticTruncated && simpleColliders.length === 0) {
      checks.push(makeCheck({ ruleId: 'physics.collision-callback-missing', domain: 'physics', severity: 'warning', status: 'pass',
        title: 'No active simple colliders require collision callback checks.', recommendation: 'No change is needed.', targetPlatform,
        evidence: [evidence('creator-editor', null, null, 'simpleColliderCount', 0)] }));
    } else if (!runtime || runtimeTruncated) {
      checks.push(makeCheck({ ruleId: 'physics.collision-callback-missing', domain: 'physics', severity: 'warning', status: 'inconclusive',
        title: 'Simple collision callback presence needs the matching Preview runtime.',
        recommendation: 'Attach the matching Web Preview session to inspect callbacks on active simple collider nodes.',
        requiresPreview: true, targetPlatform, limitations: visualLimitations,
        evidence: [evidence('creator-editor', null, null, 'simpleColliderCount', simpleStaticCount)] }));
    } else if (!simpleColliders.length) {
      checks.push(makeCheck({ ruleId: 'physics.collision-callback-missing', domain: 'physics', severity: 'warning', status: 'pass',
        title: 'No active simple colliders require collision callbacks.', recommendation: 'No change is needed.', requiresPreview: true,
        targetPlatform, limitations: visualLimitations,
        evidence: [evidence('preview-runtime', null, null, 'activeSimpleColliderCount', 0)] }));
    } else {
      const missingCallbacks = simpleColliders.filter(({ component }) => component.collisionHandlers?.length === 0);
      checks.push(makeCheck({ ruleId: 'physics.collision-callback-missing', domain: 'physics', severity: 'warning',
        status: missingCallbacks.length ? 'finding' : 'pass',
        title: missingCallbacks.length ? 'An active simple collider has no onCollision callback on its node.'
          : 'Active simple collider nodes expose collision callbacks.',
        recommendation: missingCallbacks.length ? 'Add onCollisionEnter, onCollisionStay, or onCollisionExit to a component on each reported node if it must respond to simple collisions.' : 'No change is needed.',
        requiresPreview: true, targetPlatform, limitations: [...visualLimitations,
          'Callback presence does not prove that a collision occurs at runtime.'],
        evidence: missingCallbacks.map(({ node, component }) => evidence('preview-runtime', node, component,
          'collisionHandlers', component.collisionHandlers)) }));
    }
  }

  if (selected.has('audio')) {
    const sources = entries.filter(({ type }) => type === 'cc.AudioSource');
    const missingClips = [];
    for (const { node, component } of sources) {
      const clip = component.properties?.clip;
      const reference = inspectAssetReference(assetIndex, clip, ['cc.AudioClip']);
      if (reference.status === 'missing' || reference.status === 'wrong-type' || reference.status === 'unresolved')
        missingClips.push(evidence(reference.status === 'missing' ? 'creator-editor' : 'assetdb', node, component,
          reference.status === 'missing' ? 'clip' : 'clip.assetUuid', clip ?? null,
          { expectedTypes: ['cc.AudioClip'], observedTypes: reference.observedTypes }));
    }
    const assetUnavailable = sources.some(({ component }) => {
      const status = inspectAssetReference(assetIndex, component.properties?.clip, ['cc.AudioClip']).status;
      return status === 'unknown' || status === 'unknown-type';
    });
    checks.push(makeCheck({ ruleId: 'audio.clip-missing', domain: 'audio', severity: 'error',
      status: missingClips.length ? 'finding' : assetUnavailable || staticTruncated ? 'inconclusive' : 'pass',
      title: missingClips.length ? 'An AudioSource clip reference is missing or unresolved.'
        : assetUnavailable ? 'Audio clip AssetDB resolution is unavailable or incomplete.'
          : staticTruncated ? 'The scene snapshot is incomplete, so all AudioSource clip references could not be checked.'
            : 'AudioSource clip references are present and resolved.',
      recommendation: missingClips.length ? 'Assign a valid AudioClip to each reported AudioSource.'
        : assetUnavailable ? 'Re-run after AssetDB is available to confirm all AudioClip UUIDs.'
          : staticTruncated ? 'Re-run with a complete Editor scene snapshot.' : 'No change is needed.',
      targetPlatform, limitations: [...(assetUnavailable ? ['AssetDB lookup must be complete to prove a reference exists.'] : []),
        ...(staticTruncated ? ['The authoring scene snapshot is truncated.'] : [])],
      evidence: missingClips.length ? missingClips : [evidence(assetUnavailable ? 'assetdb' : 'creator-editor', null, null,
        'audioSourceCount', sources.length, { sceneTruncated: staticTruncated })] }));

    const runtimeSources = live.filter(({ component }) => component.type === 'cc.AudioSource');
    const activePlayOnLoad = runtimeSources.filter(({ node, component }) => node.active && component.enabled !== false
      && component.playOnLoad && component.clip?.uuid);
    const maxInstances = runtime?.runtime?.audio?.maxInstancesPerClip;
    const countByClip = new Map();
    for (const item of activePlayOnLoad) countByClip.set(item.component.clip.uuid, (countByClip.get(item.component.clip.uuid) || 0) + 1);
    const overLimit = Number.isInteger(maxInstances) ? [...countByClip.entries()].filter(([, count]) => count > maxInstances) : [];
    checks.push(makeCheck({ ruleId: 'audio.play-on-load-over-limit', domain: 'audio', severity: 'warning',
      status: runtime && !runtimeTruncated && Number.isInteger(maxInstances) ? (overLimit.length ? 'finding' : 'pass') : 'inconclusive',
      title: overLimit.length ? 'Active playOnLoad sources exceed the Preview per-clip instance limit.'
        : runtime && !runtimeTruncated && Number.isInteger(maxInstances) ? 'Configured playOnLoad sources are within the Preview per-clip instance limit.'
          : 'AudioSource concurrency could not be checked against the Preview limit.',
      recommendation: overLimit.length ? 'Review simultaneous playback and consider pooling or limiting repeated starts.'
        : 'Project code can start additional voices dynamically; measure real playback on the target device.',
      requiresPreview: true, targetPlatform, limitations: [...visualLimitations,
        'Static playOnLoad counts include one-shot and looping sources but do not observe later play() calls or actual overlapping playback.'],
      evidence: runtime ? overLimit.map(([uuid, count]) => evidence('preview-runtime', null, null, 'clipUuid', uuid,
        { configuredPlayOnLoadSources: count, maxInstancesPerClip: maxInstances }))
        : [evidence('creator-editor', null, null, 'playOnLoadCount', sources.filter(({ component }) =>
          component.properties?.playOnLoad === true).length)] }));
    checks.push(makeCheck({ ruleId: 'audio.release-unverified', domain: 'audio', severity: 'info', status: 'inconclusive',
      title: 'Audio cache and release behavior cannot be established from scene component data.',
      recommendation: 'Review dynamic load/play/uncache calls and shared-clip ownership in project code; use a target-device profiler for memory.',
      targetPlatform, limitations: ['This command does not scan project scripts for dynamic audio API usage.',
        'It does not estimate audio memory or prove device release behavior.',
        ...(staticTruncated ? ['The authoring scene snapshot is truncated.'] : [])],
      evidence: sources.length ? sources.map(({ node, component }) => evidence('creator-editor', node, component, 'releaseState', {
        clipUuid: component.properties?.clip?.assetUuid || null, preload: component.properties?.preload,
        playOnLoad: component.properties?.playOnLoad, scriptUsageScanned: false, verified: false,
      })) : [evidence('creator-editor', null, null, 'releaseState', {
        audioSourceCount: 0, scriptUsageScanned: false, verified: false,
      }, { sceneTruncated: staticTruncated })] }));
  }

  if (selected.has('font')) {
    const labels = entries.filter(({ type }) => type === 'cc.Label');
    const missingFonts = [];
    let fontAssetUnknown = false;
    for (const { node, component } of labels) {
      const props = component.properties || {};
      const font = props.font;
      if (props.useSystemFont === true) continue;
      const reference = inspectAssetReference(assetIndex, font, ['cc.TTFFont', 'cc.BitmapFont']);
      if (reference.status === 'missing' || reference.status === 'wrong-type' || reference.status === 'unresolved')
        missingFonts.push(evidence(reference.status === 'missing' ? 'creator-editor' : 'assetdb', node, component,
          reference.status === 'missing' ? 'font' : 'font.assetUuid', font ?? null,
          { expectedTypes: ['cc.TTFFont', 'cc.BitmapFont'], observedTypes: reference.observedTypes }));
      else if (reference.status === 'unknown' || reference.status === 'unknown-type') fontAssetUnknown = true;
    }
    checks.push(makeCheck({ ruleId: 'font.label-font-missing', domain: 'font', severity: 'error',
      status: missingFonts.length ? 'finding' : fontAssetUnknown || staticTruncated ? 'inconclusive' : 'pass',
      title: missingFonts.length ? 'A Label does not have a valid configured font.'
        : fontAssetUnknown ? 'Font AssetDB resolution is unavailable or incomplete.'
          : staticTruncated ? 'The scene snapshot is incomplete, so every Label font could not be checked.'
            : 'Label font references are present and resolved.',
      recommendation: missingFonts.length ? 'Assign a valid TTFFont or BitmapFont, or explicitly enable system-font use.'
        : fontAssetUnknown ? 'Re-run after AssetDB is available to confirm font UUIDs.'
          : staticTruncated ? 'Re-run with a complete Editor scene snapshot.' : 'No change is needed.',
      targetPlatform, limitations: [...(fontAssetUnknown ? ['AssetDB lookup must be complete to prove a font reference exists.'] : []),
        ...(staticTruncated ? ['The authoring scene snapshot is truncated.'] : [])],
      evidence: missingFonts.length ? missingFonts : [evidence(fontAssetUnknown ? 'assetdb' : 'creator-editor', null, null,
        'labelCount', labels.length, { sceneTruncated: staticTruncated })] }));

    const runtimeLabels = live.filter(({ component }) => component.type === 'cc.Label');
    const bitmapLabels = runtimeLabels.filter(({ component }) => component.font?.className === 'cc.BitmapFont');
    const missingGlyphs = bitmapLabels.filter(({ component }) => component.bitmapGlyphsAvailable && component.missingGlyphs?.length);
    const glyphUnknown = bitmapLabels.some(({ component }) => !component.bitmapGlyphsAvailable);
    checks.push(makeCheck({ ruleId: 'font.bitmap-glyph-missing', domain: 'font', severity: 'warning',
      status: missingGlyphs.length ? 'finding' : bitmapLabels.length && glyphUnknown ? 'inconclusive'
        : runtime && !runtimeTruncated ? 'pass' : labels.length || staticTruncated ? 'inconclusive' : 'pass',
      title: missingGlyphs.length ? 'A BitmapFont lacks one or more glyphs used by the current Label string.'
        : bitmapLabels.length && glyphUnknown ? 'BitmapFont glyph data is not loaded in Preview.'
          : labels.length && !runtime ? 'BitmapFont glyph coverage requires the matching Preview runtime.' : 'No missing BitmapFont glyphs were observed for the current scene strings.',
      recommendation: missingGlyphs.length ? 'Add the reported glyphs to the BitmapFont atlas or use a font with the required character coverage.'
        : 'Check localized strings and device-specific fallback fonts separately.', requiresPreview: true, targetPlatform,
      limitations: [...visualLimitations, 'Only current scene strings are checked; locale alternatives and supplementary-plane glyphs are not covered.'],
      evidence: missingGlyphs.flatMap(({ node, component }) => component.missingGlyphs.map((character) =>
        evidence('preview-runtime', node, component, 'missingGlyph', character)))
        .slice(0, 32) }));

    const shrink = runtimeLabels.filter(({ component }) => component.shrinkOverflow
      && Number.isFinite(component.fontSize) && Number.isFinite(component.actualFontSize)
      && component.actualFontSize < component.fontSize);
    checks.push(makeCheck({ ruleId: 'font.shrink-reduced-size', domain: 'font', severity: 'info',
      status: shrink.length ? 'finding' : runtime && !runtimeTruncated ? 'pass' : labels.length || staticTruncated ? 'inconclusive' : 'pass',
      title: shrink.length ? 'A Label uses a smaller actual font size because shrink overflow is active.'
        : 'No shrink-size reduction was observed for active Labels.',
      recommendation: shrink.length ? 'Confirm the reduced size remains legible at the target resolution.' : 'No change is needed.',
      requiresPreview: true, targetPlatform, limitations: visualLimitations,
      evidence: shrink.map(({ node, component }) => evidence('preview-runtime', node, component, 'actualFontSize', component.actualFontSize,
        { configuredFontSize: component.fontSize })) }));

    checks.push(makeCheck({ ruleId: 'font.visual-review', domain: 'font', severity: 'info',
      status: labels.length || staticTruncated ? 'inconclusive' : 'pass',
      title: labels.length ? 'Label glyph shape, truncation, and legibility need visual review.'
        : staticTruncated ? 'The scene snapshot is incomplete, so Label visual review scope is unknown.' : 'No Labels require visual review.',
      recommendation: labels.length || staticTruncated ? 'Review the attached Preview screenshot at the intended resolution and language.' : 'No change is needed.',
      requiresPreview: true, targetPlatform, limitations: ['No automatic pixel-level text-layout pass is claimed.',
        ...(staticTruncated ? ['The authoring scene snapshot is truncated.'] : [])],
      evidence: screenshot?.path ? [evidence('preview-screenshot', null, null, 'path', screenshot.path,
        { sha256: screenshot.sha256, sceneTruncated: staticTruncated })]
        : [evidence('creator-editor', null, null, 'labelCount', labels.length, { sceneTruncated: staticTruncated })] }));
  }

  if (selected.has('render')) {
    const sprites = entries.filter(({ type }) => type === 'cc.Sprite');
    const missingFrames = [];
    let frameUnknown = false;
    for (const { node, component } of sprites) {
      const frame = component.properties?.spriteFrame;
      const reference = inspectAssetReference(assetIndex, frame, ['cc.SpriteFrame']);
      if (reference.status === 'missing' || reference.status === 'wrong-type' || reference.status === 'unresolved')
        missingFrames.push(evidence(reference.status === 'missing' ? 'creator-editor' : 'assetdb', node, component,
          reference.status === 'missing' ? 'spriteFrame' : 'spriteFrame.assetUuid', frame ?? null,
          { expectedTypes: ['cc.SpriteFrame'], observedTypes: reference.observedTypes }));
      else if (reference.status === 'unknown' || reference.status === 'unknown-type') frameUnknown = true;
    }
    checks.push(makeCheck({ ruleId: 'render.sprite-frame-missing', domain: 'render', severity: 'warning',
      status: missingFrames.length ? 'finding' : frameUnknown || staticTruncated ? 'inconclusive' : 'pass',
      title: missingFrames.length ? 'A Sprite has no frame or its frame UUID is unresolved.'
        : frameUnknown ? 'SpriteFrame AssetDB resolution is unavailable or incomplete.'
          : staticTruncated ? 'The scene snapshot is incomplete, so every SpriteFrame reference could not be checked.'
            : 'SpriteFrame references are present and resolved.',
      recommendation: missingFrames.length ? 'Assign a valid SpriteFrame to each reported Sprite.'
        : frameUnknown ? 'Re-run after AssetDB is available to confirm SpriteFrame UUIDs.'
          : staticTruncated ? 'Re-run with a complete Editor scene snapshot.' : 'No change is needed.',
      targetPlatform, limitations: [...(frameUnknown ? ['AssetDB lookup must be complete to prove a reference exists.'] : []),
        ...(staticTruncated ? ['The authoring scene snapshot is truncated.'] : [])],
      evidence: missingFrames.length ? missingFrames : [evidence(frameUnknown ? 'assetdb' : 'creator-editor', null, null,
        'spriteCount', sprites.length, { sceneTruncated: staticTruncated })] }));

    const authoringNodes = new Map((snapshot.scene.nodes || []).filter((node) => node?.uuid).map((node) => [node.uuid, node]));
    const isInactiveInAuthoringHierarchy = (node) => {
      let current = node;
      let depth = 0;
      while (current && depth++ < 64) {
        if (current.parentUuid && current.active === false) return true;
        current = current.parentUuid ? authoringNodes.get(current.parentUuid) : null;
      }
      return false;
    };
    const renderableEntries = entries.filter(({ type }) => type === 'cc.Sprite' || type === 'cc.Label');
    const hiddenSprites = renderableEntries.filter(({ node, component, type }) => isInactiveInAuthoringHierarchy(node)
      || component.enabled === false || (type === 'cc.Sprite' && component.properties?.visible === false));
    checks.push(makeCheck({ ruleId: 'render.component-hidden', domain: 'render', severity: 'info',
      status: hiddenSprites.length ? 'finding' : staticTruncated ? 'inconclusive' : 'pass',
      title: hiddenSprites.length ? 'A Sprite or Label is inactive, disabled, or explicitly invisible.'
        : staticTruncated ? 'The scene snapshot is incomplete, so visibility could not be confirmed for every renderable.'
          : 'No Sprite or Label is statically hidden.',
      recommendation: hiddenSprites.length ? 'Confirm the reported inactive state is intentional for this scene.'
        : staticTruncated ? 'Re-run with a complete Editor scene snapshot.' : 'No change is needed.',
      targetPlatform, limitations: staticTruncated ? ['The authoring scene snapshot is truncated.'] : [],
      evidence: hiddenSprites.map(({ node, component, type }) => evidence('creator-editor', node, component, 'visibility', {
        nodeActiveInHierarchy: isInactiveInAuthoringHierarchy(node) ? false : node.active,
        componentEnabled: component.enabled, visible: type === 'cc.Sprite' ? component.properties?.visible : undefined,
      })) }));

    const materialRefs = [];
    let configuredMaterialCount = 0;
    let materialsUnknown = false;
    for (const { node, component, type } of entries.filter(({ type }) => type === 'cc.Sprite' || type === 'cc.Label')) {
      const materials = component.properties?.materials;
      if (!Array.isArray(materials) || !materials.length) continue;
      for (const material of materials) {
        if (!material?.assetUuid) continue;
        configuredMaterialCount += 1;
        const reference = inspectAssetReference(assetIndex, material, MATERIAL_TYPES);
        if (reference.status === 'resolved') continue;
        if (reference.status === 'wrong-type') {
          materialRefs.push(evidence('assetdb', node, component, 'materials.assetUuid', material.assetUuid,
            { expectedTypes: MATERIAL_TYPES, observedTypes: reference.observedTypes }));
          continue;
        }
        if (!runtime || runtimeTruncated) {
          materialsUnknown = true;
          continue;
        }
        const runtimeResolved = live.some(({ node: liveNode, component: liveComponent }) => liveNode.uuid === node.uuid
          && liveComponent.type === type && (liveComponent.materialEffects || []).some((item) => item?.material?.uuid === material.assetUuid
            && ['cc.Material', 'cc.MaterialVariant'].includes(item.material.className)));
        if (!runtimeResolved) materialRefs.push(evidence('preview-runtime', node, component,
          'materials.assetUuid', material.assetUuid, { resolved: false }));
      }
    }
    if (staticTruncated) materialsUnknown = true;
    checks.push(makeCheck({ ruleId: 'render.material-reference-unresolved', domain: 'render', severity: 'warning',
      status: materialRefs.length ? 'finding' : materialsUnknown ? 'inconclusive' : 'pass',
      title: materialRefs.length ? 'A render material reference is unresolved by AssetDB and Preview.'
        : materialsUnknown ? 'Render material references need AssetDB or Preview resolution.' : 'Render material references are resolved.',
      recommendation: materialRefs.length ? 'Assign a valid Creator 2.4 Material asset to each reported render component.'
        : materialsUnknown ? 'Attach the matching Preview or re-run after AssetDB resolution is available.' : 'No change is needed.',
      requiresPreview: materialsUnknown, targetPlatform, limitations: materialsUnknown
        ? [...visualLimitations, 'Creator built-in materials may not appear in the project AssetDB index.'] : [],
      evidence: materialRefs.length ? materialRefs : [evidence(materialsUnknown ? 'assetdb' : 'creator-editor', null, null,
        'explicitMaterialReferences', materialsUnknown ? 'unverified' : configuredMaterialCount)] }));

    const materialEffects = live.flatMap(({ node, component }) => (component.materialEffects || [])
      .filter((item) => item?.material?.uuid).map((item) => ({ node, component, item })));
    const missingEffects = materialEffects.filter(({ item }) => !item.effect?.uuid
      || (item.effect.className && item.effect.className !== 'cc.EffectAsset'));
    checks.push(makeCheck({ ruleId: 'render.material-effect-reference', domain: 'render', severity: 'warning',
      status: missingEffects.length ? 'finding' : runtime && !runtimeTruncated ? 'pass'
        : configuredMaterialCount || staticTruncated ? 'inconclusive' : 'pass',
      title: missingEffects.length ? 'A runtime Material asset has no resolved EffectAsset reference.'
        : materialEffects.length ? 'Runtime Material assets expose EffectAsset references.'
          : 'No configured runtime Material assets require EffectAsset checks.',
      recommendation: missingEffects.length ? 'Set a valid EffectAsset on each reported Material and confirm its shader works in Preview.' : 'No change is needed.',
      requiresPreview: true, targetPlatform, limitations: [...visualLimitations,
        'This checks the runtime Material-to-EffectAsset reference, not shader compilation on every target GPU.'],
      evidence: missingEffects.map(({ node, component, item }) => evidence('preview-runtime', node, component,
        'materialEffect', item.effect, { material: item.material })) }));

    const staticRenderableCount = renderableEntries.length;
    const renderables = live.filter(({ node, component }) => node.active && component.enabled !== false
      && (component.type === 'cc.Sprite' || component.type === 'cc.Label'));
    const cameras = live.filter(({ node, component }) => node.active && component.type === 'cc.Camera'
      && Number.isFinite(component.cullingMask));
    if (renderables.length && cameras.length && !runtimeTruncated) {
      const culled = renderables.filter(({ node }) => Number.isInteger(node.groupIndex)
        && !cameras.some(({ component }) => (((component.cullingMask >>> 0) & ((1 << node.groupIndex) >>> 0)) !== 0)));
      checks.push(makeCheck({ ruleId: 'render.camera-culls-active-node', domain: 'render', severity: 'warning',
        status: culled.length ? 'finding' : 'pass',
        title: culled.length ? 'An active renderable node group is excluded by every Preview camera mask.'
          : 'Active Sprite and Label nodes intersect at least one Preview camera mask.',
        recommendation: culled.length ? 'Compare the reported node group with camera culling masks and project group settings.' : 'No change is needed.',
        requiresPreview: true, targetPlatform, limitations: visualLimitations,
        evidence: culled.map(({ node, component }) => evidence('preview-runtime', node, component, 'groupIndex', node.groupIndex,
          { cameraMasks: cameras.map(({ component: camera }) => camera.cullingMask) })) }));
    } else {
      const runtimeComplete = runtime && !runtimeTruncated;
      const cameraStatus = runtimeComplete && !renderables.length ? 'pass'
        : renderables.length || runtimeTruncated || staticRenderableCount || staticTruncated ? 'inconclusive' : 'pass';
      checks.push(makeCheck({ ruleId: 'render.camera-culls-active-node', domain: 'render', severity: 'warning', status: cameraStatus,
    title: cameraStatus === 'inconclusive' ? 'Camera visibility could not be confirmed.'
      : 'No active Sprite or Label nodes require camera-mask checks.',
    recommendation: cameraStatus === 'inconclusive' ? 'Attach the matching Preview session with an active camera to inspect culling masks.'
      : 'No change is needed.',
    requiresPreview: true, targetPlatform, limitations: visualLimitations,
    evidence: [evidence(runtime ? 'preview-runtime' : 'creator-editor', null, null, 'cameraCount', cameras.length,
      { staticRenderableCount, runtimeTruncated: runtimeTruncated || false })] }));
    }

    const consoleErrors = (consoleEntries || []).filter((entry) => entry.level === 'error');
    checks.push(makeCheck({ ruleId: 'render.preview-console-errors', domain: 'render', severity: 'error',
      status: runtime ? (consoleErrors.length ? 'finding' : 'pass') : 'inconclusive',
      title: consoleErrors.length ? 'Preview reported runtime errors.' : runtime ? 'No Preview runtime errors were captured.' : 'Preview runtime errors could not be inspected.',
      recommendation: consoleErrors.length ? 'Resolve the Preview errors and capture the scene again.' : 'No change is needed.',
      requiresPreview: true, targetPlatform, limitations: visualLimitations,
      evidence: consoleErrors.slice(0, 32).map((entry) => evidence('preview-console', null, null, 'text', entry.text,
        { sequence: entry.sequence, at: entry.at })) }));
    checks.push(makeCheck({ ruleId: 'render.visual-review', domain: 'render', severity: 'info',
      status: sprites.length || entries.some(({ type }) => type === 'cc.Label') || staticTruncated ? 'inconclusive' : 'pass',
      title: sprites.length || entries.some(({ type }) => type === 'cc.Label')
        ? 'Scene appearance needs visual review.' : staticTruncated ? 'The scene snapshot is incomplete, so visual review scope is unknown.'
          : 'No Sprite or Label content requires visual review.',
      recommendation: sprites.length || entries.some(({ type }) => type === 'cc.Label') || staticTruncated
        ? 'Review the captured Preview screenshot for composition, text clipping, and target-resolution issues.' : 'No change is needed.',
      requiresPreview: true, targetPlatform, limitations: ['A screenshot capture is evidence, not an automated visual pass.',
        ...(staticTruncated ? ['The authoring scene snapshot is truncated.'] : [])],
      evidence: screenshot?.path ? [evidence('preview-screenshot', null, null, 'path', screenshot.path,
        { sha256: screenshot.sha256, sceneTruncated: staticTruncated })]
        : [evidence('creator-editor', null, null, 'spriteCount', sprites.length, { sceneTruncated: staticTruncated })] }));
  }

  const summary = { pass: 0, finding: 0, inconclusive: 0 };
  for (const check of checks) summary[check.status] += 1;
  const previewResult = runtime ? { source: 'preview-runtime', previewSessionId: runtime.previewSessionId,
    capturedAt: runtime.capturedAt || null, sceneUuid: runtime.sceneUuid,
    consoleSequence: runtime.consoleSequence } : null;
  const screenshotResult = screenshot?.available === false ? { available: false, reason: screenshot.reason }
    : screenshot?.path ? { available: true, path: screenshot.path, sha256: screenshot.sha256, bytes: screenshot.bytes } : null;
  return { schemaVersion: 1, generatedAt: new Date().toISOString(),
    project: { instanceId: snapshot.instanceId, root: snapshot.projectRoot, name: snapshot.projectName,
      creatorVersion: snapshot.creatorVersion },
    scene: { name: snapshot.scene.sceneName, uuid: snapshot.scene.sceneUuid }, domains: [...selected], targetPlatform,
    evidence: { editorSnapshot: { source: 'creator-editor', capturedAt: snapshot.capturedAt || null,
      truncated: staticTruncated, assetIndexAvailable: snapshot.assetIndex?.available === true,
      assetIndexComplete: snapshot.assetIndex?.complete === true }, preview: previewResult, screenshot: screenshotResult },
    summary, checks };
}
