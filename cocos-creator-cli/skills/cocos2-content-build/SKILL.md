---
name: cocos2-content-build
description: Plan, execute, and inspect a Cocos Creator 2.4.x Web or mobile build.
---

# Content build

## Scope

Plan, execute, and inspect a Cocos Creator 2.4.x Web or mobile build.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Confirm Creator patch, build target, debug/release mode, output directory, package name, and build baseline.
4. Inspect project and release readiness before starting a potentially long or overwriting build.
5. Execute a build only when the current Host exposes the operation and the user requested it. Keep the actual command/result, output path, and build identity that the tool returns; do not assume a standardized build receipt exists.
6. Inspect build errors and output files, then run the matching preview/device verification if requested.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
