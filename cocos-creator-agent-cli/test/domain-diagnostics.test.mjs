import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { validateCommand } from '../bridge/contracts.mjs';
import { DOMAIN_DIAGNOSTICS_EXPRESSION } from '../bridge/runtime-preview.mjs';
import { buildDomainDiagnostics, normalizeDiagnosticDomains, validateDiagnosticEvidence,
  validateDiagnosticPlatform, validateDiagnosticSessionId } from '../diagnostics/domain-diagnostics.mjs';
import { loadTestPlan, selectTestSuites, watchTestPlan } from '../creator-tests.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const node = (uuid, nodePath, components, componentDetails = [], groupIndex = 0) => ({
  uuid, path: nodePath, active: true, groupIndex,
  components, componentDetails: componentDetails.map(([className, properties = {}], index) => ({ index, className, properties })),
});

function snapshotFixture() {
  const clip = 'asset-audio';
  const font = 'asset-font';
  const frame = 'asset-frame';
  const nodes = [
    node('node-body', 'Root/Body', ['cc.RigidBody', 'cc.PhysicsBoxCollider'], [
      ['cc.RigidBody', { enabledContactListener: true }], ['cc.PhysicsBoxCollider', { density: 1 }],
    ]),
    node('node-collider', 'Root/LooseCollider', ['cc.PhysicsCircleCollider'], [
      ['cc.PhysicsCircleCollider', { radius: 12 }],
    ]),
    node('node-audio', 'Root/Music', ['cc.AudioSource'], [
      ['cc.AudioSource', { clip: { assetUuid: clip }, playOnLoad: true, loop: true, preload: true }],
    ]),
    node('node-audio-2', 'Root/Music2', ['cc.AudioSource'], [
      ['cc.AudioSource', { clip: { assetUuid: clip }, playOnLoad: true, loop: true, preload: true }],
    ]),
    node('node-label', 'Root/Title', ['cc.Label'], [
      ['cc.Label', { font: { assetUuid: font, assetClass: 'cc.BitmapFont' }, useSystemFont: false,
        string: 'Hello Ω', fontSize: 32, actualFontSize: 20 }],
    ]),
    node('node-sprite', 'Root/Icon', ['cc.Sprite'], [
      ['cc.Sprite', { spriteFrame: { assetUuid: frame, assetClass: 'cc.SpriteFrame' },
        materials: [{ assetUuid: 'asset-material', assetClass: 'cc.Material' }] }],
    ], 3),
  ];
  return { schemaVersion: 1, available: true, source: 'creator-editor', instanceId: 'instance-1',
    projectRoot: '/tmp/project', projectName: 'fixture', creatorVersion: '2.4.15', capturedAt: '2026-10-26T00:00:00Z',
    scene: { available: true, sceneName: 'Main', sceneUuid: 'scene-1', truncated: false, nodes },
    assetIndex: { available: true, complete: true, assets: [
      { uuid: clip, url: 'db://assets/music.mp3', type: 'cc.AudioClip' },
      { uuid: font, url: 'db://assets/font.fnt', type: 'cc.BitmapFont' },
      { uuid: frame, url: 'db://assets/icon.png/spriteFrame', type: 'cc.SpriteFrame' },
      { uuid: 'asset-material', url: 'db://assets/material.mtl', type: 'cc.Material' },
    ], unresolvedUuids: [] } };
}

