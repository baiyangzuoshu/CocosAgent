---
name: cocos2-prefab-source-edit
description: Use when inspecting or safely patching a Creator 2.4.15 Prefab through its supported source-patch contract.
---

# Prefab source editing

## Scope

Inspect and, when available, edit a Cocos Creator 2.4.15 Prefab through the CLI's Creator-aware source patch commands. `creator.prefab.source.inspect` reads the saved `.prefab` and `.meta` bound to an exact AssetDB UUID; `creator.prefab.source.patch.plan/commit/reconcile` operate on a bounded field allowlist through Creator Prefab edit mode. Never directly patch serialized Prefab files.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Use `creator.prefab.source.inspect` to bind the saved Prefab by exact AssetDB UUID and review its source/meta hashes, node identities, hierarchy, and supported component summary. Pass `nodeUuid` when focusing the response on one node in a large Prefab.
   Creator may leave the root's serialized `_id` and `fileId` empty. In that case inspection returns `identityKind: prefab-root` and an asset-bound `prefab_root_<prefabUuid>` identifier. Pass that exact identifier back; the live editor resolves it only to the unique root linked to the same Prefab asset and checks its path and expected values.
4. Use `creator.prefab.source.patch.plan` with `action: apply`, the inspected `sourceSha256`, and explicit before/after values. Supported fields are node name/active/2D position/scale, `cc.Sprite.enabled`, `cc.Sprite.spriteFrameUuid`, and `cc.Label.enabled`. Label text, hierarchy, component add/remove, and arbitrary serialized fields are not supported.
5. Call `creator.prefab.source.patch.commit` with the reviewed operation ID and plan hash to execute the exact planned change without a Creator dialog. Codex should explain material risks before invocation. The operation enters the exact Prefab edit mode, saves, exits, reopens, and checks both the live node and exact saved source. Use `action: compensate` or `action: replay` only with a completed `sourceOperationId`; the CLI derives the inverse and binds it to the current source hash.
6. Use `creator.prefab.source.patch.reconcile` after an interrupted or uncertain commit. Never resend the write. If the live mode APIs are not dynamically available, or a field is outside the allowlist, stop before writing and provide the exact manual Creator steps.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. A completed patch requires the native Prefab mode's save callback, matching `.prefab`/`.meta` readback, return to the original scene, reopening the same Prefab, and live node readback. `sceneSavedEventConfirmed` separately reports whether the optional generic `scene:saved` event was observed; native Prefab saving does not promise that event. Mode transitions use exact state readback because Prefab entry does not emit `scene:ready`. Exiting checks the native dirty state and closes only a clean Prefab without a confirmation dialog. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
