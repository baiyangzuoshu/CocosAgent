---
name: cocos2-physics-3d
description: Configure or diagnose 3D rigid bodies, colliders, and contacts when supported by the exact Creator 2.4.x installation.
---

# 3D physics

## Scope

Configure or diagnose 3D rigid bodies, colliders, and contacts when supported by the exact Creator 2.4.x installation.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Check the exact Creator patch, enabled 3D/physics modules, and installed package/API surface before planning.
4. Inspect collider dimensions, transforms, layers, body configuration, and whether the problem is collision or input/update logic.
5. Use only discovered Creator APIs or the project’s explicitly installed physics package.
6. If the target 2.4.x build lacks the required 3D physics path, report the version/package blocker; do not invent support.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.

## Completion evidence

Report the target project/version, exact changed or inspected identities, command/operation receipts, readback, and applicable compile/build/preview/runtime evidence. Separate source saved, Creator accepted, and runtime behavior verified. On timeout or uncertain writes, reconcile the original operation ID before any retry; stop on a conflict.