function runtimeFixture(snapshot) {
  return { instanceId: snapshot.instanceId, projectRoot: snapshot.projectRoot, creatorVersion: snapshot.creatorVersion,
    creatorSessionId: 'creator-session-1', previewSessionId: 'preview-session-1', sceneUuid: snapshot.scene.sceneUuid,
    sceneName: snapshot.scene.sceneName, consoleSequence: 1,
    runtime: { available: true, scene: { uuid: snapshot.scene.sceneUuid, name: snapshot.scene.sceneName, truncated: false,
      nodes: [
        { uuid: 'node-body', path: 'Root/Body', active: true, groupIndex: 0, components: [
          { type: 'cc.RigidBody', enabled: true, enabledContactListener: true, contactHandlers: [] },
          { type: 'cc.PhysicsBoxCollider', enabled: true, bodyAvailable: true },
        ] },
        { uuid: 'node-collider', path: 'Root/LooseCollider', active: true, groupIndex: 0, components: [
          { type: 'cc.PhysicsCircleCollider', enabled: true, bodyAvailable: false },
        ] },
        { uuid: 'node-audio', path: 'Root/Music', active: true, groupIndex: 0, components: [
          { type: 'cc.AudioSource', enabled: true, playOnLoad: true, loop: true, clip: { uuid: 'asset-audio' } },
        ] },
        { uuid: 'node-audio-2', path: 'Root/Music2', active: true, groupIndex: 0, components: [
          { type: 'cc.AudioSource', enabled: true, playOnLoad: true, loop: true, clip: { uuid: 'asset-audio' } },
        ] },
        { uuid: 'node-label', path: 'Root/Title', active: true, groupIndex: 0, components: [
          { type: 'cc.Label', enabled: true, font: { uuid: 'asset-font', className: 'cc.BitmapFont' },
            bitmapGlyphsAvailable: true, missingGlyphs: ['Ω'], shrinkOverflow: true, fontSize: 32, actualFontSize: 20 },
        ] },
        { uuid: 'node-sprite', path: 'Root/Icon', active: true, groupIndex: 3, components: [
        { type: 'cc.Sprite', enabled: true, spriteFrame: { uuid: 'asset-frame', className: 'cc.SpriteFrame' },
            materialEffects: [{ material: { uuid: 'asset-material', className: 'cc.Material' }, effect: null }] },
        ] },
        { uuid: 'node-camera', path: 'Root/Camera', active: true, groupIndex: 0, components: [
          { type: 'cc.Camera', enabled: true, cullingMask: 1 },
        ] },
      ] },
      physics: { managerAvailable: true, managerEnabled: false, groupList: ['default', 'ui', 'enemy', 'hidden'],
        collisionMatrix: [[false], [false], [false], [false]] }, audio: { maxInstancesPerClip: 1 } },
  };
}

