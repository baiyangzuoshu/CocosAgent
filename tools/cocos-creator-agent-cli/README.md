# Cocos Creator Agent CLI

Standalone local CLI for Cocos Creator 2.4.15 projects. It can run without Codex, Claude Code, or the Creator-native CocosAgent. The package includes its loopback bridge, the Creator project extension template, and the canonical Creator command contract.

## Requirements

- Node.js 20 or newer.
- Cocos Creator 2.4.15 for editor-connected commands.

## Install and update

The CLI distribution channel is a versioned GitHub Release tarball, not the public npm registry. The first matching Release must be published before these commands work. Install an exact release globally with:

```sh
VERSION=0.6.0
npm install --global "https://github.com/baiyangzuoshu/CocosAgent/releases/download/cocos-creator-agent-cli-v${VERSION}/cocos-creator-agent-cli-v${VERSION}.tgz"
```

Check for or install the latest release from the terminal:

```sh
cocos-creator-agent self-update --check
cocos-creator-agent self-update
```

Pin or roll back to a specific release with `cocos-creator-agent self-update --version <VERSION>`. Updates download the release archive and its SHA-256 asset, verify the checksum, then ask npm to replace the global package. Verify the installed package with `cocos-creator-agent version --format json`.

Repository maintainers publish a CLI release by updating `package.json`, committing the change, and pushing a matching `cocos-creator-agent-cli-v<VERSION>` tag. The GitHub Actions workflow checks the tag against the package version, creates an npm tarball, and attaches the archive and SHA-256 file to the GitHub Release. Bump `creator-extension/package.json` whenever its installed behavior or contract changes; extension updates use the template bundled in the installed CLI.

## Commands

```sh
cocos-creator-agent --help
cocos-creator-agent catalog --format json
cocos-creator-agent doctor
cocos-creator-agent doctor --project-root /absolute/path/to/project
cocos-creator-agent instances list
cocos-creator-agent extension install --project-root /absolute/path/to/project
cocos-creator-agent extension status --project-root /absolute/path/to/project
cocos-creator-agent extension update --project-root /absolute/path/to/project
cocos-creator-agent extension uninstall --project-root /absolute/path/to/project
cocos-creator-agent creator build --project-root /absolute/path/to/project --creator /Applications/Cocos/Creator/2.4.15/CocosCreator.app --platform web-mobile
cocos-creator-agent creator build --project-root /absolute/path/to/project --creator /Applications/Cocos/Creator/2.4.15/CocosCreator.app --platform android --build-path /absolute/path/to/native-build
cocos-creator-agent creator compile --project-root /absolute/path/to/project --creator /Applications/Cocos/Creator/2.4.15/CocosCreator.app --platform android --build-path /absolute/path/to/native-build
cocos-creator-agent creator test --instance <instance-id> --session <preview-session-id> --input '{"actions":[{"type":"key","key":"Space","durationMs":100}],"assertions":[{"type":"no-errors"}]}'
cocos-creator-agent project-tools list --instance <instance-id>
cocos-creator-agent tasks start --instance <instance-id> --command creator.project.search --input '{"query":"Player"}'
cocos-creator-agent tasks status --id <task-id>
cocos-creator-agent tasks wait --id <task-id> --after-sequence <event-sequence>
cocos-creator-agent tasks cancel --id <task-id>
cocos-creator-agent tasks resume --instance <instance-id> --id <task-id>
```

`doctor` is read-only and does not start the bridge. It checks the Node.js and bundled contract versions, bridge health, connected Creator instances, and—when `--project-root` is supplied—the project extension and path identity.

Use `instances list` to discover an editor instance, then pass its exact ID to `capabilities` or `call`. The Creator catalog includes read commands and a minimal script-asset write workflow:

1. Call `creator.script.create.plan` with an existing `assets/` subfolder, an `assets/`-relative JS/TS path, and exact source. Creator verifies that the parent path has no symlinks and the file and `.meta` are absent, then stores a private operation record under `~/.cocos-creator-agent/creator-operations/` and returns an operation ID, plan hash, source preview, and recovery conditions. It does not change project assets or create folders.
2. After reviewing that plan, call `creator.script.create.commit` with only its operation ID and plan hash. Creator opens a native approval dialog showing the target and exact source. Cancel makes no project change. Approval triggers a fresh project/version/path/absence/hash check, then creates the asset through `Editor.assetdb.create`.
3. The extension reads the created script and `.meta` back through the same Creator instance and returns the UUID, importer, source hash, metadata hash, and conditional recovery data. If the response is lost or the bridge restarts, call `creator.script.create.reconcile` with the original operation ID. Writes are never automatically retried; a changed target is reported as a conflict.

The scene-node read command can inspect one node by scene UUID and node UUID even when it is outside the bounded snapshot. The scene-node write slice changes only the `active` property of one existing node in the current scene. `creator.scene.node.set-active.plan` binds the request to the active scene UUID, node UUID/path, and observed before-state without changing the scene. `commit` requires the operation ID and plan hash, opens a native Creator approval dialog, rechecks project/editor/contract and node before-state, changes the property through Creator Scene Script, requests save with `scene:stash-and-save`, then reads the same node back. Creator 2.4 documents no completion acknowledgement for that save IPC, so the receipt reports `sceneSaveRequestSent` and `sceneSaveCompletionConfirmed: false`; it does not claim disk persistence. After interruption, `creator.scene.node.set-active.reconcile` only observes and classifies state; it never retries the write. A `save-required` result means the mutation was observed but the save request was not journaled, so inspect and save manually in Creator.

The script-creation write slice creates a script asset only. It does not attach a component to a scene, compile, or verify runtime behavior. The explicit `extension install` command writes the bundled extension into the selected project's `packages/cocos-creator-agent-extension/` directory and refuses to overwrite an existing extension. `extension status` reports its version and tracked-file drift. `extension update` and `extension uninstall` refuse to overwrite or remove locally changed/unmanaged files by default. Pass `--force` only after reviewing the report; the CLI preserves the existing extension under `~/.cocos-creator-agent/extension-backups/` before replacing or removing it. Reload the project in Creator after install, update, or uninstall.

`creator build` and `creator compile` wrap the documented Creator 2.4.15 [`--build` and `--compile` command line](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-in-command-line.html) and return JSON with the selected project, Creator patch, platform, output path, process exit result, elapsed time, and bounded logs. Pass the exact Creator 2.4.15 application bundle and absolute project path. By default, build outputs go to a unique path under `~/.cocos-creator-agent/builds/`; a requested build output path must be new and outside the project. The CLI does not clean or overwrite build output. `creator compile` requires an existing native build output directory from a prior build and operates on that directory. `--auto-compile` is accepted only for native `creator build`. Web builds need no external platform SDK. Native workflows check for the configured Android SDK/JDK or Xcode before starting; missing requirements are reported without launching Creator. This initial workflow verifies macOS `.app` bundle metadata; other Creator package formats need their own version reader before use.

`creator test` is a same-session preview smoke-test adapter. It calls `creator.preview.interact` with the supplied bounded actions/assertions and exits nonzero when any assertion fails. It does not claim to run a Creator unit-test suite. Creator 2.4.15 has no documented Unity-style `test` or `watch` CLI command; project-specific test runners and live file watching remain separate work.

For direct terminal use, call `creator.script.create.plan` through `call`, then copy its `operationId` and `planHash` into a `creator.script.create.commit` call. The commit waits for the Creator confirmation dialog. Use `creator.script.create.reconcile` on the same operation after a timeout or restart.

```sh
cocos-creator-agent call --instance <instance-id> --command creator.script.create.plan --input '{"scriptPath":"scripts/Example.js","source":"cc.Class({ extends: cc.Component });"}'
cocos-creator-agent call --instance <instance-id> --command creator.script.create.commit --input '{"operationId":"<operation-id>","planHash":"<plan-sha256>"}'
```

