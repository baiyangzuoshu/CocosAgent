---
name: cocos2-tilemap
description: Import, configure, or use Tiled Map assets in Cocos Creator 2.4.x.
---

# TileMap

## Scope

Import, configure, or use Tiled Map assets in Cocos Creator 2.4.x.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Inspect the map file, tileset images, map orientation, tile dimensions, layers, and external dependencies.
4. Confirm the Creator 2.4.x TileMap component and importer support for the actual map format.
5. Preserve source assets and UUID references; avoid manual edits to generated map metadata.
6. Load the target scene and verify visible layers. Verify collision or movement only when the project has an explicit collision/pathfinding integration; TiledMap import alone does not establish those behaviors.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