test('domain command contracts validate normal input and reject malformed/fault inputs', () => {
  assert.equal(validateCommand('creator.diagnostics.snapshot', { domains: ['physics'], maxNodes: 100 }).ok, true);
  assert.equal(validateCommand('creator.diagnostics.snapshot', { domains: ['unknown'] }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand('creator.diagnostics.snapshot', { domains: ['physics'], extra: true }).code, 'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand('creator.diagnostics.runtime', { previewSessionId: 'short', domains: ['render'] }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand('creator.diagnostics.runtime', { previewSessionId: '11111111-1111-4111-8111-111111111111', domains: ['render'] }).ok, true);
  assert.deepEqual(normalizeDiagnosticDomains('all'), ['physics', 'audio', 'font', 'render']);
  assert.deepEqual(normalizeDiagnosticDomains('font'), ['font']);
  assert.throws(() => normalizeDiagnosticDomains('network'), { code: 'DIAGNOSTICS_DOMAIN_INVALID' });
  assert.throws(() => validateDiagnosticPlatform('switch'), { code: 'DIAGNOSTICS_PLATFORM_INVALID' });
  assert.equal(validateDiagnosticSessionId('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111');
  assert.throws(() => validateDiagnosticSessionId('short'), { code: 'DIAGNOSTICS_SESSION_ID_INVALID' });
});

test('evidence binding rejects different instances, projects, Creator versions, and scenes', () => {
  const snapshot = snapshotFixture();
  const editorReceipt = { instanceId: snapshot.instanceId, projectRoot: snapshot.projectRoot,
    creatorVersion: snapshot.creatorVersion, result: snapshot };
  const runtime = runtimeFixture(snapshot);
  const previewReceipt = { instanceId: snapshot.instanceId, projectRoot: snapshot.projectRoot,
    creatorVersion: snapshot.creatorVersion, result: runtime };
  assert.deepEqual(validateDiagnosticEvidence(editorReceipt, previewReceipt, snapshot.instanceId), { snapshot, runtime });
  assert.throws(() => validateDiagnosticEvidence({ ...editorReceipt, instanceId: 'other' }, null, snapshot.instanceId),
    { code: 'DIAGNOSTICS_PROJECT_IDENTITY_MISMATCH' });
  assert.throws(() => validateDiagnosticEvidence({ ...editorReceipt, creatorVersion: '2.4.14' }, null, snapshot.instanceId),
    { code: 'DIAGNOSTICS_CREATOR_VERSION_MISMATCH' });
  assert.throws(() => validateDiagnosticEvidence(editorReceipt, { ...previewReceipt,
    result: { ...runtime, sceneUuid: 'other-scene' } }, snapshot.instanceId), { code: 'DIAGNOSTICS_SCENE_IDENTITY_MISMATCH' });
  assert.throws(() => validateDiagnosticEvidence({ ...editorReceipt, result: { ...snapshot, available: false } }, null,
    snapshot.instanceId), { code: 'DIAGNOSTICS_EDITOR_SNAPSHOT_UNAVAILABLE' });
});

test('all four domains report stable findings with bound runtime, AssetDB, Console, and screenshot evidence', () => {
  const snapshot = snapshotFixture();
  const runtime = runtimeFixture(snapshot);
  const report = buildDomainDiagnostics({ snapshot, runtime, domains: ['physics', 'audio', 'font', 'render'],
    targetPlatform: 'web-mobile', consoleEntries: [{ sequence: 1, at: '2026-10-26T00:00:00Z', level: 'error', text: 'shader failed' }],
    screenshot: { path: '/private/tmp/capture.png', sha256: 'a'.repeat(64), bytes: 2048 } });
  const findingIds = report.checks.filter((item) => item.status === 'finding').map((item) => item.ruleId);
  assert.ok(findingIds.includes('physics.manager-disabled'));
  assert.ok(findingIds.includes('physics.collider-without-body'));
  assert.ok(findingIds.includes('physics.collision-group-unmatched'));
  assert.ok(findingIds.includes('physics.contact-listener-without-handler'));
  assert.ok(findingIds.includes('audio.play-on-load-over-limit'));
  assert.ok(findingIds.includes('audio.release-unverified') === false);
  assert.ok(findingIds.includes('font.bitmap-glyph-missing'));
  assert.ok(findingIds.includes('font.shrink-reduced-size'));
  assert.ok(findingIds.includes('render.camera-culls-active-node'));
  assert.ok(findingIds.includes('render.material-effect-reference'));
  assert.ok(findingIds.includes('render.preview-console-errors'));
  assert.equal(report.checks.find((item) => item.ruleId === 'render.material-reference-unresolved').status, 'pass');
  assert.equal(report.checks.find((item) => item.ruleId === 'render.visual-review').status, 'inconclusive');
  assert.match(report.checks.find((item) => item.ruleId === 'render.visual-review').title, /visual review/);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.project.creatorVersion, '2.4.15');
  assert.equal(report.scene.uuid, 'scene-1');
  assert.equal(report.targetPlatform, 'web-mobile');
  assert.equal(report.evidence.screenshot.sha256, 'a'.repeat(64));
  assert.deepEqual(report.summary, report.checks.reduce((counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }),
    { pass: 0, finding: 0, inconclusive: 0 }));
  assert.ok(report.checks.every((item) => item.ruleId && item.recommendation && item.applicability.creatorVersions[0] === '2.4.15'));
  assert.ok(report.checks.every((item) => item.evidence.length <= 32));
  assert.ok(report.checks.every((item) => !Object.hasOwn(item, 'estimate') && !Object.hasOwn(item, 'memoryEstimate')));
});

test('all four domains pass their normal configuration and keep unobservable audio release state explicit', () => {
  const snapshot = snapshotFixture();
  const runtime = runtimeFixture(snapshot);
  snapshot.scene.nodes = snapshot.scene.nodes.filter((item) => item.uuid !== 'node-collider');
  runtime.runtime.scene.nodes = runtime.runtime.scene.nodes.filter((item) => item.uuid !== 'node-collider');
  snapshot.scene.nodes.find((item) => item.uuid === 'node-audio-2').componentDetails[0].properties.playOnLoad = false;
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-audio-2').components[0].playOnLoad = false;
  snapshot.scene.nodes.find((item) => item.uuid === 'node-label').componentDetails[0].properties.string = 'A';
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-label').components[0].missingGlyphs = [];
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-label').components[0].actualFontSize = 32;
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-label').components[0].fontSize = 32;
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-sprite').components[0].materialEffects[0].effect = {
    uuid: 'effect-1', className: 'cc.EffectAsset',
  };
  snapshot.scene.nodes.find((item) => item.uuid === 'node-sprite').groupIndex = 0;
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-sprite').groupIndex = 0;
  runtime.runtime.physics.managerEnabled = true;
  runtime.runtime.physics.collisionMatrix = Array.from({ length: 4 }, () => [true, true, true, true]);
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-body').components[0].contactHandlers = ['onBeginContact'];
  const report = buildDomainDiagnostics({ snapshot, runtime, domains: ['physics', 'audio', 'font', 'render'], consoleEntries: [] });
  assert.deepEqual(report.checks.filter((item) => item.status === 'finding'), []);
  for (const ruleId of ['physics.manager-disabled', 'physics.collider-without-body', 'physics.collision-group-unmatched',
    'physics.contact-listener-without-handler', 'audio.clip-missing', 'audio.play-on-load-over-limit',
    'font.label-font-missing', 'font.bitmap-glyph-missing', 'font.shrink-reduced-size', 'render.sprite-frame-missing',
    'render.component-hidden', 'render.material-reference-unresolved', 'render.material-effect-reference',
    'render.camera-culls-active-node', 'render.preview-console-errors'])
    assert.equal(report.checks.find((item) => item.ruleId === ruleId)?.status, 'pass', ruleId);
  const release = report.checks.find((item) => item.ruleId === 'audio.release-unverified');
  assert.equal(release.status, 'inconclusive');
  assert.ok(release.evidence.every((item) => item.property === 'releaseState' && item.value.verified === false));
});

