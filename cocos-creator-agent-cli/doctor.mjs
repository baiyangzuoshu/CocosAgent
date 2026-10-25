import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bridgeStatus, listInstances, getCapabilities } from './bridge/client.mjs';
import { CREATOR_VERSION, PROTOCOL_VERSION, SUPPORTED_CREATOR_VERSIONS, isSupportedCreatorVersion } from './bridge/contracts.mjs';
import { extensionStatus, validateProjectRoot } from './extension-lifecycle.mjs';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));

function check(id, status, message, details = undefined) {
  return { id, status, message, ...(details === undefined ? {} : { details }) };
}

function sourceFingerprint() {
  const contractPath = path.join(PACKAGE_ROOT, 'creator-extension/command-contract.json');
  const bytes = fs.readFileSync(contractPath);
  const contract = JSON.parse(bytes.toString('utf8'));
  return { sha256: createHash('sha256').update(bytes).digest('hex'), contract };
}

export async function runDoctor({ packageInfo, projectRoot: requestedProjectRoot, instanceId: requestedInstanceId } = {}) {
  const checks = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push(check('node-version', nodeMajor >= 20 ? 'pass' : 'error',
    nodeMajor >= 20 ? `Node.js ${process.versions.node} meets the CLI requirement.` : `Node.js ${process.versions.node} is below the required version 20.`,
    { required: '>=20', actual: process.versions.node }));
  checks.push(check('cli-package', packageInfo?.name === 'cocos-creator-agent-cli' ? 'pass' : 'error',
    packageInfo?.name === 'cocos-creator-agent-cli' ? `CLI ${packageInfo.version} is loaded.` : 'CLI package metadata is invalid.',
    { name: packageInfo?.name || null, version: packageInfo?.version || null, entry: process.argv[1] || null }));
  const npmResult = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], {
    encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true,
  });
  checks.push(check('npm', npmResult.status === 0 ? 'pass' : 'warning',
    npmResult.status === 0 ? `npm ${npmResult.stdout.trim()} is available for global CLI updates.` : 'npm is not available; self-update cannot replace the global CLI package.',
    npmResult.status === 0 ? { version: npmResult.stdout.trim() } : { error: npmResult.error?.message || npmResult.stderr?.trim() || 'npm command failed' }));

  let fingerprint = null;
  let extensionPackage = null;
  try {
    fingerprint = sourceFingerprint();
    const extensionMetadataPath = path.join(PACKAGE_ROOT, 'creator-extension/package.json');
    extensionPackage = JSON.parse(fs.readFileSync(extensionMetadataPath, 'utf8'));
    const valid = fingerprint.contract.creatorVersion === CREATOR_VERSION
      && JSON.stringify(fingerprint.contract.supportedCreatorVersions) === JSON.stringify(SUPPORTED_CREATOR_VERSIONS)
      && extensionPackage.name === 'cocos-creator-agent-extension'
      && extensionPackage['cocos-creator-agent']?.creatorVersion === CREATOR_VERSION;
    checks.push(check('bundled-extension', valid ? 'pass' : 'error',
      valid ? `Bundled extension ${extensionPackage.version} targets Creator ${CREATOR_VERSION}.` : 'Bundled extension metadata does not match the CLI command contract.',
      { version: extensionPackage.version || null, creatorVersion: fingerprint.contract.creatorVersion || null,
        commandCount: fingerprint.contract.commands?.length || 0, contractSha256: fingerprint.sha256 }));
  } catch (error) {
    checks.push(check('bundled-extension', 'error', 'Could not read the bundled Creator extension or command contract.', { error: error.message }));
  }

  let canonicalProjectRoot = null;
  if (requestedProjectRoot) {
    try {
      canonicalProjectRoot = validateProjectRoot(requestedProjectRoot);
      const projectData = JSON.parse(fs.readFileSync(path.join(canonicalProjectRoot, 'project.json'), 'utf8'));
      const extension = extensionStatus(canonicalProjectRoot, path.join(PACKAGE_ROOT, 'creator-extension'));
      const state = !extension.installed ? 'warning' : (!extension.safeToReplace ? 'error'
        : (!extension.managed || extension.updateAvailable ? 'warning' : 'pass'));
      checks.push(check('project-extension', state,
        !extension.installed ? 'The Creator extension is not installed in this project.'
          : !extension.safeToReplace ? (extension.managed
            ? 'The installed extension differs from its recorded baseline; update or uninstall is blocked without --force.'
            : 'The installed extension has no CLI ownership baseline and differs from the current bundle; inspect its status before using --force.')
            : !extension.managed ? 'The extension matches the current bundle but has no CLI install baseline; run extension update to record one.'
            : extension.updateAvailable ? (extension.extensionVersion !== extension.bundledVersion
              ? `Project extension ${extension.extensionVersion} can be updated to bundled version ${extension.bundledVersion}.`
              : 'The bundled extension files changed; refresh them with extension update.')
            : `Project extension ${extension.extensionVersion} is present and its tracked files match the recorded baseline.`,
        { projectName: projectData.name || path.basename(canonicalProjectRoot), projectRoot: canonicalProjectRoot,
          extensionPath: extension.extensionPath, extensionVersion: extension.extensionVersion || null,
          bundledVersion: extension.bundledVersion, managed: extension.managed || false,
          changedFiles: extension.changedFiles || [] }));
    } catch (error) {
      checks.push(check('project-extension', 'error', 'The supplied path is not a valid, readable Creator project.', { error: error.message }));
    }
  }

  let bridge = null;
  let instances = [];
  try {
    bridge = await bridgeStatus();
    if (!bridge.running) {
      checks.push(check('bridge', 'warning',
        bridge.staleState ? 'Bridge state exists, but the local bridge is not responding.' : 'The local bridge is stopped; diagnostics did not start it.',
        bridge.staleState ? { error: bridge.error, pid: bridge.pid } : undefined));
    } else {
      const bridgeMatches = bridge.protocolVersion === PROTOCOL_VERSION
        && bridge.creatorVersion === CREATOR_VERSION
        && bridge.extensionVersion === extensionPackage?.version
        && bridge.contractFingerprint === fingerprint?.sha256;
      checks.push(check('bridge', bridgeMatches ? 'pass' : 'error',
        bridgeMatches ? 'The authenticated loopback bridge matches the bundled Creator and command contract.' : 'The running bridge uses a different Creator extension or command contract.',
        { bridgeId: bridge.bridgeId, protocolVersion: bridge.protocolVersion, host: '127.0.0.1',
          creatorVersion: bridge.creatorVersion, extensionVersion: bridge.extensionVersion,
          expectedProtocolVersion: PROTOCOL_VERSION,
          contractFingerprint: bridge.contractFingerprint || null, expectedContractFingerprint: fingerprint?.sha256 || null }));
      const result = await listInstances({ start: false });
      instances = result.instances || [];
      for (const rejected of result.rejectedInstances || []) {
        checks.push(check(`rejected-instance:${rejected.instanceId}`, 'error',
          'A Creator extension attempted to connect with an incompatible version or command contract; no command session was granted.', rejected));
      }
      checks.push(check('creator-instances', 'pass', `${instances.length} connected Creator instance(s) found.`,
        instances.map((instance) => ({ instanceId: instance.instanceId, projectRoot: instance.projectRoot,
          creatorVersion: instance.creatorVersion, extensionVersion: instance.extensionVersion, activeScene: instance.activeScene }))));
    }
  } catch (error) {
    checks.push(check('bridge', 'error', 'Could not inspect the local bridge and connected Creator instances.', { error: error.message }));
  }

  const selectedInstances = requestedInstanceId ? instances.filter((instance) => instance.instanceId === requestedInstanceId) : instances;
  if (requestedInstanceId && !selectedInstances.length) {
    checks.push(check('selected-instance', 'error', 'The requested instance ID is not connected to the local bridge.', { instanceId: requestedInstanceId }));
  }
  for (const instance of selectedInstances) {
    const identityMatches = isSupportedCreatorVersion(instance.creatorVersion)
      && (!extensionPackage || instance.extensionVersion === extensionPackage.version);
    checks.push(check(`instance:${instance.instanceId}`, identityMatches ? 'pass' : 'error',
      identityMatches ? 'Creator and extension versions match the bundled CLI contract.' : 'Creator or extension version differs from the bundled CLI contract.',
      { instanceId: instance.instanceId, projectRoot: instance.projectRoot, creatorVersion: instance.creatorVersion,
        extensionVersion: instance.extensionVersion, expectedCreatorVersion: CREATOR_VERSION,
        expectedExtensionVersion: extensionPackage?.version || null }));
    try {
      const capabilities = await getCapabilities(instance.instanceId, { start: false });
      const available = (capabilities.commands || []).filter((command) => command.status === 'available').length;
      checks.push(check(`capabilities:${instance.instanceId}`, 'pass', `${available} Creator command(s) are advertised as available.`,
        { commandCount: capabilities.commands?.length || 0, availableCount: available,
          contractFingerprint: bridge?.contractFingerprint || null }));
    } catch (error) {
      checks.push(check(`capabilities:${instance.instanceId}`, 'error', 'Could not read this instance’s live command capabilities.', { error: error.message }));
    }
  }

  if (canonicalProjectRoot) {
    const matching = instances.filter((instance) => path.resolve(instance.projectRoot) === canonicalProjectRoot);
    if (!matching.length) checks.push(check('project-instance', 'warning', 'No connected Creator instance currently reports this project path.', { projectRoot: canonicalProjectRoot }));
    if (requestedInstanceId && matching.length && !matching.some((instance) => instance.instanceId === requestedInstanceId)) {
      checks.push(check('project-instance', 'error', 'The selected instance reports a different project path.',
        { instanceId: requestedInstanceId, expectedProjectRoot: canonicalProjectRoot,
          actualProjectRoot: selectedInstances[0]?.projectRoot || null }));
    }
  }

  const errors = checks.filter((item) => item.status === 'error').length;
  const warnings = checks.filter((item) => item.status === 'warning').length;
  return { ok: errors === 0, cliVersion: packageInfo?.version || null, checks,
    summary: { passed: checks.filter((item) => item.status === 'pass').length, warnings, errors } };
}
