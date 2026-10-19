# Cocos Creator Agent

This is the third-party Codex / Claude Code plugin for Cocos Creator 2.4.15. It has its own Host integration and does not require the retired Creator-native CocosAgent runtime.

The package contains 51 core Creator workflow Skills plus one CLI operations Skill (52 Skills total), a local MCP adapter, and Creator workflow guidance. The CLI Skill covers installing, updating, and invoking the separate host-independent Cocos Creator CLI package. The CLI also serves people, scripts, and CI without requiring this plugin.

## First vertical slice

The command contract requires Creator 2.4.15 and currently provides:

- `creator.project.info`: current project and scene identity.
- `creator.project.search`: bounded file/path and JS/TS source search under `assets/`.
- `creator.asset.search`: bounded asset search through Creator AssetDB.
- `creator.script.read`: JS/TS source plus `.meta` UUID and SHA-256 identities.
- `creator.scene.snapshot`: bounded active scene hierarchy.
- `creator.scene.node.read`: inspect one exact node by scene/node UUID, including nodes outside the bounded snapshot.
- `creator.scene.node.set-active.plan` / `commit` / `reconcile`: plan, approve, apply, and reconcile one node `active` change by scene/node UUID.
- `creator.script.create.plan`: build a non-project-mutating plan for one new JS/TS asset in an existing asset folder.
- `creator.script.create.commit`: show Creator's native approval dialog, recheck the exact plan and absent-target precondition, then create and read back that asset through AssetDB.
- `creator.script.create.reconcile`: reconcile the original operation ID after an uncertain response; never retries.
- `creator.diagnostics.read`: read bounded Builder compile events, script import failures, and Creator Console entries.
- `creator.preview.start`: ask Creator to start the active Web preview after a native approval, then attach an isolated Chromium browser to that project and scene.
- `creator.preview.observe` / `creator.preview.screenshot`: read the same session's runtime Console/state or save a PNG with its hash.
- `creator.preview.interact` / `creator.preview.refresh` / `creator.preview.stop`: perform bounded same-session input/assertions (including simple component state), reload while preserving the session ID, or close the Agent-owned browser.

The bridge binds only to `127.0.0.1`, uses a per-user token file with restrictive permissions, and requires every call to target an explicit connected `instanceId`. It rejects version, extension, and command-contract mismatches. The Creator extension stores bounded operation records outside the project with restrictive permissions. Each write requires an explicit Creator-side confirmation. Script creation rechecks its absent target and source hash before AssetDB creation; scene-node active changes recheck the scene/node UUID, path, and before-state before mutation. Both retain operation IDs for reconciliation. Creator 2.4's documented scene save IPC has no completion acknowledgement, so a scene receipt reports the save request and in-memory readback separately from persistence confirmation.

## Setup

1. Install this plugin in Codex or Claude Code. Both bundled MCP configs start the same local MCP server.
2. Install the standalone CLI independently from a versioned GitHub Release tarball, or from this repository checkout during development; see the [CLI install and update guide](../../tools/cocos-creator-agent-cli/README.md). The CLI supports `self-update --check` / `self-update`, project extension `install` / `status` / `update` / `uninstall`, and read-only `doctor` diagnostics. A release must be published before self-update can find it.
3. Reload the Creator 2.4.15 project package. The extension connects to the local bridge when the MCP server or CLI first starts it.
4. Use `cocos_instances_list` / `cocos-creator-agent instances list` to get the exact instance ID, then call only that instance.

The service state and bearer token live outside the project under `~/.cocos-creator-agent/`; `bridge stop` removes the active service descriptor. The bridge does not store model credentials.

## CLI and MCP roles

The target CLI is a standalone local tool, independently installed and updated. It manages the Creator project extension and local bridge, and exposes terminal/CI automation with structured output. The third-party plugin supplies a Skill that guides Codex / Claude in using this CLI. MCP remains the Host protocol adapter for tool discovery and structured calls.

Both interfaces must route through the same command contract, validation, instance targeting, and bridge. Do not maintain separate Creator behavior for CLI and MCP. A command may be reachable from both interfaces for terminal automation, but its implementation and contract must have one source of truth.

Current MVP: the standalone CLI implementation lives in `tools/cocos-creator-agent-cli/` and has its own npm package and executable; the third-party plugin MCP server invokes the installed command for catalog and calls. The CLI uses versioned GitHub Release tarballs rather than a public npm registry; `self-update` verifies the published SHA-256 asset before installing. The release workflow and update path are implemented in source, but are not considered published or end-to-end accepted until the first tagged release is created and installed in an isolated prefix. `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` is the single source for Creator command descriptions and input schemas; CLI validation/catalog and MCP tool descriptions/schemas consume it. Project declarations in `.cocos-agent/tools.json` can alias only built-in read commands; they cannot execute project callbacks or widen schemas. MCP discovers online project aliases as individually named tools from the live registry hash, and also exposes generic project list/call plus durable asynchronous task lifecycle tools. Preview feedback uses an Agent-owned Chromium session over CDP; Creator may also open its own browser through the documented preview IPC.

## Package contents

- `skills/`: the 51 core workflow skills.
- `references/2x/`: local Creator 2.4.15 research notes. Confirm patch and platform before applying details.
- `mcp/server.mjs`: dependency-free stdio MCP adapter (current MVP).
- `tools/cocos-creator-agent-cli/`: independent CLI package, bridge, canonical command contract, and Creator extension template.
- Codex metadata: portable `plugin.json` / `mcp.json`, plus `.codex-plugin/plugin.json` compatibility metadata.
- Claude Code metadata: `.claude-plugin/plugin.json` with its bundled MCP server entry.
- Optional vendor SDK guidance is a separate package at `../cocos-creator-agent-sdk/`.

## Operating rules

Identify the exact project root and Creator patch before acting. Inspect the live instance and command catalog and use only tools they actually expose. Preserve Creator-generated `.meta` files, UUIDs, and asset references. For script or scene writes, show the plan first; submit only the operation ID and plan hash to commit, and wait for Creator dialog approval. Reconcile uncertain operations before making a new plan; never replay writes. Project tool aliases are read-only and inherit the built-in command schema. Asynchronous tasks return a task ID; cancellation is cooperative, and only interrupted reads or documented reconcile operations may resume. Preview start executes project scripts and requires task authorization plus native Creator approval. Bind all runtime evidence to its returned preview session ID. Distinguish source readback, Creator acceptance, observed compile events, browser Console, runtime assertions, and screenshots. New write and preview commands remain subject to target Creator 2.4.15 runtime acceptance.