test('reference type failures and hidden Labels produce domain findings with exact evidence', () => {
  const snapshot = snapshotFixture();
  snapshot.scene.nodes.find((item) => item.uuid === 'node-audio').componentDetails[0].properties.clip.assetClass = 'cc.SpriteFrame';
  snapshot.scene.nodes.find((item) => item.uuid === 'node-label').componentDetails[0].properties.font.assetClass = 'cc.SpriteFrame';
  snapshot.scene.nodes.find((item) => item.uuid === 'node-sprite').componentDetails[0].properties.spriteFrame.assetClass = 'cc.AudioClip';
  snapshot.scene.nodes.find((item) => item.uuid === 'node-label').componentDetails[0].enabled = false;
  const report = buildDomainDiagnostics({ snapshot, domains: ['audio', 'font', 'render'] });
  for (const ruleId of ['audio.clip-missing', 'font.label-font-missing', 'render.sprite-frame-missing', 'render.component-hidden'])
    assert.equal(report.checks.find((item) => item.ruleId === ruleId)?.status, 'finding', ruleId);
  assert.equal(report.checks.find((item) => item.ruleId === 'font.label-font-missing').evidence[0].observedTypes[0], 'cc.SpriteFrame');
  assert.equal(report.checks.find((item) => item.ruleId === 'render.component-hidden').evidence[0].component, 'cc.Label');
});

