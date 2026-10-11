# CocosAgent for Creator 2.4.15

This is a Creator-owned Agent extension. Creator opens the Assistant panel, starts and stops its local runtime, and supplies the active Creator project as the only registered target. It works without Codex or a Codex-managed MCP Host.

## Build an installable extension folder

Use Node.js 20 or newer from the repository root:

```sh
node tools/cocos-agent-bridge/package-creator-extension.mjs bundle --output /absolute/path/CocosAgentCreatorPackage
```

Copy the generated folder into the Creator project's `packages/cocos-agent-bridge` directory, then reload the extension. The package includes its Agent runtime, MCP dependencies, skill data and the Creator extension source. It does not include Codex plugin metadata or local MCP configuration.

For repository development, install only the generated runtime into this source extension folder:

```sh
node tools/cocos-agent-bridge/package-creator-extension.mjs install-runtime --extension /absolute/path/to/project/packages/cocos-agent-bridge
```

The command refuses to replace an existing runtime. To update it, remove that generated `assistant-runtime` directory first, then run the command again.

## Runtime requirements and local data

- Creator 2.4.15 and Node.js 20 or newer must be available on the machine. Set `COCOS_AGENT_NODE` if Node 20 is not the `node` on `PATH`.
- The Assistant stores a remembered DeepSeek key in the current OS user's `~/.cocos-agent/credentials.env` (on Windows, under `%USERPROFILE%`). The file is plain text and is restricted to the current user where the OS supports file mode permissions. It is outside the game project and must not be committed or shared. A key stored by the earlier prototype must be entered again once.
- Operation records, conversation traces and project registration data remain under the active Creator project's `.cocos-agent` or `temp` folders.
- The API key is passed from the Creator extension to its Agent child process and is filtered from the child MCP server environment.

The external coding-agent adapter remains optional. New Creator product functionality must not require its process, plugin installation, plugin cache or project-relative repository paths.
