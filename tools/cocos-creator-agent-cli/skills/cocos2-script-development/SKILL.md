---
name: cocos2-script-development
description: Create, inspect, or modify a Cocos Creator 2.4.x JavaScript or TypeScript component script.
---

# Component script development

## Scope

Create, inspect, or modify a Cocos Creator 2.4.x JavaScript or TypeScript component script.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Inspect the component class, imports, serialized properties, lifecycle methods, and existing call sites before editing.
4. Keep the change within the approved script scope; preserve class identity and Creator metadata.
5. For a new JS/TS asset, use `creator.script.create.plan` when the live catalog provides it; review the target, complete source, source hash, and absent-target precondition. Commit only after the user authorizes that plan and the Creator native dialog approves it. Reconcile the same operation ID after uncertainty; never retry automatically.
6. For an existing script, read the complete source through `creator.script.read` and retain its `sourceSha256`. Call `creator.script.modify.plan` with that exact expected hash and the complete replacement source. Review the target UUID, importer, source hashes, `.meta` hash, and replacement text before committing the returned operation ID and plan hash.
7. `creator.script.modify.commit` writes through Creator 2.4.15 `Editor.assetdb.saveExists`, requires the native Creator approval dialog, rechecks source/UUID/importer/`.meta` immediately before writing, and stores the prior source outside the project for recovery. It never changes `.meta`, scenes, or Prefabs. Reconcile the original operation ID after an interrupted call; never replay a commit.
8. After the write receipt, use its `compile.afterSequence` with `creator.diagnostics.read`. Report whether Creator emitted `compile-finished` after that cursor and report any import/Console errors. Diagnostics may be unrelated to this script unless the event names it; a compile-finished event alone does not prove compilation succeeded. A source readback or AssetDB save receipt alone is not compile evidence.
9. Use Creator compilation as authoritative evidence for Creator-specific TS APIs and decorators. Read back exact source and compile result; do not infer scene attachment or runtime success from compilation. Create and modify commands edit script assets only and do not attach a component to a scene.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
