---
name: cocos2-cli
description: Set up the standalone Cocos Creator CLI MCP server and install its bundled Creator workflow skills for Codex or Claude Code.
---

# Cocos Creator CLI setup

The standalone `cocos-creator-agent` CLI owns the MCP server, client configuration, and bundled Creator workflow skills. Use this bootstrap skill only to install or repair that CLI integration.

1. Check `cocos-creator-agent version --format json` and `cocos-creator-agent doctor`.
2. Read `cocos-creator-agent skill show` or `cocos-creator-agent skill show cocos2-cli` for the version-matched CLI workflow guide.
3. Install Creator workflow skills with `cocos-creator-agent skill install codex` or `cocos-creator-agent skill install claude-code`. Add `--local` to install into the current project. Select one with `--skill <name>`; use `--dry-run` to inspect changes first.
4. Configure the client MCP server with `cocos-creator-agent mcp configure codex` or `cocos-creator-agent mcp configure claude-code`. Use `mcp status` to inspect it and `mcp list` to see supported clients.
5. Restart the Host after MCP setup, then use `cocos-creator-agent instances list` to identify the exact Creator instance. Do not infer the target from a project name or foreground window.

The CLI can also run without Codex or Claude for people, scripts, and CI. Creator writes still require the supported operation plan, Creator approval, before-state validation, and reconciliation described by the installed task-specific skill.
