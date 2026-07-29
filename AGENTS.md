# CocosAgent — AI Development Instructions

This repository implements a local, permission-controlled AI development agent for Cocos Creator
2.4.15. It combines an Agent runtime, a desktop client, Cocos project services, and a project-local
Creator extension.

## Product Baseline

- The first supported editor version is Cocos Creator `2.4.15`.
- The local editor reference path is
  `/Applications/Cocos/Creator/2.4.15/CocosCreator.app`, but production code must not hard-code it.
- `engine2.4.15/` is a read-only knowledge source. Do not modify or import it into production code.
- `cocos-2.4.15-demo/` is the destructive-test fixture project.
- `branding/cocos-agent-icon.png` is the brand master asset.
- `docs/` contains the approved product, architecture, protocol, safety, permission, roadmap, and
  test design.

Read [docs/README.md](docs/README.md) before architecture or feature work.

## Intended Architecture

The production implementation must preserve these boundaries:

- One Agent loop owns model calls, tool execution, retries, cancellation, and context management.
- Cocos capabilities are registered through a removable `CocosFeature`, not hard-coded into the
  runtime.
- Cocos services own project inspection, indexing, scripts, assets, scenes, builds, validation, and
  the Bridge client.
- The Creator extension lives outside the Agent runtime and exposes only a fixed command protocol.
- The desktop layer owns UI, HTTP/NDJSON transport, application lifecycle, and user approvals.

Expected implementation layout:

```text
src/
├── mod.ts
├── runtime.ts
├── registry.ts
├── permissions.ts
├── features/
│   └── cocos.ts
└── cocos/
    ├── contracts.ts
    ├── project.ts
    ├── indexer.ts
    ├── scripts.ts
    ├── scene.ts
    ├── assets.ts
    ├── build.ts
    ├── bridge_client.ts
    └── validation.ts

creator-extension/
└── cocos-agent-bridge/
```

Do not create parallel Agent loops for individual Cocos features.

## Cocos Project Boundaries

Treat project paths according to these rules:

- `assets/` is the primary editable source tree.
- `settings/` permits limited, schema-validated edits.
- `packages/cocos-agent-bridge/` is the only package path managed automatically by CocosAgent.
- `project.json` is read-only except during an explicit migration.
- `library/`, `temp/`, `local/`, and `build/` are generated state, not source-of-truth input.
- `.fire`, `.prefab`, and `.meta` are protected serialized assets.
- `engine2.4.15/` is read-only by default.

Resolve and validate real paths at execution time. `auto` mode must never write outside the active
project or escape it through symlinks.

## Scene, Prefab, Meta, and UUID Safety

Do not treat Cocos serialized assets as ordinary JSON.

- Modify Scene and Prefab objects through Creator Scene Script or Editor APIs.
- Import, move, refresh, and query assets through AssetDB APIs.
- Never generate, replace, or reuse UUIDs manually.
- Never directly edit internal fields such as `__id__`, `__type__`, or Prefab synchronization data.
- General-purpose file tools must deny writes to `.fire`, `.prefab`, and `.meta`.
- Every Scene or Prefab write must have a preview, approval, recovery point, save, reread, and
  verification step.
- A timeout does not prove that an editor operation failed. Query state before retrying.
- Mark uncertain write outcomes as `indeterminate` and stop further automatic mutations.

Scene writes are serialized. AssetDB refresh and Scene writes must not overlap. Agent teams must not
modify the same Scene or Prefab concurrently.

## Creator Bridge Rules

The Creator Bridge is a local capability boundary, not a generic remote execution server.

- Bind only to `127.0.0.1`, never `0.0.0.0`.
- Require protocol version, request ID, session ID, project ID, expiry, and a session token.
- Validate request and response sizes.
- Use a fixed command enum and runtime-validated parameter schemas.
- Never accept arbitrary JavaScript, module paths, functions, or Shell commands.
- Do not expose the Bridge to the LAN or internet.
- Close the server and clear session state when the extension unloads.
- Keep Scene mutations serial and bound read-only concurrency explicitly.
- Propagate timeout and cancellation signals through the Bridge client.

Bridge logs may contain command names, targets, durations, and error codes. They must not contain
tokens, credentials, full scripts, full scenes, or unbounded editor logs.

## Tool Development

Add tools through `ToolRegistry` and register Cocos-specific prompt sections through the prompt
registration contract.

Every Cocos tool must define:

- A narrow, runtime-validated input schema.
- A bounded output schema.
- A permission classification.
- Project and path validation.
- AbortSignal behavior.
- User-visible tool events.
- Post-operation verification for mutations.

