---
name: cocos2-ui-component-properties
description: Inspect or set supported Cocos Creator 2.4.x UI component properties.
---

# UI component properties

## Scope

Inspect or set supported Cocos Creator 2.4.x UI component properties.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Read the exact node and component identity. For built-in UI components, call `creator.scene.ui.inspect` with the exact scene and node UUIDs; use its typed property values, component instance IDs, and unsupported-field reasons as the live schema evidence.
4. Use only fields returned as supported by inspection, and check enum/range constraints against the Creator 2.4.15 reference or live component constants; do not invent property names.
5. Apply each authorized field through `creator.scene.node.set-component-property.plan/commit/reconcile`, then inspect again and verify the exact saved `.fire` readback reported by the receipt. Writes are per property; a completed operation can be restored through `creator.scene.node.set-component-property.compensate.plan/commit/reconcile` by its source operation ID, with no caller-selected restore value. Commit executes immediately, so Codex assesses the plan and explains material risks before invoking it.
6. Component attachment remains a separate explicit commit operation. The property contract accepts declared public serializable scalars; typed vectors, rects, sizes, colors, bounded typed arrays, exact active-scene node/component references, and supported AssetDB resource references. Font properties typed as `cc.Font` use the base asset class so both TTFFont and BitmapFont assets can be assigned. Arbitrary project objects, internal/inherited fields, lifecycle fields, and unsupported resource types remain unavailable.
7. Inspect known setter side effects before using references. In Creator 2.4.15, setting `cc.Slider.handle` calls `_updateHandlePosition()` and moves the referenced Button node to the Slider's current progress position. Prefer a dedicated child handle with an intentional local position; a component-property compensation restores the reference field only, so separately restore or remove any affected target node.
8. Button click-event lists use the dedicated `creator.scene.button-events.set.plan/commit/reconcile` commands; they are not component-property arrays. Read the current events first and include entries that should be preserved because the operation replaces the bounded list.
9. Never edit `.fire` or `.prefab` serialization as a fallback for a field the live command rejects. Report the exact missing field/type contract instead.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
