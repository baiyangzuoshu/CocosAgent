---
name: cocos2-sprite-atlas
description: Configure or diagnose Creator 2.4.x Atlas assets, Auto Atlas builds, SpriteAtlas references, and dynamic atlas behavior.
---

# Atlas and SpriteAtlas workflows

## Scope

Configure or diagnose Atlas assets and packing in Creator 2.4.x. Distinguish imported `.plist`/`.png` Atlas assets, the editor's `.pac` Auto Atlas build setting, runtime `cc.SpriteAtlas`, and runtime dynamic atlasing; they are different paths.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Identify which path the project uses: imported Atlas (`.plist` and `.png`), Auto Atlas (`.pac`), runtime `cc.SpriteAtlas`, or dynamic atlas. Inventory the SpriteFrames, platform/build settings, and references for that path.
4. Choose Auto Atlas folder membership based on the actual build target and resource use; do not move assets without checking references.
5. Edit atlas/import settings through Creator only when the current integration exposes those fields; otherwise provide the manual Creator steps and preserve UUIDs and metadata.
6. Verify build output for Auto Atlas, or runtime use for imported/runtime atlases. Measure draw calls or memory only with a matching before/after runtime observation; packing alone does not prove an improvement.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
