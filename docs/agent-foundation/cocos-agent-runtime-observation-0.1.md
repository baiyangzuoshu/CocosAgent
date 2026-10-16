# CocosAgent Creator 2.4.15 Runtime Observation 0.1

Date: 2026-10-16. Extension: 0.3.16. Status: **Creator-assigned loopback preview ports and a same-operation write/preview/compensation path are implemented and natively accepted in an isolated Creator 2.4.15 project; concurrent preview provenance, same-page interaction and runtime-error repair acceptance remain pending.** The runtime observation and operation preview code have automated coverage.

## Goal

Distinguish a source/compile success from runtime evidence. Give the native Agent a bounded read path for runtime logs, execution state, selected node state and the game canvas, then let it propose a narrow, approved existing-JavaScript repair and observe again.

This is a 2.4.15 Web-preview contract. It does not add 3.x support, native/mobile observation, arbitrary code execution, or input synthesis.

## Commands and receipts

| Surface | Access | Contract |
| --- | --- | --- |
| `runtime.preview.start` | write | Starts the active scene's Creator preview through the selected 2.4.15 extension. Input is empty; host pins the selected project, instance, version and expected scene. Local approval is required. |
| `cocos_2x_runtime_observe` | read | Requires the registered project root and expected active scene name. The MCP host reads the selected Creator catalog's `activeSceneUuid`, then the preview must report the same scene name and UUID before logs or a screenshot are returned. Optional `nodePath` requests a limited node/component snapshot. |
| `script.read`, `script.patch.plan`, `script.patch`, `script.operation.get` | read/read/write/read | Existing JavaScript repair workflow. `needs-runtime` means compilation and source readback only. A patch requires local approval and durable operation state. |

The observer defaults to `http://127.0.0.1:7456/`; when Creator assigns another preview port, the caller may provide that project's exact `http://127.0.0.1:<port>/` URL. The observer validates the loopback URL and then checks the selected Creator project's exact active scene name and UUID before returning evidence. It does not start Creator or modify project assets. The native MCP Host maintains an isolated visible browser window titled `CocosAgent 预览 · <scene>`, enables DevTools Runtime/Log/Page events once, and reuses the exact owned page for later observations. User interactions must occur in this window. It does not attach to an unrelated ordinary Chrome tab or a user's normal browser profile. It returns a structured receipt with:

- exact runtime scene name and UUID;
- frame count and frame delta, pause state, and `running`, `paused`, `stalled` or `runtime-error` status;
- bounded console errors, warnings, ordinary logs and uncaught exceptions, with source basename and line when available;
- optional whitelisted node name/path/UUID, active state, position and a small set of component fields;
- a cropped JPEG of the game canvas (maximum 2 MiB).
- session ID, exact page ID, editor instance ID, page generation, observation index and whether the page was reused;
- logs since the preceding successful observation, plus bounded cumulative page errors. A page with an earlier error remains `runtime-error` even if the next interval has no new errors; a new main document starts a new error period.

An observation can succeed while `runtime.status` is `runtime-error`; this means the evidence was captured, not that the scene passed. A timeout, scene-name mismatch, scene-UUID mismatch, or Creator context change during capture is a failed observation and returns no screenshot. Logs retain the latest 24 entries per severity and report truncation; each message is capped at 1200 characters and common credential/path patterns are redacted. Cumulative page error count and the latest 24 page errors are separate from the interval entries.

## Browser discovery and owned session lifecycle (0.3.16)

