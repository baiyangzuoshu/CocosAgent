---
name: cocos2-scene-composition
description: Create or update a related Cocos Creator 2.4.x scene hierarchy with a bounded, verifiable node set.
---

# Scene composition

## Scope

Create or update a related Cocos Creator 2.4.x scene hierarchy with a bounded, verifiable node set.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Inspect the active scene, target parent, existing assets/components, and relevant UI resolution before planning.
4. List the desired nodes, parent-child order, transforms, components, and final values before execution.
5. If the live catalog offers `creator.scene.compose.plan`, express new nodes, transforms, registered components, typed resource properties, and Button click handlers in one bounded plan. A new node may instantiate an exact AssetDB Prefab with `prefabUuid`; provide all eight transform values for that root. Prefab roots are instantiated as authored and cannot receive added components or Button edits in this operation. Existing nodes may only be parents or handler targets in this operation. Review its generated UUIDs and before-state, then call commit with its operation ID and plan hash. Never hand-edit serialized scene files.
6. On uncertain completion, call `creator.scene.compose.reconcile` with the original operation ID; never replay the commit. Treat `completed` as persistence evidence only when `scenePersistenceConfirmed` is true. `sceneSaveCompletionConfirmed` remains false because Creator documents no acknowledgement for the save IPC. Read back every node and reference through Creator, then verify the requested interaction in preview.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. `creator.scene.compose` is limited to new scene nodes and registered components on non-Prefab nodes; it can instantiate a Prefab but cannot edit Prefab source, apply/revert instance overrides, edit existing component properties, or import resources. Use the Host file tools for ordinary code and project text files. For Prefab source changes, resource imports, or editor state outside the live schema, use a Creator-aware tool when available; otherwise report the exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
