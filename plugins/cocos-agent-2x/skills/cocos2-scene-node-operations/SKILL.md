---
name: cocos2-scene-node-operations
description: Modify whitelisted Cocos Creator 2.4.15 scene-node properties, create or instantiate Prefabs, and verify saved scene, runtime preview, compensation, and replay through CocosAgent.
---

# Cocos Creator 2.4.15 scene-node operations

Use only with the `cocos-agent-2x` MCP tools and the exact ready Creator 2.4.15 project. Read [the operation contract](../../references/agent-foundation/scene-node-patch-prefab-0.1.md) and the [official 2.4 Prefab manual](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html). Creator 3.8 is out of scope for these commands.

## Patch an existing node

1. Query `cocos_2x_instances_list/get` and `cocos_2x_capabilities_list`; require `scene.node.patch` to be available for the selected project.
2. Read the exact node with `cocos_2x_scene_node_inspect`. Supply its scene path and Creator UUID, then express every requested field as `{path,before,after}`. The supported fields are node name/active/2D position/scale, Sprite enabled/SpriteFrame UUID, and Label enabled.
3. Execute with a fresh `operationId`. The extension checks every before value against the live node and rejects sibling-name conflicts before writing. The Host verifies the live node and serialized `.fire`, then the 2.4 Web preview checks the requested after values.
4. Require `phases.preview=passed` for a visible patch. After viewing the exact local Web preview, record visual evidence with `cocos_2x_operation_preview_accept`. `cocos_2x_operation_get` is read-only and returns the durable record.
5. For undo, invert the original expected diff and pass its operation ID as `sourceOperationId` with a fresh operation ID. For redo, replay from the completed compensation record with another fresh ID. A rename retains its original path anchor, while lookup requires the current name and the original UUID to agree.

## Create and instantiate a Prefab

- To create, call `scene.node.create` with `prefabMode:"create"` and the permitted component/transform inputs. Creator 2.4.15's scene IPC consumes `db://assets` as a destination directory and appends `<node.name>.prefab`; the bridge temporarily gives the new root a unique operation-derived name, restores the requested scene-instance name, and verifies UUID, `.meta`, file hash, scene reference, and preview.
- To instantiate, use `prefabMode:"instantiate"`, an AssetDB-confirmed `prefabUuid`, a new node name, and optional 2D transform. Omit `components`: the instance inherits its components and SpriteFrame from the Prefab. Verify the live/disk prefab link and visible preview.
- Compensation of an instance removes only that exact scene instance. Compensation of a Prefab creation removes its scene instance first, then deletes the owned Prefab only after identity/hash and serialized references match. Require the editor and disk receipts to pass; a `needs-review` or missing operation record requires live and disk reconciliation before any new write.
- Replay from a completed compensation uses a fresh operation ID. It creates a new Prefab resource path and may receive a new UUID; always use the replay receipt's current UUID for later instantiation.

Do not edit Prefab source contents through a scene-instance patch. Changing a Prefab source in Prefab edit mode is a separate workflow and has not been validated by this skill.
