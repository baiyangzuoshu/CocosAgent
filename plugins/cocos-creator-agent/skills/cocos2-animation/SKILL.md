---
name: cocos2-animation
description: Create or diagnose node, skeletal, or UI animation workflows in a Cocos Creator 2.4.x project.
---

# Animation

## Scope

Create or diagnose node, skeletal, or UI animation workflows in a Cocos Creator 2.4.x project.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Identify the animation system and asset type already used by the project before choosing a workflow.
4. Inspect clip names, target node/component identities, duration, wrap mode, and event callbacks.
5. Edit through a documented Creator editor workflow or a live Creator-aware operation that supports the target fields. Do not hand-edit serialized animation assets without format-specific evidence; preserve asset IDs and references.
6. Preview the animation from a clean state and verify event timing and final pose.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
