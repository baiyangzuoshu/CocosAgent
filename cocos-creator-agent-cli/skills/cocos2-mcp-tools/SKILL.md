---
name: cocos2-mcp-tools
description: Use when discovering or calling Cocos Creator MCP tools; use cocos2-cli for terminal-only CLI tasks.
---

# Cocos integration tool discovery

## Scope

Use this skill when Codex, Claude Code, or another supported Host is configured with the MCP server owned and started by the standalone Cocos Creator CLI. It does not refer to the retired Creator-native CocosAgent MCP child process. The server is registered with `cocos-creator-agent mcp configure <client>` and runs `cocos-creator-agent mcp serve`. For terminal or CI use of the same contract and commands, load `cocos2-cli`.

## Workflow

1. Inspect the Host's registered Cocos MCP tools and the integration's documented version.
2. Identify the exact Creator project root and match it to the intended running Creator instance before using editor commands.
3. Read the current tool catalog and each relevant input schema. Treat that live contract as authoritative over old docs and examples.
4. Use dedicated read operations only when the live catalog exposes them; inspect operation receipts only if that integration provides them.
5. Before a write, capture the affected identities and current state. Codex assesses the exact plan and tool risk, informs the user about material risks, then invokes the explicit commit tool when authorized by the task.
6. Read back the same target after the operation. For uncertain writes, reconcile the original operation ID before retrying if the tool supplies one.

## Current packaged command slice

The Creator 2.4.15 contract defines five original read commands, one exact scene-node read, three script-creation commands, three scene-node active-state commands, `creator.diagnostics.read`, and the preview session commands. Discover live availability through `cocos_capabilities_list` for an explicit `instanceId`; do not assume every command is available in every editor session. The MCP server obtains tool descriptions and input schemas from the installed CLI catalog. Project aliases are discovered with `cocos_project_tools_list`; on `tools/list`, each live available alias is also exposed as an individually named tool scoped by project fingerprint. Invoke those tools with the exact `instanceId`; if a registry hash changed, refresh the tool catalog. The generic `cocos_project_tool_call` requires the `registryHash` returned by discovery. Project registries can only alias built-in read operations.

For script creation, call the plan tool first and review its exact target, complete source preview, source hash, and absent-target precondition. For a scene write, review the scene/node UUIDs, full path, `active` before/after values, and plan hash. The commit tool executes the reviewed operation immediately without a Creator dialog; Codex assesses the effect and informs the user about material risks before invoking it. The extension rechecks project identity, contract fingerprint, and target preconditions immediately before writing. If the Host request times out or is cancelled, reconcile the original operation ID before planning again. Never retry a write automatically. The scene-node command supports only `Node.active`; it requests `scene:stash-and-save` and reads the state back in memory. Creator 2.4 exposes no documented completion acknowledgement for that save IPC, so the tool does not claim disk persistence. Diagnostics reads Creator Builder/Console events; `compile-finished` alone does not prove successful compilation. Preview start runs on explicit invocation and attaches an isolated Chromium session verified against project/scene identity; assess the effect of running project code before starting it. Observe, screenshot, input, refresh, and stop require that returned `previewSessionId`; inputs are bounded and assertions cover runtime errors, Console markers, scene/node state, and primitive component data fields. Stopping the Agent-owned browser does not stop Creator's preview server.

Use `cocos_tasks_start` for a command whose Host request should return a durable task ID immediately. Poll `cocos_tasks_status` or `cocos_tasks_list`, and use `cocos_tasks_cancel` for cooperative cancellation. After a bridge restart, explicitly resume reads with `cocos_tasks_resume`; script-creation and scene-node commits resume through their original operation ID and corresponding reconcile command. Other uncertain writes and controls are never replayed automatically.

## If the integration is unavailable

Do not invent tool names, MCP resource URIs, command schemas, or an active Creator instance. Use ordinary Host file tools only for files they can safely edit. For editor-owned state that lacks a Creator-aware operation, report the missing capability and provide a manual Creator workflow.

## Evidence

Report the Host, plugin/integration version, Creator version and project identity, and the readback or tool/operation receipt actually returned. A successful MCP handshake does not prove an editor operation or game behavior succeeded.
