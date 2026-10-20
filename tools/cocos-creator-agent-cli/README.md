# Cocos Creator Agent CLI

Standalone local CLI for Cocos Creator 2.4.15 projects. It can run without Codex, Claude Code, or the retired Creator-native CocosAgent. The package owns the stdio MCP server, native Codex/Claude MCP setup, bundled Creator Skills and installer, loopback bridge, Creator project extension template, and canonical Creator command contract.

## Requirements

Development source is now 0.10.5, adding read-only `vcs doctor` checks for Creator asset metadata integrity, duplicate UUIDs, tracked cache/output paths, and Git conflict markers. Creator test adapters, JSON/JUnit reports, directory/affected-suite watch, rejected-handshake diagnostics, and Creator 2.4.15 preview feedback are also included. Creator extension 0.6.2 includes the approval and Creator 2.4.15 runtime compatibility fixes. The 0.9.0 tag exists remotely; online Release assets and self-update acceptance are still unverified. A locally installed package is not evidence of a public release.

- Node.js 20 or newer.
- Cocos Creator 2.4.15 for editor-connected commands.

## Install and update

The CLI distribution channel is a versioned GitHub Release tarball, not the public npm registry. The first matching Release must be published before these commands work. Install an exact release globally with:

```sh
VERSION=0.9.0
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
cocos-creator-agent mcp list
cocos-creator-agent mcp configure codex --dry-run
cocos-creator-agent mcp configure codex
cocos-creator-agent mcp configure claude-code
cocos-creator-agent mcp status codex
cocos-creator-agent skill show --list
cocos-creator-agent skill show cocos2-cli
cocos-creator-agent skill install codex --dry-run
cocos-creator-agent skill install codex
cocos-creator-agent skill install claude-code
cocos-creator-agent skill refresh codex
cocos-creator-agent catalog --format json
cocos-creator-agent doctor
cocos-creator-agent doctor --project-root /absolute/path/to/project
cocos-creator-agent vcs doctor --git-root /absolute/path/to/repository --project-root /absolute/path/to/project
cocos-creator-agent instances list
cocos-creator-agent extension install --project-root /absolute/path/to/project
cocos-creator-agent extension status --project-root /absolute/path/to/project
cocos-creator-agent extension update --project-root /absolute/path/to/project
cocos-creator-agent extension uninstall --project-root /absolute/path/to/project
cocos-creator-agent extension commands list --instance <instance-id>
cocos-creator-agent extension command call --instance <instance-id> --provider <provider-id> --command <command-id> --input '{"query":"icon"}'
cocos-creator-agent creator build --project-root /absolute/path/to/project --creator /Applications/Cocos/Creator/2.4.15/CocosCreator.app --platform web-mobile
cocos-creator-agent creator build --project-root /absolute/path/to/project --creator /Applications/Cocos/Creator/2.4.15/CocosCreator.app --platform android --build-path /absolute/path/to/native-build
cocos-creator-agent creator compile --project-root /absolute/path/to/project --creator /Applications/Cocos/Creator/2.4.15/CocosCreator.app --platform android --build-path /absolute/path/to/native-build
cocos-creator-agent creator test --instance <instance-id> --session <preview-session-id> --input '{"actions":[{"type":"key","key":"Space","durationMs":100}],"assertions":[{"type":"no-errors"}]}'
cocos-creator-agent creator watch --instance <instance-id> --session <preview-session-id> --paths '["assets/Scripts/Player.ts"]' --input '{"assertions":[{"type":"no-errors"}]}'
cocos-creator-agent project-tools list --instance <instance-id>
cocos-creator-agent tasks start --instance <instance-id> --command creator.project.search --input '{"query":"Player"}'
cocos-creator-agent tasks status --id <task-id>
cocos-creator-agent tasks wait --id <task-id> --after-sequence <event-sequence>
cocos-creator-agent tasks cancel --id <task-id>
cocos-creator-agent tasks resume --instance <instance-id> --id <task-id>
```

`doctor` is read-only and does not start the bridge. It checks the Node.js and bundled contract versions, bridge health, connected Creator instances, and—when `--project-root` is supplied—the project extension and path identity.

