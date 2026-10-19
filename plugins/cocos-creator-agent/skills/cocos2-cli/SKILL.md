---
name: cocos2-cli
description: Use the standalone Cocos Creator CLI from a terminal for installation, bridge operations, and structured project commands. Use when shell automation or CLI lifecycle work is needed.
---

# Cocos Creator CLI

Use the standalone `cocos-creator-agent` command when the task calls for terminal automation, CLI installation/update, Creator extension installation, or local bridge operations. This CLI is independent of the Creator-native CocosAgent and does not require Codex or Claude to run.

## Check and install

1. Run `cocos-creator-agent version --format json` to identify the installed CLI and Creator contract version.
2. If the command is missing, check the plugin README for the current installation source. In this repository checkout, install the standalone package by running `npm install --global ./tools/cocos-creator-agent-cli` from the repository root, or use its absolute package path.
3. If no installation source is available, report that the CLI is not installed or publicly distributed in this environment. Do not substitute the plugin's MCP internals for the CLI or claim the CLI install/update path has been tested.
4. After installing or updating the CLI, verify its version and restart the Host MCP server so its tool catalog is refreshed.

## Use

- Run `cocos-creator-agent --help` to discover supported commands and flags.
- Use `--format json` for output the Agent needs to parse.
- Use `catalog --format json` to inspect the command descriptions and input schemas supplied by the CLI contract.
- Use `instances list` before selecting an editor. Pass the exact returned `instanceId` for `capabilities` or `call`; never infer the target from a project name or foreground window.
- Use `bridge status`, `bridge start`, and `bridge stop` for local bridge operations.
- Use `extension install --project-root <absolute-path>` only for an explicit project installation request. Verify the exact project path before installing and let Creator reload the package before checking the live instance.
- For direct terminal command automation, use `call --instance <id> --command <id> --input <json> --format json`. The CLI validates against its canonical command contract and returns the Creator receipt.

The current command set is read-only for Creator project content. Do not claim source writes, builds, preview control, or runtime interaction through the CLI unless the installed catalog advertises those commands.

## CLI versus MCP

Use this CLI for local installation, bridge lifecycle, terminal scripts, and CI. Use `cocos2-mcp-tools` when the task needs Host-native MCP tool discovery and structured calls. Both interfaces must follow the same live CLI catalog and command contract.
