---
name: cocos2-scene-composition
description: Use when composing a new Creator 2.4.x scene hierarchy; route existing-node edits to cocos2-scene-node-operations.
---

# Scene composition

## Scope

Create or update a related Cocos Creator 2.4.x scene hierarchy with a bounded, verifiable node set.

Use this Skill for related sets of new scene nodes. Route edits to an existing node or component, including rename, reparent, transform, active state, properties, and Button events, to `cocos2-scene-node-operations`. Route serialized Prefab source edits to `cocos2-prefab-source-edit`.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Inspect the active scene, target parent, existing assets/components, and relevant UI resolution before planning.
4. List the desired nodes, parent-child order, transforms, components, and final values before execution.
5. If the live catalog offers `creator.scene.compose.plan`, express up to 32 nodes (depth 6), 64 registered components, typed scalar/resource/exact node or component reference properties, and up to 32 UI event-list bindings (12 entries each) in one plan. `anchorX`/`anchorY` are optional. Keep `buttonEvents` for compatible Button input; use `uiEvents` for the whitelisted Button, Toggle, ToggleContainer, Slider, ScrollView, PageView, and EditBox event properties. Existing nodes may be parents, exact property references, or event targets. A new node may instantiate an exact AssetDB Prefab with `prefabUuid`; its root transform still requires the eight legacy fields. Prefab roots are instantiated as authored and cannot receive added components or event edits. Review generated UUIDs and before-state, then commit with its operation ID and plan hash. Creator may resolve width or height for nodes sized by `cc.Label`, `cc.Widget`, or Prefab-authored UI components, and may reposition children of a declared non-NONE `cc.Layout`; the first post-create snapshot is the exact live baseline for later verification and compensation drift checks. The saved scene may contain finite Layout-owned child x/y values resolved by Creator; other serialized transform fields are checked against the operation snapshot. Never hand-edit serialized scene files.
6. On uncertain completion, call `creator.scene.compose.reconcile` with the original operation ID; never replay the commit. Treat `completed` as persistence evidence only when `scenePersistenceConfirmed` is true. `sceneSaveCompletionConfirmed` remains false because Creator documents no acknowledgement for the save IPC. Read back every node and reference through Creator, then verify the requested interaction in preview.
7. For a completed, persisted operation, `creator.scene.compose.compensate.plan` derives the only nodes it may remove from the source operation. It refuses changed disk hashes or live node/component/event state. Review the deletion roots and original `.fire`/`.meta` hashes before commit; reconcile an interrupted compensation without replaying it.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. `creator.scene.compose` is limited to new scene nodes and registered components; it can instantiate a Prefab but cannot edit Prefab source, apply/revert instance overrides, edit existing component properties, or import resources. Use the Host file tools for ordinary code and project text files. For Prefab source changes, resource imports, or editor state outside the live schema, use a Creator-aware tool when available; otherwise report the exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
