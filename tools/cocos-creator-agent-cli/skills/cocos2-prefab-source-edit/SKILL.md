---
name: cocos2-prefab-source-edit
description: Inspect a Cocos Creator 2.4.x Prefab and use a Creator-aware edit only when the live tool contract explicitly supports it.
---

# Prefab source editing

## Scope

Inspect a Cocos Creator 2.4.x Prefab and use a Creator-aware edit only when the live tool contract explicitly supports it. The CLI's `creator.prefab.source.inspect` reads the saved `.prefab` and `.meta` bound to an exact AssetDB UUID; it does not observe unsaved Prefab edit-mode state. This package still has no Prefab source edit command; do not directly patch serialized Prefab files.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Use `creator.prefab.source.inspect` to bind the saved Prefab by exact AssetDB UUID and review its source/meta hashes, node identities, hierarchy, and supported component summary. Pass `nodeUuid` when focusing the response on one node in a large Prefab.
4. If no live Creator-aware edit contract exists for the requested field, stop before writing and provide the exact manual Creator steps. Do not hand-edit serialized Prefab data as a fallback.
5. When a supported edit contract exists, record the Prefab identity and current state, apply only its allowed fields, and read the same Prefab back through Creator.
6. On a contract conflict or changed source identity, stop and reconcile before any retry.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
