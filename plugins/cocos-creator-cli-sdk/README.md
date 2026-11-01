# Cocos Creator Optional SDK Skills

This is a separate, optional Codex / Claude Code plugin. It covers vendor SDK workflows for ads, purchases, networking, and voice. Do not install or invoke it for generic Creator work.

Before using a skill, identify the provider, product, SDK version, platform, and whether that SDK is already installed in the target project. The package supplies workflow guidance only; it does not grant credentials, install dependencies, authorize a store transaction, or claim that a service integration works.

The SDK package remains an optional Host plugin and is not included in the CLI's default 52-skill Creator bundle. The standalone CLI owns core MCP setup and core Creator skill installation; install this package only when a task names a matching vendor SDK. Its workflows still use whichever authorized CLI/MCP tools the Host has configured.
