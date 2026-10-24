---
name: cocos2-ui-event-binding
description: Bind or inspect built-in UI event callbacks in a Cocos Creator 2.4.x scene or Prefab.
---

# UI event binding

## Scope

Bind or inspect UI callbacks in a Cocos Creator 2.4.x scene or Prefab.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Identify the event source node/component, event type, target node identity, handler class, method, and arguments. Use `creator.scene.ui.inspect` to read exact component instances and current event lists for Button, Toggle, ToggleContainer, Slider, ScrollView, PageView, and EditBox.
4. Use `creator.scene.ui-events.set.plan/commit/reconcile` with the exact `componentClassName` and `eventProperty` for Button, Toggle, ToggleContainer, Slider, ScrollView, PageView, or EditBox. The operation replaces the whole bounded event list, so preserve entries by carrying forward every binding the user did not ask to remove. It validates exact in-scene targets, handler components, and callback methods, then verifies the serialized event list from the saved `.fire` file. The Button-specific command remains available for compatibility.
5. To undo a completed event-list write, use `creator.scene.ui-events.set.compensate.plan` with the exact source operation ID. The plan derives the prior list, accepts no caller-supplied replacement events, and refuses source drift or duplicate compensation. Commit a fresh plan before reconciling it; if a plan was reconciled as `not-applied`, review state and create a new plan rather than trying to commit that old plan.
6. Review the exact plan diff and assess the effect, then invoke commit for the requested binding; Codex informs the user about material risks. No Creator dialog appears.
7. Read the binding back and trigger it in the requested preview session; source compilation alone does not prove an event fires. Preview input supports normalized canvas clicks and drags, keyboard presses, and bounded text insertion into the focused control. Follow an EditBox focus click with a `text` action, then assert its runtime `string`; verify Slider/Toggle changes with `component-property` assertions, using a bounded `tolerance` for runtime-computed numeric values. Reconcile source-linked compensation after restart only by its operation ID and exact live/disk readback.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
