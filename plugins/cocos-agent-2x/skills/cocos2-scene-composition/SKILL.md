---
name: cocos2-scene-composition
description: Compose multiple related nodes in a Cocos Creator 2.4.15 scene with the durable CocosAgent workflow tools. Use for requests to create a parent-child hierarchy, place multiple existing Sprite assets, add a Label, or validate compensation and replay of a multi-step scene edit.
---

# Creator 2.4.15 scene composition

Use this skill only with the registered Creator **2.4.15** MCP tools. It does not describe Creator 3.8 support.

## Before planning

1. Call `cocos_2x_instances_list`; select the exact registered project that is ready and matches the requested project.
2. Call `cocos_2x_instances_get` and `cocos_2x_capabilities_list` for that project. Require the intended `scene.node.create` operation to be available.
3. Read `cocos_2x_scene_snapshot` with `input: {}` and inspect the exact existing parent node with `cocos_2x_scene_node_inspect`. Use its returned path and UUID as the first step's parent; do not guess identities.
4. For every requested existing Sprite asset, use `cocos_2x_asset_search_png`. Continue only with a unique match whose import metadata is valid; use its exact `spriteFrameUuid`. Ask the user to choose when the requested asset is ambiguous.

## Plan and execute

- Call `cocos_2x_workflow_plan` before any write. Provide 2–8 ordered steps with unique IDs and sibling names. The first step must attach to an inspected existing node. Later steps may use `{ "ref": "earlier-step-id" }` to parent beneath a node created by this workflow.
- Each 2.4 node may have at most one component. Use a `cc.Sprite` component with a verified SpriteFrame UUID or a `cc.Label` component with the requested text. Put Sprite and Label on separate nodes. Inspect existing Canvas children and their transforms before placement. Keep the composition parent near the Canvas origin unless there is a reason to offset the whole group; arrange the children relative to that parent. Account for the full Sprite extents and Label width, leave margins from the visible edges, and avoid overlapping existing content. Coordinates are Canvas local design pixels, each within ±4096.
- Review the target scene, names, assets, transforms, and ready result. Then call `cocos_2x_workflow_execute` once with a fresh UUID `workflowId` and the same steps.
- After a timeout, query `cocos_2x_workflow_get` and each known child operation with `cocos_2x_operation_get`. Never repeat `workflow.execute` with a new ID or guess whether a write happened. Use `cocos_2x_operation_reconcile` only when its preconditions apply.

## Readback and preview acceptance

- Require the workflow receipt to be `completed`. Inspect each created node by its exact path; verify node UUID, component type, SpriteFrame UUID or Label text, parent path, position, and scale. The durable operation receipts must report disk readback passed.
- Open the matching local Creator 2.4 Web preview and visually inspect the whole composition. Confirm every requested Sprite and all of the Label are fully inside the viewport, distinguishable from existing content, and not overlapping. If anything is clipped or covered, do not accept it; compensate or revise the layout and preview again. Only after viewing an acceptable result, record `cocos_2x_operation_preview_accept` for each component-bearing step's returned `operationId`, with the exact preview URL, observation time, and a short description of what was visible. A runtime structure preview or scene file alone is not visual evidence.
- If the task requires reopen validation, switch to another scene and reopen the original scene through Creator, then re-inspect all created nodes and visually verify the same preview again.

## Compensation and replay

- Compensation removes the workflow-created nodes in reverse order. Call `cocos_2x_workflow_compensate` only when the workflow is fully resolved; then call `cocos_2x_workflow_get` and inspect every target path to confirm the nodes are absent from the active scene and serialized scene.
- Replay requires the original workflow to be fully compensated. Call `cocos_2x_workflow_replay` with its `sourceWorkflowId` and a new `workflowId`. Verify it as a fresh composition, including readback and visible preview; do not reuse operation IDs.
- If the requested acceptance includes cleanup, compensate the replay as well and verify every node is absent. Compare the original scene file digest when the task promises restoration to its prior bytes. Preserve unrelated user edits and stop for review if the exact target state is uncertain.

## Report evidence precisely

Distinguish editor structure preview, serialized-scene readback, actual pixel visibility, reopen readback, compensation, and replay. Report only phases observed in the tool receipts or the opened matching preview. The composition contract and known limits are documented in [`scene-composition-0.1.md`](../../references/agent-foundation/scene-composition-0.1.md).
