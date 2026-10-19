# Cocos Creator Agent CLI

Standalone local CLI for Cocos Creator 2.4.15 projects. It can run without Codex, Claude Code, or the Creator-native CocosAgent. The package includes its loopback bridge, the Creator project extension template, and the canonical read-only command contract.

## Requirements

- Node.js 20 or newer.
- Cocos Creator 2.4.15 for editor-connected commands.

## Install and update

The package is not published to a public npm registry yet. From a checkout of this repository, install it globally with:

```sh
npm install --global ./tools/cocos-creator-agent-cli
```

To update, install again from the newer checkout or package tarball:

```sh
npm install --global ./tools/cocos-creator-agent-cli
```

The CLI is independently versioned and may be installed or updated without installing the Codex / Claude plugin. Verify the installed package with `cocos-creator-agent version --format json`.

## Commands

```sh
cocos-creator-agent --help
cocos-creator-agent catalog --format json
cocos-creator-agent instances list
cocos-creator-agent extension install --project-root /absolute/path/to/project
```

The current Creator command catalog is read-only. Use `instances list` to discover an editor instance, then pass its exact ID to `capabilities` or `call`. The explicit `extension install` command writes the bundled extension into the selected project's `packages/cocos-creator-agent-extension/` directory and refuses to overwrite an existing extension. Reload the project in Creator before checking the live instance.

`catalog --format json` and `call --instance <id> --command <id> --input <json> --format json` are the machine-readable interface used by the third-party plugin MCP adapter.
