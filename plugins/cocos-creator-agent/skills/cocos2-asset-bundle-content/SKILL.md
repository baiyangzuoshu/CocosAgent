---
name: cocos2-asset-bundle-content
description: Stage, build, preview, and roll back Asset Bundle or content releases for Creator 2.4.x.
---

# Asset Bundle content delivery

## Scope

Stage, build, preview, and roll back Asset Bundle or content releases for Creator 2.4.x.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Inspect Bundle name, folder membership, cross-Bundle dependencies, asset UUIDs, and current selected/effective release.
4. Create a release plan and stage only the exact approved content set.
5. Build and preview only from the verified release receipt; distinguish selected, built, and effective content.
6. On failure, read the release ledger and use the exact documented recovery operation; never re-stage blindly.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Do not run project scripts or SDK actions merely because a Skill describes them.

## Completion evidence

Report the target project/version, exact changed or inspected identities, command/operation receipts, readback, and applicable compile/build/preview/runtime evidence. Separate source saved, Creator accepted, and runtime behavior verified. On timeout or uncertain writes, reconcile the original operation ID before any retry; stop on a conflict.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
