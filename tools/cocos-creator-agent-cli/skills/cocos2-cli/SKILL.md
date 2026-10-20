---
name: cocos2-cli
description: Set up and use the standalone Cocos Creator CLI, its bundled Creator workflow Skills, and its native Codex/Claude MCP server configuration.
---

# Cocos Creator CLI

Use the standalone `cocos-creator-agent` command for MCP setup, Creator Skill installation, terminal automation, CLI updates, project extension lifecycle, and local bridge operations. The CLI owns and starts the MCP server and packages the workflow Skills; neither requires a separate Host plugin. It is independent of the retired Creator-native CocosAgent and works without Codex or Claude.

## Check and install

1. Run `cocos-creator-agent version --format json` to identify the installed CLI and Creator contract version.
2. If the command is missing, use a versioned tarball from the [CLI Releases](https://github.com/baiyangzuoshu/CocosAgent/releases). For repository development, install from `tools/cocos-creator-agent-cli/`.
3. Check for releases with `cocos-creator-agent self-update --check`; run `cocos-creator-agent self-update` only when an update is needed. A CLI release does not exist until its matching version tag has published the GitHub Release assets.
4. After updating the CLI, verify its version and restart the Host MCP server so its tool catalog is refreshed.

## Configure a Host and install Skills

1. Run `cocos-creator-agent skill show --list` to inspect the bundled Creator router/specialist Skills. Use `skill show <name>` to read one without installing it.
2. Preview installation with `cocos-creator-agent skill install codex --dry-run` or `cocos-creator-agent skill install claude-code --dry-run`. Installation defaults to the user's Skill directory and installs the bundled Creator workflow library. Add `--skill <name>` to select one Skill or `--local` to install under the current project (`.agents/skills` for Codex, `.claude/skills` for Claude Code).
3. Install with `cocos-creator-agent skill install <client>`. Use `skill refresh <client>` after a CLI update to refresh managed copies. Modified or unmanaged targets are preserved and reported; `--force` stores a backup before replacing them. Creator API reference notes are placed beside the installed skills so their relative links work.
4. Preview registration with `cocos-creator-agent mcp configure <client> --dry-run`, then register with `cocos-creator-agent mcp configure codex` or `cocos-creator-agent mcp configure claude-code`; use `--local` for a Claude Code project-local registration. `mcp status <client>` and `mcp list` report configuration. A same-name server with different command details is preserved unless `--force` is explicit.
5. Restart Codex or Claude Code. The server command is the installed CLI executable running `mcp serve`; tools are discovered from the live CLI command contract and Creator instance.

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
- Use `extension commands list --instance <id>` to discover live project-local Editor extension commands. The CLI checks the provider contract against the current Creator extension handshake and input schema; call one with `extension command call --instance <id> --provider <provider-id> --command <command-id> --fingerprint <sha256> --input <json>`.
- Project-local extension commands run code inside Creator's main process and are not sandboxed. Trust the provider before invoking it; `write` and `control` commands require Creator's own approval dialog, and interrupted calls are never replayed automatically.
- For direct terminal command automation, use `call --instance <id> --command <id> --input <json> --format json`. The CLI validates against its canonical command contract and returns the Creator receipt.
- Use `diagnostics read --instance <id>` before/after compile or preview to capture the Creator event cursor, compile events, import failures, and editor Console entries.
- Use `creator build --project-root <absolute-path> --creator <exact-2.4.15-app> --platform web-mobile|web-desktop` for a machine-readable Creator CLI build; output defaults to a new folder outside the project. Use `creator compile` only for supported native platforms after its SDK/JDK or Xcode preflight passes. These workflows use the documented Creator process command line and have not been accepted in the live editor yet.
- Use `creator test --instance <id> --session <previewSessionId> --input <actions-and-assertions-json>` to run bounded assertions in the same preview session. It returns nonzero if an assertion fails. It is a runtime smoke check, not a Creator unit-test suite.
- For project test plans, use `creator test --project-root <path> --list` to discover `.cocos-agent/tests.json`, then select suites with `--suite <id>`. Node, Creator Provider and preview suites return separate evidence in JSON/JUnit reports. Use `creator watch --project-root <path> --paths '["tests","assets/Scripts"]' --affected` for directory changes and affected-suite regression. Read [the test adapter contract](../../references/2x/14-project-test-runner.md) when configuring tests. Provider tests require Creator approval; interrupted Provider execution stops watch for manual review.
- Use `creator watch --instance <id> --session <previewSessionId> --paths '["assets/Scripts/Player.ts"]' --input <actions-and-assertions-json>` to rerun those assertions after stable changes to explicitly listed project files. It refreshes and reuses the same preview session, emits newline-delimited JSON, and stops with Ctrl+C. Keep the watch list small; paths are project-relative, must be regular files inside the connected project, and cannot be symlinks.
- Start a Web preview only when the task authorizes running project scripts. `preview start --instance <id> [--port 7456]` requires Creator's native approval and returns an exact `previewSessionId`; use only that ID for `preview observe|screenshot|refresh|interact|stop`.
- Runtime interactions are bounded to a small keyboard whitelist (1–2000 ms per press) and normalized clicks on the game canvas. Assertions are declarative scene/node/Console checks, including simple component data properties for business state. `preview refresh` keeps the same owned browser session ID and confirms scene identity; `preview stop` closes only the Agent-owned Chromium browser, not Creator's preview server.
- Screenshots are saved outside the project under `~/.cocos-creator-agent/captures/` and returned with a SHA-256. Distinguish Creator compile events, browser Console, structured assertions, and screenshot evidence.
- Discover project aliases with `project-tools list --instance <id>`. `.cocos-agent/tools.json` can alias canonical `read`/`plan` and Creator-approved `write`/`control` commands; the mapped command's live schema and capability remain authoritative.
- Use `tasks start --instance <id> --command <id> --input <json>` for an asynchronous command, then retain its task ID. `tasks wait --id <task-id> --after-sequence <N>` waits for the next persisted progress event; `tasks status|list|cancel|resume` read, list, cancel, or recover it. Task records survive bridge restart under `~/.cocos-creator-agent/tasks/`.
- Resume only interrupted reads or documented reconciliation. Script creation, scene-node active, component-add, and component-property commits reconcile with their matching `creator.scene.node.*.reconcile` or `creator.script.create.reconcile` command, using the original `operationId`. Do not replay plans, writes, or controls. Cancellation after dispatch is cooperative and may leave a task needing reconciliation.

The Creator command catalog includes approved JS/TS asset creation, one-node `active` changes, adding one registered component class, and setting one declared public scalar property on an exact component instance. Review the full plan first; for script creation also review the exact source. Call a commit only when the user has authorized that specific operation. Commits use the same operation ID and plan hash and require Creator's native dialog approval. If the Host call expires or disconnects, a later dialog approval is rejected. Reconcile uncertain operations before planning again; never retry a write automatically. Scene writes use Creator Scene Script and request save through `scene:stash-and-save`; Creator 2.4 documents no completion acknowledgement for this IPC, so receipts report in-memory readback and do not confirm disk persistence. Component addition rejects classes with implicit `requireComponent` dependencies and warns that constructors/lifecycle hooks are project code. Property writes only accept declared public string/number/boolean fields and bind to the same Creator extension session. If reconciliation cannot prove the affected component instance, require manual review. Arrays, resources, object fields, and UI event binding are not available. The separate CLI extension lifecycle commands install, inspect, update, or remove `packages/cocos-creator-agent-extension/`.

## CLI versus MCP

Use the CLI-owned MCP server for Host-native tool discovery and structured calls; configure it with `cocos-creator-agent mcp configure <client>`. Use direct CLI commands for local installation, bridge lifecycle, terminal scripts, and CI. Both interfaces follow the same live CLI catalog and command contract.
