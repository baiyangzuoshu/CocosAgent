# Cocos Creator Agent Skills

This is the third-party Host skill package for Codex and Claude Code. It is independent of the Creator-native CocosAgent and its internal Assistant Host/MCP process.

The package targets general Cocos Creator 2.4.x workflows. It contains a router plus focused skills for project setup and search, scripts, scenes and Prefabs, UI, assets, gameplay systems, audio/rendering, runtime, builds, and extensions. It does not contain LinkUpClient-specific business conventions.

## Package boundary

- `skills/` contains the 51 core workflow skills.
- `references/2x/` contains Creator 2.4.15 research notes for engine API and serialized-data questions; verify any claim against the exact target patch and platform.
- Codex metadata is in `plugin.json` and `.codex-plugin/plugin.json`.
- Claude Code metadata is in `.claude-plugin/plugin.json`; skills are discovered under `skills/`.
- This package currently provides skills only. It does not yet ship the planned third-party CLI, MCP server, or Creator-side tool bridge. A skill never implies that a tool or editor operation is installed.
- Optional vendor SDK guidance is a separate package at `../cocos-creator-agent-sdk/` and is not part of the core plugin.

## Operating rules

Identify the exact project root and Creator patch before acting. Inspect the available Host and Creator integrations and use only tools they actually expose. Preserve Creator-generated `.meta` files, UUIDs, and asset references. If an operation requires an unavailable Creator-aware tool, report the gap instead of claiming an editor or runtime result. Distinguish source changes, Creator acceptance, compile/build results, and runtime behavior.
