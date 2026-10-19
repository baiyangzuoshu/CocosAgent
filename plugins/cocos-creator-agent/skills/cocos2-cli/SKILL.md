---
name: cocos2-cli
description: Use the standalone Cocos Creator CLI from a terminal for installation, bridge operations, and structured project commands. Use when shell automation or CLI lifecycle work is needed.
---

# Cocos Creator CLI

Use the standalone `cocos-creator-agent` command when the task calls for terminal automation, CLI installation/update, Creator extension installation, or local bridge operations. This CLI is independent of the Creator-native CocosAgent and does not require Codex or Claude to run.

## Check and install

1. Run `cocos-creator-agent version --format json` to identify the installed CLI and Creator contract version.
2. If the command is missing, use the versioned GitHub Release tarball documented in the [standalone CLI README](../../../../tools/cocos-creator-agent-cli/README.md). For repository development, install from `tools/cocos-creator-agent-cli/`.
3. Check for releases with `cocos-creator-agent self-update --check`; run `cocos-creator-agent self-update` only when an update is needed. A CLI release does not exist until its matching version tag has published the GitHub Release assets.
4. After updating the CLI, verify its version and restart the Host MCP server so its tool catalog is refreshed.

## Use

- Run `cocos-creator-agent --help` to discover supported commands and flags.
- Use `--format json` for output the Agent needs to parse.
- Use `catalog --format json` to inspect the command descriptions and input schemas supplied by the CLI contract.
- Use `instances list` before selecting an editor. Pass the exact returned `instanceId` for `capabilities` or `call`; never infer the target from a project name or foreground window.
- Use `bridge status`, `bridge start`, and `bridge stop` for local bridge operations.
- Use `doctor [--project-root <absolute-path>] [--instance <instance-id>]` for read-only CLI, bridge, extension, and Creator identity diagnostics. It does not start a stopped bridge.
- Use `extension install --project-root <absolute-path>` only for an explicit project installation request. Verify the exact project path before installing and let Creator reload the package before checking the live instance.
- Use `extension status` before update or uninstall. Both operations refuse local changes by default. `--force` preserves a backup under `~/.cocos-creator-agent/extension-backups/`; report the backup path and ask the user before deleting it.
- Reload the exact Creator project after extension install, update, or uninstall; then confirm the live instance reports the expected version and project path.
- For direct terminal command automation, use `call --instance <id> --command <id> --input <json> --format json`. The CLI validates against its canonical command contract and returns the Creator receipt.
- Use `diagnostics read --instance <id>` before/after compile or preview to capture the Creator event cursor, compile events, import failures, and editor Console entries.
- Use `creator build --project-root <absolute-path> --creator <exact-2.4.15-app> --platform web-mobile|web-desktop` for a machine-readable Creator CLI build; output defaults to a new folder outside the project. Use `creator compile` only for supported native platforms after its SDK/JDK or Xcode preflight passes. These workflows use the documented Creator process command line and have not been accepted in the live editor yet.
- Use `creator test --instance <id> --session <previewSessionId> --input <actions-and-assertions-json>` to run bounded assertions in the same preview session. It returns nonzero if an assertion fails. It is a runtime smoke check, not a Creator unit-test suite.
- Start a Web preview only when the task authorizes running project scripts. `preview start --instance <id> [--port 7456]` requires Creator's native approval and returns an exact `previewSessionId`; use only that ID for `preview observe|screenshot|refresh|interact|stop`.
- Runtime interactions are bounded to a small keyboard whitelist (1–2000 ms per press) and normalized clicks on the game canvas. Assertions are declarative scene/node/Console checks, including simple component data properties for business state. `preview refresh` keeps the same owned browser session ID and confirms scene identity; `preview stop` closes only the Agent-owned Chromium browser, not Creator's preview server.
- Screenshots are saved outside the project under `~/.cocos-creator-agent/captures/` and returned with a SHA-256. Distinguish Creator compile events, browser Console, structured assertions, and screenshot evidence.
- Discover project aliases with `project-tools list --instance <id>`. A project registry at `.cocos-agent/tools.json` can only alias built-in read commands; the mapped command's live schema and capability remain authoritative.
- Use `tasks start --instance <id> --command <id> --input <json>` for an asynchronous command, then retain its task ID. `tasks wait --id <task-id> --after-sequence <N>` waits for the next persisted progress event; `tasks status|list|cancel|resume` read, list, cancel, or recover it. Task records survive bridge restart under `~/.cocos-creator-agent/tasks/`.
- Resume only interrupted reads or documented reconciliation. A dispatched script creation commit reconciles with `creator.script.create.reconcile`; a scene-node active commit reconciles with `creator.scene.node.set-active.reconcile`, both using the original `operationId`. Do not replay plans, writes, or controls. Cancellation after dispatch is cooperative and may leave a task needing reconciliation.

The Creator command catalog includes a minimal, approved JS/TS asset-creation flow and a one-node `active` property write. Review the complete plan first; for script creation also review the exact source. Call commit only after the user authorizes that specific plan. Commit uses the same operation ID and plan hash and requires Creator's native dialog approval. If the Host call expires or disconnects, a later dialog approval is rejected. Reconcile uncertain operations before planning again; never retry a write automatically. Scene-node writes use Creator Scene Script, request save through `scene:stash-and-save`, and read the property back in memory. That receipt does not confirm disk persistence because Creator 2.4 does not document a completion acknowledgement for this IPC. Other scene properties, component attachment, and runtime behavior are not covered by this write. The separate CLI extension lifecycle commands install, inspect, update, or remove `packages/cocos-creator-agent-extension/`.

## CLI versus MCP

Use this CLI for local installation, bridge lifecycle, terminal scripts, and CI. Use `cocos2-mcp-tools` when the task needs Host-native MCP tool discovery and structured calls. Both interfaces must follow the same live CLI catalog and command contract.