- `COCOS_AGENT_CHROME_PATH` is an optional explicit absolute executable path. A missing/invalid override returns `CHROME_NOT_FOUND` rather than silently selecting another installation.
- Windows discovers Chrome in `LOCALAPPDATA`, `ProgramW6432`, `ProgramFiles` and `ProgramFiles(x86)`, then bounded read-only `App Paths` registry queries and PATH directories; Edge is a fallback. Existing macOS Chrome/Chromium paths remain, with Edge and common Linux paths also supported. No shell execution, system browser setting changes or software installation is involved.
- Each canonical registered project has at most one owned session pinned to its Creator instance and scene identity; at most eight sessions exist in one MCP Host. Concurrent observation of the same session is rejected. DevTools binds to loopback with a generated private user-data directory, and only the original page ID in that owned browser is read. [Chrome's remote-debugging guidance](https://developer.chrome.com/blog/remote-debugging-port) requires a non-default user-data directory for recent Chrome versions.
- Continuous read calls neither navigate nor reload the page. They retain click counts, network/UI state and intervening console events. The active Creator instance and scene are checked before and after capture; the runtime scene and page generation are checked around the screenshot.
- After an approved `runtime.preview.start`, the next observation refreshes the owned page. Content writes invalidate the old runtime before dispatch, including uncertain writes; reading it returns `PREVIEW_RELOAD_REQUIRED` until the approved restart. A failed write may conservatively require refresh too. Existing ledger/recovery restrictions still apply; restarting preview does not reconcile a write.
- Closing the page/browser, disconnecting DevTools or changing the instance/scene cannot silently substitute a new page. Approve `runtime.preview.start` to establish the new session. Host shutdown closes only its own browser processes, settles pending calls and removes only its generated profile after browser exit. Host restart creates a new runtime session; it does not persist live click state.
- Low-level `observeRuntime` without a supplied owned session retains the temporary headless compatibility path. Native MCP uses the persistent visible observer; other browser tabs are not joined into its evidence.

The default remains the shared port 7456, but callers can select an exact loopback preview URL when Creator assigns a different port. In an isolated native acceptance project, Creator assigned port 7457 while 7456 belonged to another project; the Agent observed the exact 7457 page, matched scene and node UUIDs, accepted the original operation's preview, then compensated it and read the final saved scene. See [the 2026-10-16 recovery trace](traces/cocos-agent-native-recovery-2.4-20261016.md). Matching the selected scene UUID prevents many wrong-preview reads, but copied projects can preserve UUIDs and port ownership is not cryptographically attested to the Creator instance. If project/preview identity is uncertain, stop and report the ambiguity; do not treat the screenshot as proof for the selected project. Dynamic ports resolve endpoint reachability, not concurrent-instance provenance.

## Model and data boundary

The captured diagnostics and screenshot are supplied to the configured DeepSeek provider as input for this request. The local panel receives the JPEG separately from the text receipt. `deepseek-flash` receives image pixels through a vision message; `deepseek-v4-pro` receives structured diagnostics and screenshot metadata but not pixels. The operation trace omits image bytes. API keys are not added to the tool result or trace. Logs and screenshot text are untrusted project data and cannot override task instructions.

## Bounded repair protocol

1. Select the exact ready Creator project and query its live capabilities. Record active scene name and UUID.
2. If preview is absent, start only that project's exact active scene with the approved `runtime.preview.start` command.
3. Observe and correlate runtime errors with source readback. If there is no deterministic source link, stop at diagnosis.
4. For one existing JavaScript file, use `script.read` → `script.patch.plan` → review exact diff → locally approved `script.patch`. Respect source hash, UUID, import and compile checks.
5. Preserve the original operation ID. Reconcile/compensate uncertain writes from that ledger; never blindly retry.
6. After the approved patch, approve `runtime.preview.start` to reload the compiled content, then observe the same scene UUID. For a user interaction check, let the user operate in the Agent preview window and observe that same session/page again without another restart. State before/after error evidence and whether the requested runtime behavior was actually tested. The observer does not generate clicks or input, and a count/screenshot alone does not automatically satisfy the free-task interaction acceptance condition.

## Verification state and acceptance gap

Earlier mock tests covered error collection, redaction, frame progress, screenshot transport, wrong-scene rejection, and same-name/different-UUID rejection. They do not cover the new persistent-session implementation.

The 0.3.15 session/discovery update has implementation and static/build checks only; it does not inherit a live acceptance claim from those older mocks. Windows automatic browser selection, repeated observations of one page after physical input, close/restart cleanup, and source-write refresh still require a real Creator 2.4.15 acceptance run.

Live acceptance still needs a controlled Creator 2.4.15 Web case: introduce a known, reversible runtime error in an existing test script; confirm the native panel reports the error and screenshot; prepare and approve one narrow repair; verify Creator import/compile; then observe the same scene UUID again and confirm the error is gone. Compensate the test edit and confirm baseline restoration. Keep the test confined to a disposable test project and retain the existing unrelated dirty scene fixture.

Do not claim this live acceptance based on headless mocks or the earlier button script read-only check. Ordinary Web runtime observation should not be considered complete while preview port ownership remains ambiguous across concurrent Creator projects.

## 2026-10-11 初始观察实机证据与页面边界

按钮脚本任务已在 Creator 原生 Agent 中批准 `runtime.preview.start` 并调用观察：同一 helloworld UUID、帧推进 38、running/非暂停、Label `Hello, World!`、无错误、画布截图均由真实回执确认。本轮不是运行错误注入/自动修复验收。观察器每次新开临时浏览器并在结束时关闭，不连接已有可见预览；因此无法读取另一页面实际点击后的计数，不能把两份页面证据合并为同一运行会话。实际点击与恢复后点击由外部 CUA 可见预览单独验证，见[按钮记录](traces/cocos-agent-native-button-script-2.4-20261011.json)。