test('Creator Scene root activity is not inherited, and camera checks include Labels without Preview', () => {
  const snapshot = snapshotFixture();
  snapshot.scene.nodes = [{ uuid: 'scene-root', path: 'Main', active: false, parentUuid: null,
    components: [], componentDetails: [] }, ...snapshot.scene.nodes.map((item) => ({ ...item, parentUuid: 'scene-root' }))];
  const report = buildDomainDiagnostics({ snapshot, domains: ['render'] });
  assert.equal(report.checks.find((item) => item.ruleId === 'render.component-hidden').status, 'pass');
  assert.equal(report.checks.find((item) => item.ruleId === 'render.camera-culls-active-node').status, 'inconclusive');
});

test('simple 2D collision manager and callback checks distinguish working and faulty Preview state', () => {
  const snapshot = snapshotFixture();
  const runtime = runtimeFixture(snapshot);
  snapshot.scene.nodes.push(node('LegacyCollider', 'simple-node', ['cc.BoxCollider'], [['cc.BoxCollider', {}]], 2));
  runtime.runtime.scene.nodes.push({ uuid: 'simple-node', path: 'Root/LegacyCollider', active: true, groupIndex: 2,
    components: [{ type: 'cc.BoxCollider', enabled: true, collisionHandlers: [] }] });
  runtime.runtime.physics.collisionManagerAvailable = true;
  runtime.runtime.physics.collisionManagerEnabled = false;
  const broken = buildDomainDiagnostics({ snapshot, runtime, domains: ['physics'] });
  assert.equal(broken.checks.find((item) => item.ruleId === 'physics.collision-manager-disabled').status, 'finding');
  assert.equal(broken.checks.find((item) => item.ruleId === 'physics.collision-callback-missing').status, 'finding');
  assert.equal(broken.checks.find((item) => item.ruleId === 'physics.collider-without-body').evidence
    .some((item) => item.nodeUuid === 'simple-node'), false);

  runtime.runtime.physics.collisionManagerEnabled = true;
  runtime.runtime.scene.nodes.find((item) => item.uuid === 'simple-node').components[0].collisionHandlers = ['onCollisionEnter'];
  const healthy = buildDomainDiagnostics({ snapshot, runtime, domains: ['physics'] });
  assert.equal(healthy.checks.find((item) => item.ruleId === 'physics.collision-manager-disabled').status, 'pass');
  assert.equal(healthy.checks.find((item) => item.ruleId === 'physics.collision-callback-missing').status, 'pass');
});

test('missing Preview/AssetDB evidence remains inconclusive instead of becoming a pass', () => {
  const snapshot = snapshotFixture();
  snapshot.assetIndex = { available: false, complete: false, reason: 'ASSETDB_QUERY_UNAVAILABLE', assets: [] };
  const report = buildDomainDiagnostics({ snapshot, domains: ['audio', 'font', 'render'] });
  assert.equal(report.checks.find((item) => item.ruleId === 'audio.clip-missing').status, 'inconclusive');
  assert.equal(report.checks.find((item) => item.ruleId === 'audio.play-on-load-over-limit').status, 'inconclusive');
  assert.equal(report.checks.find((item) => item.ruleId === 'font.bitmap-glyph-missing').status, 'inconclusive');
  assert.equal(report.checks.find((item) => item.ruleId === 'font.visual-review').status, 'inconclusive');
  assert.equal(report.checks.find((item) => item.ruleId === 'render.preview-console-errors').status, 'inconclusive');
  assert.equal(report.checks.find((item) => item.ruleId === 'render.material-reference-unresolved').status, 'inconclusive');
});

test('audio release state stays unverified even when no scene AudioSource is present', () => {
  const snapshot = snapshotFixture();
  snapshot.scene.nodes = snapshot.scene.nodes.filter((item) => !item.components.includes('cc.AudioSource'));
  const report = buildDomainDiagnostics({ snapshot, domains: ['audio'] });
  const release = report.checks.find((item) => item.ruleId === 'audio.release-unverified');
  assert.equal(release.status, 'inconclusive');
  assert.equal(release.evidence[0].value.scriptUsageScanned, false);
  assert.equal(release.evidence[0].value.verified, false);
});

