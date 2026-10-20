---
name: cocos2-package-management
description: Inspect or manage packages and dependencies in a Cocos Creator 2.4.x project.
---

# Package and dependency management

## Scope

Inspect or manage packages and dependencies in a Cocos Creator 2.4.x project.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Inspect only the manifests and lock files that actually exist, along with the Creator patch and dependency source. Do not assume a generated project has an npm manifest, lock file, or automatic dependency resolver.
4. Check compatibility and transitive requirements from the package's authoritative metadata; distinguish npm dependencies from Creator extension packages under `packages/`.
5. Apply only an explicitly authorized dependency change through an available package tool or documented manual workflow; do not install or download silently.
6. Read back the files actually changed and verify package resolution/Creator loading with the relevant tool. Do not claim Creator resolves or compiles a dependency unless that result was observed.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.
