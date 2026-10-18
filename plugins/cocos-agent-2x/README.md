# CocosAgent 2.x product skills

This directory is the maintained source for Creator 2.4.15 workflow skills and their references. The Creator extension packages them with the native Assistant. Creator owns the panel, model provider, approval flow, and local service lifecycle; the local MCP stdio child process is an internal CocosAgent transport started and stopped by its Assistant Host. This product does not register a Codex MCP server or require a Codex plugin.

The package is the single maintained source for the Creator-native Agent's 2.4.15 task skills. It currently contains 17 skills and ships their linked contracts, probes and acceptance records under `references/`. Docs entries for packaged skills point back to this source. This package is separate from the Codex / Claude Code skill-only plugin at `plugins/cocos-creator-agent/`; its optional SDK skill package is `plugins/cocos-creator-agent-sdk/`. Neither third-party package is loaded by this Creator extension. Before installing or updating the native package, validate its contents and reference hashes:

```sh
node plugins/cocos-agent-2x/scripts/package-skills.mjs --check
```

The Creator-managed skill service exposes `cocos://2x/skills/index`, each task skill URI, and the listed reference URIs. The index reports the Agent package version, source fingerprint, and SHA-256 for each skill and reference. Read the index before relying on an installed skill snapshot.

## Prepare the Creator extension

The extension starts its own local Assistant Host and MCP stdio child process. For development, install the pinned dependencies used by that Creator-managed service:

```sh
cd tools/cocos-agent-bridge/mcp
npm ci
cd ../../..
```

Creator installs and launches the extension for its current project. Agent tasks use the project and editor context supplied by that Creator instance, and writes remain subject to the in-panel approval policy. Use the validation steps in the packaged `cocos-agent` skill and record actual receipts; unit tests or an MCP handshake do not prove that a scene write, preview, runtime update, or build passed.

The package has no 3.x target, remote endpoint, model/API credential, arbitrary script tool, or external host registration. CocosAgent’s existing version-specific contracts and evidence remain in `docs/agent-foundation/`.

## Acceptance evidence

Historical Codex-hosted MCP adapter evidence remains in the research traces for reproducibility. Product acceptance now uses the native Creator Assistant panel, Creator-managed Host lifecycle, project disk state, and actual runtime observations.