test('Preview resolution accepts a valid built-in material omitted from the project AssetDB', () => {
  const snapshot = snapshotFixture();
  snapshot.assetIndex.assets = snapshot.assetIndex.assets.filter((asset) => asset.uuid !== 'asset-material');
  const runtime = runtimeFixture(snapshot);
  const report = buildDomainDiagnostics({ snapshot, runtime, domains: ['render'] });
  assert.equal(report.checks.find((item) => item.ruleId === 'render.material-reference-unresolved').status, 'pass');

  const noPreview = buildDomainDiagnostics({ snapshot, domains: ['render'] });
  assert.equal(noPreview.checks.find((item) => item.ruleId === 'render.material-reference-unresolved').status, 'inconclusive');

  runtime.runtime.scene.nodes.find((item) => item.uuid === 'node-sprite').components[0].materialEffects = [];
  const unresolved = buildDomainDiagnostics({ snapshot, runtime, domains: ['render'] });
  const check = unresolved.checks.find((item) => item.ruleId === 'render.material-reference-unresolved');
  assert.equal(check.status, 'finding');
  assert.equal(check.evidence[0].source, 'preview-runtime');
});

test('MaterialVariant references resolve and truncated scene evidence never yields clean passes', () => {
  const snapshot = snapshotFixture();
  const material = snapshot.scene.nodes.find((item) => item.uuid === 'node-sprite').componentDetails[0].properties.materials[0];
  material.assetClass = 'cc.MaterialVariant';
  snapshot.assetIndex.assets.find((asset) => asset.uuid === 'asset-material').type = 'cc.MaterialVariant';
  const withVariant = buildDomainDiagnostics({ snapshot, runtime: runtimeFixture(snapshot), domains: ['render'] });
  assert.equal(withVariant.checks.find((item) => item.ruleId === 'render.material-reference-unresolved').status, 'pass');

  snapshot.scene.nodes = [];
  snapshot.scene.truncated = true;
  snapshot.assetIndex.assets = [];
  const truncated = buildDomainDiagnostics({ snapshot, domains: ['physics', 'audio', 'font', 'render'] });
  for (const ruleId of ['physics.manager-disabled', 'physics.collision-manager-disabled', 'physics.collider-without-body',
    'audio.clip-missing', 'audio.release-unverified', 'font.label-font-missing', 'font.visual-review',
    'render.sprite-frame-missing', 'render.component-hidden', 'render.material-reference-unresolved', 'render.visual-review'])
    assert.equal(truncated.checks.find((item) => item.ruleId === ruleId)?.status, 'inconclusive', ruleId);
});

