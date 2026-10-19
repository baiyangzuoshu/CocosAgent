# Cocos Creator Agent

This is the third-party Codex / Claude Code plugin for Cocos Creator 2.4.15. It has its own Host integration and does not require the retired Creator-native CocosAgent runtime.

The package contains 51 core Creator workflow Skills plus one CLI operations Skill (52 Skills total), a local MCP adapter, and Creator workflow guidance. The CLI Skill covers installing, updating, and invoking the separate host-independent Cocos Creator CLI package. The CLI also serves people, scripts, and CI without requiring this plugin.

## First vertical slice

The initial command contract is read-only and requires Creator 2.4.15:

- `creator.project.info`: current project and scene identity.
- `creator.project.search`: bounded file/path and JS/TS source search under `assets/`.
- `creator.asset.search`: bounded asset search through Creator AssetDB.
- `creator.script.read`: JS/TS source plus `.meta` UUID and SHA-256 identities.
- `creator.scene.snapshot`: bounded active scene hierarchy.

The bridge binds only to `127.0.0.1`, uses a per-user token file with restrictive permissions, and requires every call to target an explicit connected `instanceId`. It rejects version, extension, and command-contract mismatches. No write command is advertised in this release.

## Setup

1. Install this plugin in Codex or Claude Code. Both bundled MCP configs start the same local MCP server.
2. Install the standalone CLI independently. From this repository checkout, run `npm install --global ./tools/cocos-creator-agent-cli`; then use `cocos-creator-agent extension install --project-root /absolute/path/to/project`. A public package registry/release installer has not been published yet.
3. Reload the Creator 2.4.15 project package. The extension connects to the local bridge when the MCP server or CLI first starts it.
4. Use `cocos_instances_list` / `cocos-creator-agent instances list` to get the exact instance ID, then call only that instance.

The service state and bearer token live outside the project under `~/.cocos-creator-agent/`; `bridge stop` removes the active service descriptor. The bridge does not store model credentials.

## CLI and MCP roles

The target CLI is a standalone local tool, independently installed and updated. It manages the Creator project extension and local bridge, and exposes terminal/CI automation with structured output. The third-party plugin supplies a Skill that guides Codex / Claude in using this CLI. MCP remains the Host protocol adapter for tool discovery and structured calls.

Both interfaces must route through the same command contract, validation, instance targeting, and bridge. Do not maintain separate Creator behavior for CLI and MCP. A command may be reachable from both interfaces for terminal automation, but its implementation and contract must have one source of truth.

Current MVP: the standalone CLI implementation lives in `tools/cocos-creator-agent-cli/` and has its own npm package and executable; the third-party plugin MCP server invokes the installed command for catalog and calls. The CLI package does not yet have a published public registry/release update source. `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` is the single source for Creator command descriptions and input schemas; CLI validation/catalog and MCP tool descriptions/schemas consume it. MCP adds only its `instanceId` routing field and maps Host tool names to Creator command IDs. The plugin includes a `cocos2-cli` Skill for installing and using the executable.

## Package contents

- `skills/`: the 51 core workflow skills.
- `references/2x/`: local Creator 2.4.15 research notes. Confirm patch and platform before applying details.
- `mcp/server.mjs`: dependency-free stdio MCP adapter (current MVP).
- `tools/cocos-creator-agent-cli/`: independent CLI package, bridge, canonical command contract, and Creator extension template.
- Codex metadata: portable `plugin.json` / `mcp.json`, plus `.codex-plugin/plugin.json` compatibility metadata.
- Claude Code metadata: `.claude-plugin/plugin.json` with its bundled MCP server entry.
- Optional vendor SDK guidance is a separate package at `../cocos-creator-agent-sdk/`.

## Operating rules

Identify the exact project root and Creator patch before acting. Inspect the live instance and command catalog and use only tools they actually expose. Preserve Creator-generated `.meta` files, UUIDs, and asset references. If an operation requires a command not in the catalog, report the gap instead of claiming an editor or runtime result. Distinguish source changes, Creator acceptance, compile/build results, and runtime behavior. This first slice has no write approval, compile/Console feedback, preview control, runtime input, or business assertions; those capabilities remain unimplemented until their contracts and Creator-side approval flow exist.
