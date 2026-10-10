# CocosAgent 2.x plugin (local Codex)

This plugin packages the Creator 2.4.15 workflow skill and connects Codex to the existing local MCP stdio Host. The Host supplies no model and asks for no LLM key. The plugin is local-only because its MCP process communicates with the user’s local Creator editor and project files.

The plugin package is the single maintained source for its 2.4 task skills. It currently contains 11 task skills and ships their linked contracts, probes and acceptance records under `references/`. Docs entries for packaged skills point back to the plugin source. Before installing or updating, validate the package and its reference hashes:

```sh
node plugins/cocos-agent-2x/scripts/package-skills.mjs --check
```

The MCP server exposes `cocos://2x/skills/index`, each task skill URI, and the listed reference URIs. The index reports plugin/MCP versions, the plugin source fingerprint, and SHA-256 for each skill and reference. Read the index before relying on an installed skill snapshot.

## Prepare this checkout

From the repository root, install the pinned MCP dependencies and generate a machine-local server configuration:

```sh
cd tools/cocos-agent-bridge/mcp
npm ci
cd ../../..
node plugins/cocos-agent-2x/scripts/configure-local-plugin.mjs
```

Pass additional registered Creator 2.4.15 projects with repeated `--project /absolute/path` arguments. The generated `.mcp.json` is local configuration and is ignored by Git. It uses the current Node executable and an explicit project allowlist. The local marketplace manifest is `plugins/.agents/plugins/marketplace.json`.

Register the local marketplace with `codex plugin marketplace add ./plugins`, then install or update **CocosAgent 2.x** from `cocos-agent-local`. The installed package is versioned; verify it with `codex plugin list` and check that its cache contains every skill folder from `skill-package.json`. A running Codex task can retain the skill/tool registry it loaded at startup; package installation alone does not prove that an already-running task has refreshed its view. Instance discovery and four dedicated read-only inspection tools are pre-approved in the generated local config; the mixed semantic command executor and all other state-changing tools remain subject to the host’s approval policy.

## Verify the connection

Start with `cocos_2x_instances_list`, then select the exact ready `2.4.15` project and query its capability catalog. Do not treat `npm test` or a successful MCP handshake as evidence that a scene write, preview, runtime update, or build passed. Use the validation steps in the packaged `cocos-agent` skill and record actual receipts.

The package has no 3.x target, remote endpoint, model/API credential, arbitrary script tool, or public marketplace submission. CocosAgent’s existing version-specific contracts and evidence remain in `docs/agent-foundation/`.

## Acceptance evidence

On 2026-10-09, a natural-language Codex Agent task used the installed plugin to list and select the ready Creator `2.4.15` instance for `2.4.15NewProject/`, read its capability catalog, and fetch the active `helloworld` scene snapshot. The snapshot returned 14 nodes without truncation; the Canvas had six active children, including the red and blue release sample Sprites. No write tool ran and no scene, asset, project, or editor state changed. The snapshot reports hierarchy and active state, not component properties, transforms, resource UUIDs, or rendered appearance.

The first attempt exposed that the mixed `cocos_2x_command_execute` tool correctly requires approval even for a read command. Four dedicated read-only wrappers were added and pre-approved instead; the mixed executor and other state-changing tools remain behind the host approval policy. MCP contract tests and the packaged skill validator pass.