`vcs doctor` is a separate read-only Git/filesystem diagnostic. It requires the exact Git repository root and a Creator project root inside it; it does not stage, rewrite, or restore files. It reports tracked `library/`, `temp/`, `local/`, or `build/` paths, missing or orphaned asset `.meta` sidecars, duplicate main/subasset UUIDs parsed from JSON metadata, and paired Git conflict markers in bounded text files. Findings are diagnostic evidence, not an AssetDB import receipt; symlinks are not followed and scan limits are included in the JSON result.

`instances list` also reports recent authenticated but incompatible extension handshakes under `rejectedInstances`, including the extension-reported project path and mismatch reasons. These diagnostic records have no command session or capabilities. `doctor` flags them as errors instead of reporting only zero instances.

## MCP and Agent Skills

The CLI starts its own stdio MCP server with `cocos-creator-agent mcp serve`. Use `mcp configure codex` or `mcp configure claude-code` to register that server through the corresponding client CLI; `--dry-run` previews the change and the command writes only the `cocos-creator-agent` entry. Codex MCP configuration is user-scoped. Claude Code uses user scope by default and `--local` for the current project. Existing same-name configurations are checked first; a different configuration is preserved and reported unless `--force` is provided. Use `mcp status <client>` and `mcp remove <client>` to inspect or remove the managed entry. Restart the Host after setup.

The npm release bundles all Creator workflow Skills and Creator 2.4.15 reference notes. `skill show [name]` reads the bundled instructions without installing them; `skill show --list` lists them. `skill install <client>` installs all bundled Skills into Codex `~/.codex/skills/` or Claude Code `~/.claude/skills/`; `--local` uses `.agents/skills/` for Codex or `.claude/skills/` for Claude Code. Use `--skill <name>` to select one, `--dry-run` to preview, and `skill refresh <client>` to update previously managed copies. The installer preserves unrelated files, detects edits, and refuses unmanaged or modified targets by default. `--force` backs up the replaced directory under `~/.cocos-creator-agent/skill-backups/`. Reference notes are installed beside the client skill directory so relative links continue to resolve.

Use `instances list` to discover an editor instance, then pass its exact ID to `capabilities` or `call`. The Creator catalog includes read commands and a minimal script-asset write workflow:

1. Call `creator.script.create.plan` with an existing `assets/` subfolder, an `assets/`-relative JS/TS path, and exact source. Creator verifies that the parent path has no symlinks and the file and `.meta` are absent, then stores a private operation record under `~/.cocos-creator-agent/creator-operations/` and returns an operation ID, plan hash, source preview, and recovery conditions. It does not change project assets or create folders.
2. After reviewing that plan, call `creator.script.create.commit` with only its operation ID and plan hash. Creator opens a native approval dialog showing the target and exact source. Cancel makes no project change. Approval triggers a fresh project/version/path/absence/hash check, then creates the asset through `Editor.assetdb.create`.
3. The extension reads the created script and `.meta` back through the same Creator instance and returns the UUID, importer, source hash, metadata hash, and conditional recovery data. If the response is lost or the bridge restarts, call `creator.script.create.reconcile` with the original operation ID. Writes are never automatically retried; a changed target is reported as a conflict.

The scene-node read command can inspect one node by scene UUID and node UUID even when it is outside the bounded snapshot. The scene-node write slice changes only the `active` property of one existing node in the current scene. `creator.scene.node.set-active.plan` binds the request to the active scene UUID, node UUID/path, and observed before-state without changing the scene. `commit` requires the operation ID and plan hash, opens a native Creator approval dialog, rechecks project/editor/contract and node before-state, changes the property through Creator Scene Script, requests save with `scene:stash-and-save`, then reads the same node back. Creator 2.4 documents no completion acknowledgement for that save IPC, so the receipt reports `sceneSaveRequestSent` and `sceneSaveCompletionConfirmed: false`; it does not claim disk persistence. After interruption, `creator.scene.node.set-active.reconcile` only observes and classifies state; it never retries the write. A `save-required` result means the mutation was observed but the save request was not journaled, so inspect and save manually in Creator.

The component-add write slice adds one registered Cocos component class to one existing scene node. The plan resolves the class from Creator's loaded class registry and rejects unregistered/non-component classes, duplicate instances, and classes with implicit `requireComponent` dependencies. Commit shows the project, scene, node, and class in the native Creator approval dialog, rechecks the zero-instance precondition, adds one component through `Node.addComponent`, requests scene save, and reads the component count and instance identity back from the same scene session. Component constructors and lifecycle hooks are project code and may run; the dialog names this risk before the write. Reconciliation never replays the add. If Creator or the bridge stops between the mutation and the saved instance identity, an observed component is reported as `needs-reconciliation` for manual review.

