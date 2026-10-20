# Creator 2.x reference notes

These notes are bundled from the repository's `docs/2.x/` research. They primarily describe Creator 2.4.15 source and the platforms stated in each note. They are not a guarantee for every Creator 2.4.x patch.

| Note | Topic |
| --- | --- |
| `01-startup-and-frame.md` | Engine assembly, startup, and frame loop |
| `02-objects-and-scenes.md` | Nodes, components, scenes, and Prefabs |
| `03-scripts-and-scheduling.md` | Component scripts and execution order |
| `04-assets-and-loading.md` | Asset identity, loading, and release |
| `05-input-and-events.md` | Input and event systems |
| `06-graphics-rendering.md` | Graphics and rendering |
| `07-ui-system.md` | UI system |
| `08-animation-and-effects.md` | Animation and presentation |
| `09-physics-and-spatial.md` | Physics and spatial systems |
| `10-publishing-and-native.md` | Publishing and native targets |
| `11-auxiliary-capabilities.md` | Auxiliary capabilities |
| `12-editor-extension-and-diagnostics.md` | Editor extensions and project diagnostics |
| `13-agent-command-providers.md` | Project extension command provider contract for CLI/MCP discovery |

Read only the note relevant to the current task, then verify the exact Creator patch and target platform in the project/editor. These notes are research references rather than a substitute for installed-version documentation or a live tool contract.

## Skill-to-note map

These mappings identify where to look for version-specific engine evidence. They do not mean that every workflow step in a Skill has been experimentally verified. The detailed 51-Skill static review, including official manual links and unsupported tool assumptions, is in the repository audit record [`cocos-creator-third-party-skills-validation-20261019.md`](../../../docs/agent-foundation/cocos-creator-third-party-skills-validation-20261019.md).

| Skill area | Read when engine details matter |
| --- | --- |
| `cocos2-project-bootstrap`, project startup/preview behavior | `01-startup-and-frame.md` |
| scene composition, node operations, scene workflows, Prefab workflows/source | `02-objects-and-scenes.md` |
| script development/workflows, project-wide script features | `03-scripts-and-scheduling.md` |
| Asset Bundles, dynamic loading/release, resource identity, sprite atlas references | `04-assets-and-loading.md` |
| UI event binding and input propagation | `05-input-and-events.md` |
| rendering diagnostics, materials/Effect, texture/render behavior, atlas rendering, TileMap rendering | `06-graphics-rendering.md` |
| UI structure/layout/component properties, Label behavior | `07-ui-system.md` |
| animation and audio configuration/optimization | `08-animation-and-effects.md` |
| 2D/3D physics and collision; navigation only when the project provides an explicit implementation | `09-physics-and-spatial.md` |
| builds, native publishing, JSB/native plugins and native memory questions | `10-publishing-and-native.md` |
| localization, networking, storage and hot update | `11-auxiliary-capabilities.md` |
| Creator editor extensions, AssetDB integration, project package and importer diagnosis | `12-editor-extension-and-diagnostics.md` |
| CLI/MCP discovery of project-local Creator extension commands | `13-agent-command-providers.md` |

The general router and the `cocos2-*-workflows` routers should load the specialist's mapped note only when a task needs Creator API, serialized-data, or engine-runtime detail. `cocos2-mcp-tools`, `cocos2-project-extensions`, `cocos2-project-search`, and `cocos2-task-review-recovery` describe Host/project workflows rather than Creator engine APIs; inspect live Host tools and repository instructions instead of inferring an engine capability from those Skills.
