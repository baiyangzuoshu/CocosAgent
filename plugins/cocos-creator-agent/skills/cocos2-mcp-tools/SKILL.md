---
name: cocos2-mcp-tools
description: Discover and use the third-party Cocos Creator CLI, MCP, and editor tools when they are installed in the current Host.
---

# Cocos integration tool discovery

## Scope

Use this skill when Codex, Claude Code, or another supported Host is configured with the Cocos Creator third-party integration. It does not refer to the separate Creator-native CocosAgent MCP child process.

## Workflow

1. Inspect the Host's registered Cocos CLI/MCP tools and the integration's documented version.
2. Identify the exact Creator project root and match it to the intended running Creator instance before using editor commands.
3. Read the current tool catalog and each relevant input schema. Treat that live contract as authoritative over old docs and examples.
4. Use dedicated read operations only when the live catalog exposes them; inspect operation receipts only if that integration provides them.
5. Before a write, capture the affected identities and current state; follow the Host and Creator-side approval policy.
6. Read back the same target after the operation. For uncertain writes, reconcile the original operation ID before retrying if the tool supplies one.

## If the integration is unavailable

Do not invent tool names, MCP resource URIs, command schemas, or an active Creator instance. Use ordinary Host file tools only for files they can safely edit. For editor-owned state that lacks a Creator-aware operation, report the missing capability and provide a manual Creator workflow.

## Evidence

Report the Host, plugin/integration version, Creator version and project identity, and the readback or tool/operation receipt actually returned. A successful MCP handshake does not prove an editor operation or game behavior succeeded.
