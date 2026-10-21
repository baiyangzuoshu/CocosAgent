---
name: cocos2-scene-node-operations
description: Inspect or modify supported Cocos Creator 2.4.x scene nodes, component properties, and Prefab instances.
---

# Scene node operations

## Scope

Inspect or modify supported Cocos Creator 2.4.x scene nodes, component properties, and Prefab instances.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Confirm active scene, exact full node path/UUID, component type, and current values from a fresh snapshot.
4. Check the live command schema for the requested operation; refuse unknown fields and ambiguous duplicate node names. Current scene writes support renaming, reparenting, and deleting one existing non-root node; changing `Node.active`; adding or removing a registered component instance; and changing one declared public scalar or supported typed property on an exact component instance. Supported typed values are `Vec2`, `Vec3`, `Size`, `Color`, bounded scalar arrays, and exact AssetDB references to SpriteFrame, Texture2D, AudioClip, Prefab, BitmapFont, or TTFFont. Deleting a node removes its complete descendant subtree. Component removal refuses a component required by another component.
5. For rename, use `creator.scene.node.rename.plan` with exact scene/node UUIDs and the new sibling-unique name. For reparent, use `creator.scene.node.reparent.plan` with the exact existing target-parent UUID; it appends the node under that parent, preserves local transform values, and may change world position or run component lifecycle callbacks. For deletion, use `creator.scene.node.delete.plan` with exact UUIDs and review the path and full subtree count because every descendant will be removed. For `Node.active`, use `creator.scene.node.set-active.plan` to capture the exact current value. For component addition, use `creator.scene.node.add-component.plan` with the exact scene/node UUIDs and registered class name. For component removal, read the node's component list and current-session instance IDs with `creator.scene.node.read`, then use `creator.scene.node.remove-component.plan` with the exact class and instance ID. For a property edit, use `creator.scene.node.set-component-property.plan` with that exact ID, field, and schema-shaped value. Inspect the full plan and commit only after approval of that specific plan. Creator shows a native confirmation and rechecks the before-state before writing.
6. Component constructors/lifecycle hooks, destruction hooks, and property setters are project or engine code and may run. Arbitrary objects, inherited/internal fields, unsupported resource classes, and existing Button click-event edits are not available. Resource values are loaded and checked against the exact AssetDB UUID and class before assignment. Scene writes have source-level tests but still require Creator 2.4.15 editor acceptance.
7. Scene writes request save through Creator's `scene:stash-and-save` IPC and read state back through Scene Script. Creator defers destruction until its destruction queue runs; deletion binds and rechecks the full ordered descendant snapshot (up to 256 nodes), while component removal uses the exact instance ID. The receipt does not prove disk persistence because the save IPC exposes no documented completion acknowledgement.
8. For uncertainty, call the matching `creator.scene.node.*.reconcile` command with the original operation ID; it only observes and never repeats the mutation. If component reconciliation reports `needs-reconciliation`, inspect the exact node manually. If scene-edit reconciliation reports `save-required`, save manually in Creator.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