The component-property write slice changes one declared public scalar field (`string`, `number`, or `boolean`) on one exact component instance, identified by the Creator object ID returned from component state. It rejects inherited fields, internal names, object/array/asset values, type changes, stale before-values, and component queries exceeding the 32-instance bound. Commit requires Creator approval, checks the same Creator extension session and pre-state again, applies the property and reads it back, then requests scene save. Property setters are engine/project code and may have side effects. After a Creator restart changes component object IDs, reconciliation requires manual review and never writes to a different instance. Component arrays, resource references, and UI event binding are not supported. Both scene write slices have source-level protocol tests only; Creator 2.4.15 editor acceptance is still required.

The script-creation write slice creates a script asset only. It does not attach a component to a scene, compile, or verify runtime behavior. The explicit `extension install` command writes the bundled extension into the selected project's `packages/cocos-creator-agent-extension/` directory and refuses to overwrite an existing extension. `extension status` reports its version and tracked-file drift. `extension update` and `extension uninstall` refuse to overwrite or remove locally changed/unmanaged files by default. Pass `--force` only after reviewing the report; the CLI preserves the existing extension under `~/.cocos-creator-agent/extension-backups/` before replacing or removing it. Reload the project in Creator after install, update, or uninstall.

`creator build` and `creator compile` wrap the documented Creator 2.4.15 [`--build` and `--compile` command line](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-in-command-line.html) and return JSON with the selected project, Creator patch, platform, output path, process exit result, elapsed time, and bounded logs. Pass the exact Creator 2.4.15 application bundle and absolute project path. By default, build outputs go to a unique path under `~/.cocos-creator-agent/builds/`; a requested build output path must be new and outside the project. The CLI does not clean or overwrite build output. `creator compile` requires an existing native build output directory from a prior build and operates on that directory. `--auto-compile` is accepted only for native `creator build`. Web builds need no external platform SDK. Native workflows check for the configured Android SDK/JDK or Xcode before starting; missing requirements are reported without launching Creator. This initial workflow verifies macOS `.app` bundle metadata; other Creator package formats need their own version reader before use.

`creator test` is a same-session preview smoke-test adapter. It calls `creator.preview.interact` with the supplied bounded actions/assertions and exits nonzero when any assertion fails. It does not claim to run a Creator unit-test suite. `creator watch` takes an explicit JSON list of project-relative files, runs the same smoke test once, then polls only those files; after a stable change it refreshes and rechecks the same preview session. It emits newline-delimited JSON events and stops on Ctrl+C/SIGTERM. Paths must remain inside the exact connected project, be regular non-symlink files, and fit the file/count/size bounds. This supplies a Cocos preview regression watch loop; it is not Unity's Editor test runner, and Creator 2.4.15 has no documented built-in Unity-style `test` CLI command. Project-specific unit-test runners remain separate work.

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

To add a component, use its exact Creator class name (for example `cc.Sprite`) and follow the same plan/approval/reconcile sequence:

```sh
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.add-component.plan --input '{"sceneUuid":"<scene-uuid>","nodeUuid":"<node-uuid>","componentClassName":"cc.Sprite"}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.add-component.commit --input '{"operationId":"<operation-id>","planHash":"<plan-sha256>"}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.add-component.reconcile --input '{"operationId":"<operation-id>"}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.set-component-property.plan --input '{"sceneUuid":"<scene-uuid>","nodeUuid":"<node-uuid>","componentClassName":"cc.Label","componentInstanceId":"<component-instance-id>","property":"string","value":"Ready"}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.set-component-property.commit --input '{"operationId":"<operation-id>","planHash":"<plan-sha256>"}'
cocos-creator-agent call --instance <instance-id> --command creator.scene.node.set-component-property.reconcile --input '{"operationId":"<operation-id>"}'
```

`catalog --format json` and `call --instance <id> --command <id> --input <json> --format json` are the machine-readable interface used by the CLI-owned MCP server.

