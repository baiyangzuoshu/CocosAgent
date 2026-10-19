---
name: cocos2-task-review-recovery
description: Review coding-agent task changes and recover interrupted Creator 2.4.x operations without overwriting later work.
---

# Task review and recovery

## Scope

Review task changes made by Codex, Claude Code, or another supported coding Host. Recover interrupted Creator 2.4.x operations without overwriting later work.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Collect whatever the current Host actually exposes: run receipts or operation IDs when present, version-control diffs, target identities, hashes, compile/runtime evidence, and unresolved writes. Do not assume a third-party Creator operation ledger or checkpoint exists.
4. Classify source, scene/Prefab, resource, build, and runtime changes separately; do not call receipt summaries a complete disk diff.
5. Reconcile an uncertain tool write using its original operation identity if the tool supplies one; also inspect current source/diff state before deciding what happened.
6. Compensate only through a documented tool operation or a reviewed source-control/manual restore whose target is still unchanged; otherwise stop and report the conflict.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, and evidence that the available tools actually returned. Distinguish source readback, Creator readback, compile/build results, and runtime observations. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