For a single existing scene node, use its live scene/node UUIDs from `creator.scene.snapshot`:

```sh
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.read --input '{"sceneUuid":"<scene-uuid>","nodeUuid":"<node-uuid>"}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.set-active.plan --input '{"sceneUuid":"<scene-uuid>","nodeUuid":"<node-uuid>","active":false}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.set-active.commit --input '{"operationId":"<operation-id>","planHash":"<plan-sha256>"}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.set-active.reconcile --input '{"operationId":"<operation-id>"}'
```

`catalog --format json` and `call --instance <id> --command <id> --input <json> --format json` are the machine-readable interface used by the third-party plugin MCP adapter.

## Project tool registrations

A project may add `.cocos-agent/tools.json` to register named aliases for existing **read-only Creator commands**. The registry cannot run project callbacks, register writes, or change a command input schema. It is re-read from the selected live Creator project when requested; the result includes its SHA-256 and the canonical input schema.

```json
{
  "schemaVersion": 1,
  "tools": [
    {
      "id": "player-script",
      "title": "Read player script",
      "description": "Read the player's component script and Creator metadata identity.",
      "commandId": "creator.script.read"
    }
  ]
}
```

Use `project-tools list --instance <id>` to discover the declarations and `project-tools call --instance <id> --tool player-script --input '{"scriptPath":"assets/Scripts/Player.ts"}'` to invoke one. Aliases use the mapped built-in command's exact input schema and live Creator capability. Pass `--registry-hash <sha256>` when invoking a tool discovered earlier; the call is rejected if the project declaration changed.

## Asynchronous tasks and recovery

`tasks start` returns a durable task ID without waiting for the Creator operation. `tasks wait --id <id> --after-sequence <N> [--wait-ms 25000]` holds a local bridge request until a newer persisted event arrives or returns the current progress on timeout. The response includes `eventSequence`; pass that cursor to wait for the next update. `tasks list` returns bounded summaries and `tasks status` reads one task's result; global `tasks list` works while Creator is disconnected, and `--instance <id>` filters it. `tasks cancel` requests cooperative cancellation. Task records are stored under `~/.cocos-creator-agent/tasks/` with restrictive permissions and contain the exact input for explicit recovery, while status output omits the raw input and reports its SHA-256.

After a bridge restart, queued tasks become interrupted; dispatched reads can be explicitly resumed. A dispatched script-creation commit resumes through `creator.script.create.reconcile`; a scene-node active commit resumes through `creator.scene.node.set-active.reconcile`, each with its original operation ID and never by replaying the write. Other dispatched plans, writes, and controls become `needs-reconciliation` and are not replayed automatically. Cancellation is best effort after dispatch; a potentially side-effecting command may require reconciliation even when cancellation was requested.

## Compile and Web preview feedback

`diagnostics read --instance <id>` reads Creator Builder compile events, script-import failures, and editor Console events with a sequence cursor. A `compile-finished` event proves only that the event fired; it is not by itself a successful compile result.

`preview start --instance <id> [--port 7456]` requests Creator's active-scene Web preview and requires a native Creator approval. Creator's selected preview target must be Browser; the documented IPC follows that selection. Creator opens its normal preview, then the local bridge opens an isolated Chromium session to the same loopback port. The command returns a `previewSessionId` bound to that Creator instance, project, and scene UUID. Select Chromium with `COCOS_CREATOR_AGENT_BROWSER` when it is not in a standard install location.

Use that session ID with `preview observe`, `preview screenshot`, `preview refresh`, `preview interact`, and `preview stop`. Interactions are limited to a keyboard whitelist with bounded press duration, normalized canvas clicks, and declarative scene/node/Console/component-field assertions. Refresh reuses the same browser session and verifies the expected scene again. Screenshots are saved under `~/.cocos-creator-agent/captures/`; stopping closes the Agent-owned browser but leaves Creator's preview server running.

The runtime browser commands fail closed when Chromium, the loopback preview server, or the expected scene identity is unavailable. Runtime evidence is not inferred from source code or from Creator compile events.