test('fixed Preview expression reads bounded runtime facts without executing project callbacks', () => {
  const makeClass = (name) => {
    const Type = class {};
    Object.defineProperty(Type, '__classname__', { value: name });
    return Type;
  };
  const Component = makeClass('cc.Component');
  const RigidBody = makeClass('cc.RigidBody');
  const PhysicsBoxCollider = makeClass('cc.PhysicsBoxCollider');
  const AudioSource = makeClass('cc.AudioSource');
  const BitmapFont = makeClass('cc.BitmapFont');
  const Label = makeClass('cc.Label');
  const Sprite = makeClass('cc.Sprite');
  const Camera = makeClass('cc.Camera');
  Label.Overflow = { SHRINK: 2 };
  const node = (name, uuid, components = [], children = [], groupIndex = 0) => ({ name, uuid, children,
    activeInHierarchy: true, active: true, groupIndex, _components: components,
    getComponents: () => components, getComponent: (Type) => components.find((item) => item instanceof Type) || null });
  const contactBody = new RigidBody();
  contactBody.type = 1;
  contactBody.enabled = true;
  contactBody.enabledContactListener = true;
  contactBody.onBeginContact = () => { throw new Error('must not invoke callbacks'); };
  const collider = new PhysicsBoxCollider();
  Object.assign(collider, { enabled: true, density: 1, sensor: false, friction: 0.2, restitution: 0 });
  const clip = { _uuid: 'audio-1', constructor: makeClass('cc.AudioClip') };
  const audio = new AudioSource();
  Object.assign(audio, { enabled: true, _clip: clip, playOnLoad: true, preload: true, loop: true, volume: 0.5, mute: false });
  const font = new BitmapFont();
  font._uuid = 'font-1';
  font._fntConfig = { fontDefDictionary: { '65': {} } };
  const label = new Label();
  Object.assign(label, { enabled: true, _N$file: font, string: 'AΩ', fontSize: 24, actualFontSize: 18, overflow: 2 });
  const material = { _uuid: 'material-1', constructor: makeClass('cc.Material'),
    effectAsset: { _uuid: 'effect-1', constructor: makeClass('cc.EffectAsset') } };
  const sprite = new Sprite();
  Object.assign(sprite, { enabled: true, _spriteFrame: { _uuid: 'frame-1', constructor: makeClass('cc.SpriteFrame') },
    visible: true, _materials: [material] });
  const camera = new Camera();
  Object.assign(camera, { enabled: true, cullingMask: 1 });
  const physicsNode = node('Body', 'body-1', [contactBody, collider]);
  const audioNode = node('Music', 'audio-node', [audio]);
  const labelNode = node('Title', 'label-node', [label]);
  const spriteNode = node('Icon', 'sprite-node', [sprite], [], 3);
  const cameraNode = node('Camera', 'camera-node', [camera]);
  const scene = node('Main', 'scene-1', [], [physicsNode, audioNode, labelNode, spriteNode, cameraNode]);
  Object.defineProperty(scene, 'activeInHierarchy', { get() { throw new Error('Scene.activeInHierarchy must not be read'); } });
  const manager = { enabled: true };
  const cc = { Component, RigidBody, PhysicsBoxCollider, AudioSource, BitmapFont, Label, Sprite, Camera,
    js: { getClassName: (Type) => Type.__classname__ || Type.name },
    director: { getScene: () => scene, getPhysicsManager: () => manager },
    game: { groupList: ['default', 'ui', 'enemy', 'hidden'], collisionMatrix: [[true, false, false, false]] },
    audioEngine: { getMaxAudioInstance: () => 16 } };
  const output = runInNewContext(DOMAIN_DIAGNOSTICS_EXPRESSION, { window: { cc } });
  assert.equal(output.available, true);
  assert.equal(output.scene.uuid, 'scene-1');
  assert.equal(output.scene.nodes.length, 6);
  const rows = output.scene.nodes.flatMap((item) => item.components);
  assert.deepEqual(Array.from(rows.find((item) => item.type === 'cc.RigidBody').contactHandlers), ['onBeginContact']);
  assert.equal(rows.find((item) => item.type === 'cc.PhysicsBoxCollider').bodyAvailable, true);
  assert.equal(rows.find((item) => item.type === 'cc.AudioSource').clip.uuid, 'audio-1');
  assert.deepEqual(Array.from(rows.find((item) => item.type === 'cc.Label').missingGlyphs), ['Ω']);
  assert.equal(rows.find((item) => item.type === 'cc.Label').shrinkOverflow, true);
  assert.equal(rows.find((item) => item.type === 'cc.Camera').cullingMask, 1);
  assert.equal(rows.find((item) => item.type === 'cc.Sprite').materialEffects[0].effect.uuid, 'effect-1');
  assert.equal(output.audio.maxInstancesPerClip, 16);
  assert.equal(output.physics.managerEnabled, true);
});

