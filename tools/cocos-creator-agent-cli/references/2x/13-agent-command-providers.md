# Creator 2.4.15 Agent command providers

This note defines how a project-local Creator extension can expose declared commands to the standalone Cocos Creator Agent CLI and its MCP server. The interface is source-implemented in CLI 0.9.0 / Creator extension 0.6.0. It still requires a real Creator 2.4.15 extension reload to verify the IPC round trip.

## Discovery contract

The Agent extension scans only direct child packages under the active project's `packages/` and `extensions/` directories. A provider must have a non-symlink `package.json`, a regular main entry, and a package name matching `^[a-z][a-z0-9-]{0,63}$`. Global extensions are not included. Duplicate provider names are ambiguous and skipped.

Declare a bounded command list in the provider package manifest:

```json
{
  "name": "sample-assets",
  "version": "1.0.0",
  "main": "main.js",
  "cocos-creator-agent": {
    "creatorVersion": "2.4.15",
    "protocolVersion": "1",
    "commands": [
      {
        "id": "inspect-assets",
        "title": "Inspect assets",
        "description": "Read project asset metadata.",
        "access": "read",
        "input": {
          "type": "object",
          "required": ["query"],
          "properties": { "query": { "type": "string", "minLength": 1, "maxLength": 80 } },
          "additionalProperties": false
        }
      }
    ]
  }
}
```

`access` is `read`, `plan`, `write`, or `control`. `write` and `control` declarations must set `"approval": true`; `read` and `plan` commands must not request approval. The schema subset accepts object, array, string, number, integer, and boolean fields, with bounded properties/items, enums and numeric/string limits. It rejects `$ref`, regex, arbitrary JSON, unknown schema keys, prototype-related property names, and open-ended object properties. Runtime arguments are checked against that schema in CLI and again in the Creator Agent extension.

## Main-process IPC

The extension main entry must answer two messages. `cocosAgentDescribe` returns the exact normalized command declaration list and echoes the challenge. `cocosAgentInvoke` handles one declared command and replies with JSON data. For example:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const provider = manifest['cocos-creator-agent'];
const stableJson = (value) => Array.isArray(value) ? `[${value.map(stableJson).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const providerFingerprint = crypto.createHash('sha256').update(stableJson(provider)).digest('hex');

module.exports = {
  messages: {
    cocosAgentDescribe(event, request) {
      event.reply(null, {
        providerId: manifest.name,
        protocolVersion: provider.protocolVersion,
        challenge: request.challenge,
        commands: provider.commands,
      });
    },
    async cocosAgentInvoke(event, request) {
      try {
        if (request.protocolVersion !== provider.protocolVersion) throw new Error('PROTOCOL_MISMATCH');
        const command = provider.commands.find((item) => item.id === request.commandId);
        if (!command) throw new Error('COMMAND_NOT_FOUND');
        if (request.providerFingerprint !== providerFingerprint) throw new Error('STALE_PROVIDER');
        const result = await runDeclaredCommand(command.id, request.arguments);
        event.reply(null, { commandId: command.id, result });
      } catch (error) {
        event.reply({ code: 'PROVIDER_COMMAND_FAILED', message: String(error.message || error) });
      }
    },
  },
};

function runDeclaredCommand(commandId, args) {
  if (commandId === 'inspect-assets') return { query: args.query, matches: [] };
  throw new Error('COMMAND_NOT_IMPLEMENTED');
}
```

The Agent extension also compares the live descriptor against the current manifest before every invocation, so stale declarations are rejected even when a provider does not independently check the fingerprint. Creator's main IPC routes messages as `<package-name>:<message-name>` and returns `event.reply` data to the callback.

## Invocation and safeguards

Use `cocos-creator-agent extension commands list --instance <id>` to discover the live catalog. Invoke a command through `extension command call`, passing the exact live provider fingerprint when available:

```sh
cocos-creator-agent extension command call --instance <id> --provider sample-assets \
  --command inspect-assets --fingerprint <sha256> --input '{"query":"icon"}'
```

The MCP server discovers online project providers during `tools/list`, creates project-scoped names, and rechecks the instance path and provider fingerprint before call. Tool descriptions do not import project-provided text. Every `write` or `control` invocation shows a native Creator approval dialog with the provider, declared action, bounded arguments and project identity. The approved action is rechecked after the dialog and is refused if the extension manifest or provider contract changed.

Creator extensions execute code in the editor process. This contract does not sandbox a provider or prove its declared `read`/`write` behavior; install and invoke only extensions you trust. Write/control tasks are never automatically replayed. If interrupted, the returned recovery guidance requires manual review unless the provider exposes a separately declared read/reconcile command.

The live Creator 2.4.15 handshake, approval dialog and provider command execution remain pending editor acceptance. Unit tests of the schema validator or MCP adapter do not prove Creator IPC behavior.
