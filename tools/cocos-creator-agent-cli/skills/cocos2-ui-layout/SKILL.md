---
name: cocos2-ui-layout
description: Configure Cocos Creator 2.4.x Widget, anchors, alignment, and screen-size adaptation.
---

# UI layout and adaptation

## Scope

Configure Cocos Creator 2.4.x Widget, anchors, alignment, and screen-size adaptation.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change. For a built-in UI node, use `creator.scene.ui.inspect` to read its typed public component fields and exact component instance IDs.
3. Confirm Canvas design resolution, fit-width/fit-height settings, target orientation, and safe-area requirements.
4. Inspect parent dimensions, anchor points, Widget targets, and existing responsive patterns.
5. Apply explicit layout constraints rather than guessed coordinates when the UI must adapt. Use the approved component-property operation for Canvas, Widget, and Layout fields; use node transforms only for intentional offsets/sizes.
6. In the attached preview, call `creator.preview.interact` with `{ "type": "ui-refresh", "path": "<exact-node-path>", "componentType": "cc.Widget" | "cc.Layout" }` to invoke only the public `updateAlignment()` or `updateLayout()` method on that exact node. Inspect its before/after geometry receipt, then assert child `x`/`y` and dimensions with `node-property` assertions.
7. Verify in Creator preview at each requested resolution/orientation; one screenshot at one size does not prove responsive layout.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