Prefer paths, UUID summaries, node paths, counts, warnings, and cursors over dumping complete files
or scene trees. Asset lists, node trees, logs, and dependency results must be bounded and paginated.

## Permission Model

The supported modes are:

- `ask`: require approval for mutating, external, and dangerous operations.
- `auto`: approve ordinary project-scoped operations while retaining all safety checks.
- `full`: unrestricted execution only after explicit user selection; hard-deny rules still apply.

Classify operations explicitly:

- Read-only: project inspection, asset listing, scene tree reads, bounded logs.
- Mutating: script edits, asset imports, node creation, component changes, scene saves.
- Externally effectful: editor launch, preview, build, external file import.
- Dangerous: deletions, raw serialized-asset writes, engine edits, unresolved recursive operations.

Deletion remains confirmation-gated in every mode. Raw `.fire`, `.prefab`, `.meta`, engine-source,
and non-loopback Bridge operations are denied by default.

## Process and Cancellation Safety

- Preserve AbortSignal propagation through providers, tools, Bridge requests, preview, and builds.
- A cancelled run must terminate or explicitly detach every process it started.
- Bound Agent iterations, tool calls, Bridge concurrency, output size, log retention, and build
  duration.
- Do not blindly retry non-idempotent Creator operations.
- Report when editor state requires manual intervention, such as unsaved user changes.

## Fixture and Generated Files

Use `cocos-2.4.15-demo/` for integration and destructive tests.

The fixture must eventually cover:

- A saved Scene.
- A Prefab and an instance.
- A custom component with serialized properties.
- Label, Sprite, Button, Layout, and Widget components.
- `assets/textures/cocos-agent-icon.png`.

Do not commit fixture-generated directories:

```text
cocos-2.4.15-demo/library/
cocos-2.4.15-demo/temp/
cocos-2.4.15-demo/local/
cocos-2.4.15-demo/build/
```

Do not use generated cache data as the expected source structure in tests.

## Secrets and Local Data

- Never commit API keys, tokens, Keychain output, session secrets, `.env.local`, or user project
  data.
- Use platform credential storage or explicitly supplied environment variables.
- Never return plaintext credentials through general HTTP endpoints, Bridge responses, logs,
  telemetry, or renderer state.
- Persist JSON atomically through a temporary file followed by rename.
- Validate all persisted data and HTTP/Bridge request bodies.

## Documentation Discipline

Update the relevant document when changing product scope, architecture, Bridge protocol, tool
contracts, serialized-asset safety, permission classification, roadmap, or test requirements.

The design sources are:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/COCOS_PROJECT_MODEL.md`
- `docs/EDITOR_BRIDGE.md`
- `docs/TOOL_DESIGN.md`
- `docs/SCENE_PREFAB_SAFETY.md`
- `docs/PERMISSIONS.md`
- `docs/MVP_ROADMAP.md`
- `docs/TEST_STRATEGY.md`

Do not report a feature complete when implementation and its design contract disagree.

## Verification

During implementation, run the smallest relevant checks first. Before marking a production change
complete, run the repository's final format, type, unit, and integration tasks once they are
defined.

The minimum architectural checks must verify:

```sh
# Production must not import the engine source or fixture.
rg 'engine2\.4\.15|cocos-2\.4\.15-demo' src desktop creator-extension

# General file-writing code must not write protected serialized assets.
rg '\\.(fire|prefab|meta)' src

# Bridge must not bind to all interfaces.
rg '0\\.0\\.0\\.0' creator-extension src
```

Expected matches must be reviewed and limited to explicit protection rules, validation, test
fixtures, or documentation. A raw match is not automatically acceptable.

Creator integration changes also require native validation with Creator 2.4.15:

1. Load and unload the Bridge extension.
2. Connect only over loopback.
3. Read the current Scene.
4. Perform the supported mutation.
5. Save, close, and reopen the Scene.
6. Check editor compilation and deserialization logs.
7. Run Web Preview or the smallest relevant build.

Cross-process compilation alone does not prove Creator runtime correctness.

## Change Discipline

- Preserve unrelated user changes and generated artifacts.
- Prefer small cohesive Cocos service modules over adding responsibilities to the runtime or
  desktop entry point.
- Keep public contracts typed and runtime-validated.
- Do not add Creator 3.x compatibility implicitly.
- Do not weaken permissions or serialized-asset guards to make tests pass.
- Do not modify `engine2.4.15/` unless the user explicitly changes its read-only status.
- Do not claim migration or MVP completion without Creator integration verification.
