# Cocos Creator CLI bootstrap plugin

This compatibility plugin contains one setup Skill for users who install Cocos tools through a Codex or Claude Code plugin directory. It does not host an MCP server or contain the Creator workflow skill library.

The standalone Cocos Creator CLI is the product owner for both integrations:

- `cocos-creator-agent mcp configure <codex|claude-code>` registers the CLI-owned stdio MCP server using the client’s native CLI.
- `cocos-creator-agent skill install <client>` installs the CLI-bundled Creator workflow skills into the client’s native skill directory.
- `cocos-creator-agent` remains usable directly by people, scripts, and CI without a Host plugin.

Install and update the CLI from its versioned release as described in [`tools/cocos-creator-agent-cli/README.md`](../../tools/cocos-creator-agent-cli/README.md). Then run `cocos-creator-agent skill install <client>` and `cocos-creator-agent mcp configure <client>`. Restart the Host after configuring MCP.

The maintained skill sources and Creator 2.4.15 reference notes are bundled with the CLI in `tools/cocos-creator-agent-cli/skills/` and `tools/cocos-creator-agent-cli/references/2x/`. This plugin’s `cocos2-cli` Skill is only an onboarding entry point; it is not the source of MCP or Creator workflow behavior.
