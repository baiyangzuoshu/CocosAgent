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
4. Check the live command schema for the requested operation; refuse unknown fields and ambiguous duplicate node names. Current scene writes support one existing node's `Node.active`, adding one Creator-registered component class when its instance count is zero and it has no implicit `requireComponent` dependency, and changing one declared public scalar property on an exact component instance.
5. For `Node.active`, use `creator.scene.node.set-active.plan` to capture the exact current value and inspect the diff. For component addition, use `creator.scene.node.add-component.plan` with the exact scene/node UUIDs and registered class name. For a scalar field edit, first read the node's component list and current-session component instance IDs with `creator.scene.node.read`, then call `creator.scene.node.set-component-property.plan` with that exact ID and field. Inspect the full before/after diff. Commit only after approval of that specific plan. Creator shows a native confirmation and rechecks the before-state before writing.
6. Component constructors/lifecycle hooks and property setters are project or engine code and may run. Scalar property changes are limited to strings, numbers, and booleans; arrays, resources, object references, internal fields, and UI event binding are not available. These new writes have source-level protocol tests but still require Creator 2.4.15 editor acceptance.
7. Scene writes request save through Creator's `scene:stash-and-save` IPC and read state back through Scene Script. The receipt does not prove disk persistence because that IPC exposes no documented completion acknowledgement.
8. For uncertainty, call the matching `creator.scene.node.*.reconcile` command with the original operation ID; it only observes and never repeats the mutation. If component reconciliation reports `needs-reconciliation`, inspect the exact node manually. If active-state reconciliation reports `save-required`, save manually in Creator.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