Project-local extensions can publish declarative Creator command providers. The CLI discovers them from the live editor, validates the provider fingerprint and input schema, and exposes them as project-scoped MCP tools. See [`references/2x/13-agent-command-providers.md`](references/2x/13-agent-command-providers.md) for the contract. Providers run as Creator main-process extension code and are not sandboxed; write/control commands require a native Creator approval.

## Project test plans

Project test plans are documented in [`references/2x/14-project-test-runner.md`](references/2x/14-project-test-runner.md). Use `creator test --project-root <absolute-path> --list` to inspect the plan; running it writes separate JSON/JUnit reports. `creator watch --project-root <path> --paths '["tests","assets/Scripts"]' --affected` watches files/directories and reruns affected suites. Node suites use actual Node test subprocesses; editor suites invoke an approved project Creator Provider; preview suites use the exact supplied preview session. Editor execution interrupted after dispatch stops watch for manual review.

## Project tool registrations

A project may add `.cocos-agent/tools.json` to register named aliases for commands already present in the shared Creator contract. Read and plan commands can be exposed directly; write or control commands are accepted only when the canonical command requires Creator approval. The registry cannot run project callbacks or change a command input schema. MCP ignores project-provided titles and descriptions when publishing tool definitions, and write aliases retain destructive annotations and the native Creator approval flow. The registry is re-read from the selected live Creator project for listing and invocation; calls include its SHA-256 so edits invalidate stale tool discovery.

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

Use `project-tools list --instance <id>` to discover the declarations and `project-tools call --instance <id> --tool player-script --input '{"scriptPath":"assets/Scripts/Player.ts"}'` to invoke one. Aliases use the mapped built-in command's exact input schema, access level, approval requirement, and live Creator capability. Pass `--registry-hash <sha256>` when invoking a tool discovered earlier; the call is rejected if the project declaration changed. This is declarative routing over canonical commands, not an arbitrary Editor code execution API.

## Asynchronous tasks and recovery

`tasks start` returns a durable task ID without waiting for the Creator operation. `tasks wait --id <id> --after-sequence <N> [--wait-ms 25000]` holds a local bridge request until a newer persisted event arrives or returns the current progress on timeout. The response includes `eventSequence`; pass that cursor to wait for the next update. `tasks list` returns bounded summaries and `tasks status` reads one task's result; global `tasks list` works while Creator is disconnected, and `--instance <id>` filters it. `tasks cancel` requests cooperative cancellation. Task records are stored under `~/.cocos-creator-agent/tasks/` with restrictive permissions and contain the exact input for explicit recovery, while status output omits the raw input and reports its SHA-256.

After a bridge restart, queued tasks become interrupted; dispatched reads can be explicitly resumed. A dispatched script-creation commit resumes through `creator.script.create.reconcile`; a scene-node active commit resumes through `creator.scene.node.set-active.reconcile`, each with its original operation ID and never by replaying the write. Other dispatched plans, writes, and controls become `needs-reconciliation` and are not replayed automatically. Cancellation is best effort after dispatch; a potentially side-effecting command may require reconciliation even when cancellation was requested.

## Compile and Web preview feedback

`diagnostics read --instance <id>` reads Creator Builder compile events, script-import failures, and editor Console events with a sequence cursor. A `compile-finished` event proves only that the event fired; it is not by itself a successful compile result.

`preview start --instance <id> [--port 7456]` requests Creator's active-scene Web preview and requires a native Creator approval. Creator's selected preview target must be Browser; the documented IPC follows that selection. Creator opens its normal preview, then the local bridge opens an isolated Chromium session to the same loopback port. The command returns a `previewSessionId` bound to that Creator instance, project, and scene UUID. Select Chromium with `COCOS_CREATOR_AGENT_BROWSER` when it is not in a standard install location.

Use that session ID with `preview observe`, `preview screenshot`, `preview refresh`, `preview interact`, and `preview stop`. Interactions are limited to a keyboard whitelist with bounded press duration, normalized canvas clicks, and declarative scene/node/Console/component-field assertions. Refresh reuses the same browser session and verifies the expected scene again. Screenshots are saved under `~/.cocos-creator-agent/captures/`; stopping closes the Agent-owned browser but leaves Creator's preview server running.

The runtime browser commands fail closed when Chromium, the loopback preview server, or the expected scene identity is unavailable. Runtime evidence is not inferred from source code or from Creator compile events.
