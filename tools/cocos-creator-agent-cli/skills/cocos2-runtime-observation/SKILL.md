---
name: cocos2-runtime-observation
description: Use when observing or diagnosing a running Creator 2.4.x Web preview, not generic browser or server issues.
---

# Runtime observation

## Scope

Observe a running Creator 2.4.x Web preview, diagnose runtime errors, and verify bounded interactions.

## Workflow

1. Identify the exact project root from the Host workspace and verify the Creator patch from project metadata or an editor integration. Determine the active scene/target only through tools that report it; never infer it from a neighboring project.
2. Inspect the relevant source, asset, scene or runtime evidence and record exact identities/current state before proposing a change.
3. Read `creator.diagnostics.read` before preview actions to capture the Creator-side compile and Console sequence cursor. It reports events observed by the extension; an event such as `compile-finished` alone does not prove a successful compile. Inspect returned import-failure and Console errors.
4. Ensure Creator's selected preview target is Browser, then start Web preview with `creator.preview.start`. The documented IPC follows the selected preview device. This requires a native Creator approval. Creator 2.4.15 opens its normal preview as well as an Agent-owned Chromium window; the returned `previewSessionId` is bound to the exact Creator instance, project root, scene name, and scene UUID. If Chromium is unavailable or the Web preview server does not start, the command returns an error; do not infer that runtime observation started.
5. Use only that `previewSessionId` for `creator.preview.observe`, `creator.preview.screenshot`, `creator.preview.interact`, `creator.preview.test-script`, `creator.preview.refresh`, and `creator.preview.stop`. The test-script command executes a bounded project-local test file in the live page with `cc`; it is not sandboxed, and uncertain execution closes the Agent-owned browser. Browser Console entries and screenshots come from the Agent-owned page. Screenshots are saved outside the project and returned with SHA-256. `stop` closes the Agent-owned browser; Creator's preview server remains under Creator control.
6. `creator.preview.interact` accepts at most 12 keyboard/canvas-click actions and 12 declarative assertions: no new runtime errors, a Console marker, scene identity, node existence, node `active`/`x`/`y`, or a primitive own data property on a named component. Key presses can be held for 1–2000 ms. Click coordinates are normalized to the game canvas. Keep the exact assertion and cursor/session ID in the task record. A follow-up interaction can repeat the same assertion in the same page; after code changes, use `refresh` and then repeat it in that same browser session.
7. Use the screenshot path to inspect actual pixels. Passing a scene/node assertion does not establish visual correctness, and a screenshot alone does not establish business behavior. Report each evidence type separately.

## Capability and safety gate

This Skill is workflow guidance and does not install tools. Inspect the tools available in the current Host and any Creator integration, then use only supported operations and their documented inputs. Use the Host file tools for ordinary code and project text files. For scenes, Prefabs, import settings, or editor state, use a Creator-aware tool when available; if none can safely perform the requested operation, report that exact gap and provide the manual Creator steps. Preserve generated `.meta` files, UUIDs, and asset references. Preview start explicitly runs the project; obtain the user's task authorization before requesting it, and use only the Creator approval dialog and bounded input contract provided here.

## Completion evidence

Report the target project and Creator version, exact inspected or changed identities, Creator diagnostic cursor/events, preview session ID, scene identity, input actions, assertion results, and screenshot path/hash. Distinguish source readback, Creator readback, observed compile events, runtime Console, structured runtime assertions, and visual screenshot evidence. For an uncertain tool write, reconcile its original operation ID if the tool provides one; for source-file changes, inspect the version-control diff and read the changed files back.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
