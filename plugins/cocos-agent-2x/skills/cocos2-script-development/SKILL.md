---
name: cocos2-script-development
description: Modify an existing Cocos Creator 2.4.15 JavaScript component for a concrete gameplay task, review exact text changes, verify Creator compilation and recover failed edits. Use for button click logic or other existing-JS component changes; not TypeScript or script creation.
---

# Existing JavaScript gameplay changes

Use the Creator native Agent tools. Select the live project and verify the four `script.*` capabilities before editing. All paths below are relative to the project's `assets` folder. Do not infer a component's file or a Button's target from its name alone; inspect the relevant scene and the explicitly selected script first.

1. Call `cocos_2x_script_read` with the known `scriptPath`; retain its script UUID, source SHA-256 and metadata hash. The command reads only one existing UTF-8 `.js` file up to 64 KiB, with imported JavaScript metadata. Do not search outside assets or ask to read credentials.
2. Make 1–8 small unique `{before, after}` replacements. Call `cocos_2x_script_patch_plan` with `scriptPath`, `scriptUuid`, `expectedSha256` and `edits`. This returns expected differences, candidate hash and a syntax check. It does not execute code or prove compilation. Resolve `SCRIPT_STALE`, `EDIT_NOT_UNIQUE` or `SCRIPT_SYNTAX_ERROR` by reading again and revising the proposal, never weakening the check.
3. After the panel's approval, call `cocos_2x_script_patch` with `input.action=apply`, a new UUID `operationId`, and the exact planned identity/edits. Creator refreshes that script, checks unchanged UUID/metadata, and waits for quick-compile source map content and destination compiler stats to match this source. Query `cocos_2x_script_operation_get` and read source again. **`needs-runtime` proves compilation/readback, not functionality.**
4. Reopen or reload the preview and actually exercise the requested behavior. For a Button node, prefer `node.on('click', handler, this)` with a corresponding `off` at destruction when compatible with existing code. Confirm the existing `cc.Button` component and exact hierarchy; do not add hidden listeners to unrelated objects or invent a successful click. Record observable state before/after and runtime errors. Current script tools do not automatically click a preview or collect arbitrary console logs; disclose this observation boundary.

## Recovery

- A compile/import failure may leave the proposed source on disk. Preserve the returned operation ID and error; it contains an exact original-source backup. `script.operation.get` is read-only.
- On uncertain output (`needs-review`, timeout or disconnect), stop new writes. Use `cocos_2x_script_patch` with only `{action: reconcile, operationId}` to validate the original record without rewriting, or `{action: compensate, operationId}` to restore the original source and reverify compilation. The panel must approve either action.
- Compensation refuses later developer changes or changed metadata. Do not overwrite, delete the ledger or use another write tool to bypass the refusal.
- Only a `compensated` record may be replayed: `{action: replay, operationId: NEW_UUID, sourceOperationId: ORIGINAL_UUID}`. Read back and test functionality again; then compensate the replay if the task is a temporary acceptance exercise.

This is an initial 2.4.15 JavaScript contract. No TypeScript, new script assets, arbitrary filesystem commands, automatic scene event binding, global compile-error completeness, native builds or 3.x support is implied. Real project acceptance must state the actual environment and evidence.