test('watch --affected selects the diagnostics suite for diagnostic source changes only', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-domain-watch-')));
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'diagnostics-watch', version: '2.4.15' }));
  fs.writeFileSync(path.join(projectRoot, 'tests/diagnostics.js'), "const test=require('node:test');const assert=require('node:assert/strict');test('rules load',()=>assert.ok(true));\n");
  fs.writeFileSync(path.join(projectRoot, 'diagnostics/domain-diagnostics.mjs'), 'export const schemaVersion = 1;\n');
  fs.writeFileSync(path.join(projectRoot, '.cocos-agent/tests.json'), JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'domain-diagnostics', adapter: 'node', files: ['tests/diagnostics.js'], dependsOn: ['diagnostics/'] },
    { id: 'unrelated', adapter: 'node', files: ['tests/diagnostics.js'], dependsOn: ['assets/'] },
  ] }));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plan = loadTestPlan(projectRoot);
  assert.deepEqual(selectTestSuites(plan, { changedPaths: ['diagnostics/domain-diagnostics.mjs'] }).map((item) => item.id), ['domain-diagnostics']);
  assert.deepEqual(selectTestSuites(plan, { changedPaths: ['README.md'] }), []);
  assert.deepEqual(selectTestSuites(plan, { changedPaths: ['.cocos-agent/tests.json'] }).map((item) => item.id), ['domain-diagnostics', 'unrelated']);
});

test('watch --affected reruns the project diagnostics suite when diagnostics sources change', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-domain-watch-run-')));
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'diagnostics'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'diagnostics-watch', version: '2.4.15' }));
  fs.writeFileSync(path.join(projectRoot, 'diagnostics/domain-diagnostics.mjs'), 'export const schemaVersion = 1;\n');
  fs.writeFileSync(path.join(projectRoot, 'tests/diagnostics.test.js'),
    "const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');test('diagnostic source is readable',()=>assert.match(fs.readFileSync('diagnostics/domain-diagnostics.mjs','utf8'),/schemaVersion/));\n");
  fs.writeFileSync(path.join(projectRoot, 'tests/unrelated.test.js'),
    "const test=require('node:test');const assert=require('node:assert/strict');test('unrelated suite runs',()=>assert.ok(true));\n");
  fs.writeFileSync(path.join(projectRoot, '.cocos-agent/tests.json'), JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'domain-diagnostics', adapter: 'node', files: ['tests/diagnostics.test.js'], dependsOn: ['diagnostics/'] },
    { id: 'unrelated', adapter: 'node', files: ['tests/unrelated.test.js'], dependsOn: ['assets/'] },
  ] }));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const controller = new AbortController();
  const events = [];
  let resolveChanged;
  const changedRun = new Promise((resolve) => { resolveChanged = resolve; });
  const watchPromise = watchTestPlan({ projectRoot, paths: ['diagnostics'], intervalMs: 250, affected: true,
    reportDir: path.join(root, 'reports') }, { signal: controller.signal, onEvent(event) {
    events.push(event);
    if (event.type === 'test-run-finished' && event.trigger === 'initial')
      fs.writeFileSync(path.join(projectRoot, 'diagnostics/domain-diagnostics.mjs'), 'export const schemaVersion = 2;\n');
    if (event.type === 'test-run-finished' && event.trigger === 'file-change') {
      resolveChanged(event);
      controller.abort();
    }
  } });
  let timeoutId;
  const timeout = new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('watch did not run the affected suite')), 10000); });
  let changed;
  let result;
  try {
    changed = await Promise.race([changedRun, timeout]);
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
    result = await watchPromise;
  }
  assert.deepEqual(changed.report.selectedSuiteIds, ['domain-diagnostics']);
  assert.deepEqual(changed.report.suites.map((suite) => suite.id), ['domain-diagnostics']);
  assert.equal(changed.report.passed, true);
  assert.equal(result.runs, 2);
  assert.equal(events.filter((event) => event.type === 'test-suite-finished' && event.suiteId === 'unrelated').length, 1);
});
