---
name: cocos-agent
description: Use CocosAgent to inspect and operate an explicitly registered Cocos Creator 2.4.15 project, including PNG import, scene placement, Web preview, content release, and Web-Mobile build.
---

# CocosAgent for Creator 2.4.15

Use the `cocos-agent-2x` MCP server only for Creator **2.4.15**. The MCP host supplies the model; this plugin does not request or store an LLM API key. The registered project roots are a local allowlist. Never invent a project path or target 3.8 from these tools.

## Select the editor and discover commands

1. Call `cocos_2x_instances_list` and choose the exact registered project whose Creator version is `2.4.15` and state is `ready`.
2. Call `cocos_2x_instances_get` and `cocos_2x_capabilities_list` with that exact `projectRoot`.
3. Continue only when the requested command is currently `available`. The live catalog is authoritative for command inputs, access level, preconditions, and editor state.
4. For read-only work, use the dedicated `cocos_2x_scene_snapshot`, `cocos_2x_scene_node_inspect`, `cocos_2x_asset_search_png`, and `cocos_2x_asset_validate_png` tools. Use `cocos_2x_command_execute` only for a user-requested write command; it can invoke every catalog command and therefore requires approval.
5. Do not use arbitrary scripts, raw WebSocket messages, or direct scene-file editing as a substitute for an editor command.

## Choose a workflow

- **Inspect only:** use the instance, capability, scene snapshot, scene inspect, asset search, release, operation, and build read tools. Do not write while the user asked only for analysis.
- **Place an existing project PNG:** call `cocos_2x_asset_search_png` with `input.query`; require one unambiguous result with valid metadata. Inspect the exact parent with `cocos_2x_scene_node_inspect`, then use `cocos_2x_command_execute` with `scene.node.create` and the returned SpriteFrame UUID. Read the operation and scene back. Inspect the matching local Web preview before recording visual acceptance.
- **Import new PNGs into the scene:** call `cocos_2x_assets_scene_plan` first. Check source identities, Canvas, positions, and pipeline ID. Execute once with that plan; then read `assets_scene_get` and `assets_scene_validate`, and inspect every Sprite in the corresponding local Web preview. Record preview acceptance per operation only after seeing it.
- **Create or select a content release:** derive it from a completed, visually accepted scene pipeline. Review IDs, dependencies, entry asset, UUIDs, and fingerprint. Stage only when the user requested release staging. Read the current pointer before select/rollback and use its exact expected value.
- **Build and run:** plan the selected release, execute only a ready Web-Mobile build plan, read its persisted build receipt, then start the preview for that verified build. Inspect the runtime receipt and stop the preview when finished.
- **Asset Bundle:** use the Bundle plan/stage workflow only for Creator 2.4.15. Keep Bundle delivery status distinct from the built-in `resources` delivery status.

## Write safety and recovery

Scene edits, imports, deletion, release selection, and builds change project state. Explain the intended target and expected change before invoking a write tool when the user’s request is ambiguous. Respect MCP approval prompts.

Read each tool result’s `success`, `outcome`, phase receipts, error code, operation ID, pipeline ID, and build ID. When a write is uncertain, query the matching receipt and reconcile only through its documented recovery path. Never repeat an import, scene write, or build blindly after a timeout. Do not claim preview acceptance from source files, disk readback, or headless-only observations. Compensation is a separate action; use it when the user asks to undo or when the selected workflow explicitly requires cleanup.

Do not describe 3.8 behavior as implemented. This plugin’s MCP tool set and validation status are version-specific to Creator 2.4.15.
