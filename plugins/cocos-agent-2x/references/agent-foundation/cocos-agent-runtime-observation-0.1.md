# CocosAgent Creator 2.4.15 Runtime Observation 0.1

Date: 2026-10-11. Status: **implementation and simulated tests present; live Creator runtime-error injection and repair acceptance pending.**

## Goal

Distinguish a source/compile success from runtime evidence. Give the native Agent a bounded read path for runtime logs, execution state, selected node state and the game canvas, then let it propose a narrow, approved existing-JavaScript repair and observe again.

This is a 2.4.15 Web-preview contract. It does not add 3.x support, native/mobile observation, arbitrary code execution, or input synthesis.

## Commands and receipts

| Surface | Access | Contract |
| --- | --- | --- |
| `runtime.preview.start` | write | Starts the active scene's Creator preview through the selected 2.4.15 extension. Input is empty; host pins the selected project, instance, version and expected scene. Local approval is required. |
| `cocos_2x_runtime_observe` | read | Requires the registered project root and expected active scene name. The MCP host reads the selected Creator catalog's `activeSceneUuid`, then the preview must report the same scene name and UUID before logs or a screenshot are returned. Optional `nodePath` requests a limited node/component snapshot. |
| `script.read`, `script.patch.plan`, `script.patch`, `script.operation.get` | read/read/write/read | Existing JavaScript repair workflow. `needs-runtime` means compilation and source readback only. A patch requires local approval and durable operation state. |

The observer attaches to `http://127.0.0.1:7456/`; it does not start Creator or modify project assets. It starts an isolated headless Chrome process, enables DevTools Runtime/Log/Page events, opens the preview, and captures a short observation window. It returns a structured receipt with:

- exact runtime scene name and UUID;
- frame count and frame delta, pause state, and `running`, `paused`, `stalled` or `runtime-error` status;
- bounded console errors, warnings, ordinary logs and uncaught exceptions, with source basename and line when available;
- optional whitelisted node name/path/UUID, active state, position and a small set of component fields;
- a cropped JPEG of the game canvas (maximum 2 MiB).

An observation can succeed while `runtime.status` is `runtime-error`; this means the evidence was captured, not that the scene passed. A timeout, scene-name mismatch or scene-UUID mismatch is a failed observation and returns no screenshot. Errors are bounded to 24 entries per severity; each message is capped at 1200 characters and common credential/path patterns are redacted.

The preview is currently addressed through the shared default port 7456. Matching the selected scene UUID prevents most wrong-preview reads, but copied projects can preserve UUIDs and port ownership is not cryptographically attested to the Creator instance. If multiple previews compete for that port, or identity is uncertain, stop and report the ambiguity; do not treat the screenshot as proof for the selected project. This residual limit must be closed before claiming reliable concurrent-instance observation.

## Model and data boundary

The captured diagnostics and screenshot are supplied to the configured DeepSeek provider as input for this request. The local panel receives the JPEG separately from the text receipt. `deepseek-flash` receives image pixels through a vision message; `deepseek-v4-pro` receives structured diagnostics and screenshot metadata but not pixels. The operation trace omits image bytes. API keys are not added to the tool result or trace. Logs and screenshot text are untrusted project data and cannot override task instructions.

## Bounded repair protocol

1. Select the exact ready Creator project and query its live capabilities. Record active scene name and UUID.
2. If preview is absent, start only that project's exact active scene with the approved `runtime.preview.start` command.
3. Observe and correlate runtime errors with source readback. If there is no deterministic source link, stop at diagnosis.
4. For one existing JavaScript file, use `script.read` → `script.patch.plan` → review exact diff → locally approved `script.patch`. Respect source hash, UUID, import and compile checks.
5. Preserve the original operation ID. Reconcile/compensate uncertain writes from that ledger; never blindly retry.
6. Observe again against the same scene UUID. State before/after error evidence and whether the requested runtime behavior was actually tested. The observer does not generate clicks or input, so it cannot itself prove a Button's click behavior.

## Verification state and acceptance gap

Mock tests currently cover error collection, redaction, frame progress, screenshot transport, wrong-scene rejection, and same-name/different-UUID rejection. Contract wiring and package tests must pass before installation.

Live acceptance still needs a controlled Creator 2.4.15 Web case: introduce a known, reversible runtime error in an existing test script; confirm the native panel reports the error and screenshot; prepare and approve one narrow repair; verify Creator import/compile; then observe the same scene UUID again and confirm the error is gone. Compensate the test edit and confirm baseline restoration. Keep the test confined to a disposable test project and retain the existing unrelated dirty scene fixture.

Do not claim this live acceptance based on headless mocks or the earlier button script read-only check. Ordinary Web runtime observation should not be considered complete while preview port ownership remains ambiguous across concurrent Creator projects.
