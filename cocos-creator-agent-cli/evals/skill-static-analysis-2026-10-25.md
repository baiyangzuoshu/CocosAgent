# Cocos Creator Skill static evaluation

Generated: 2026-10-25T15:53:30.245Z
Plugin Eval: 0.1.0
Skills analyzed: 52
Grades: A 34, B 13, C 5
Static acceptance gate: PASS (0 hard failures; 68 advisory findings)

This is a static structure and token-budget scan. It does not measure skill selection, task success, or Creator runtime behavior.

| Skill | Score | Grade | Static findings |
| --- | ---: | :---: | --- |
| cocos-agent | 86 | B | description-trigger-weak, trigger_cost_tokens-budget-high, invoke_cost_tokens-budget-high |
| cocos2-animation | 95 | A | description-trigger-weak |
| cocos2-asset-bundle-content | 91 | B | description-trigger-weak, trigger_cost_tokens-budget-high |
| cocos2-audio-configuration | 95 | A | description-trigger-weak |
| cocos2-audio-optimization | 95 | A | description-trigger-weak |
| cocos2-audio-rendering-workflows | 95 | A | description-trigger-weak |
| cocos2-build-delivery-workflows | 95 | A | description-trigger-weak |
| cocos2-cli | 86 | B | invoke_cost_tokens-budget-high |
| cocos2-content-build | 95 | A | description-trigger-weak |
| cocos2-creator-extension-development | 95 | A | description-trigger-weak |
| cocos2-dynamic-content-performance | 95 | A | description-trigger-weak |
| cocos2-extension-workflows | 95 | A | description-trigger-weak |
| cocos2-fonts-text | 95 | A | description-trigger-weak |
| cocos2-gameplay-workflows | 95 | A | description-trigger-weak |
| cocos2-jsb-native-plugins | 95 | A | description-trigger-weak |
| cocos2-localization | 95 | A | description-trigger-weak |
| cocos2-material-effects | 95 | A | description-trigger-weak |
| cocos2-mcp-tools | 86 | B | invoke_cost_tokens-budget-high |
| cocos2-native-memory-bridge | 95 | A | description-trigger-weak |
| cocos2-navigation | 95 | A | description-trigger-weak |
| cocos2-package-management | 95 | A | description-trigger-weak |
| cocos2-physics-2d | 95 | A | description-trigger-weak |
| cocos2-physics-3d | 91 | B | description-trigger-weak, trigger_cost_tokens-budget-high |
| cocos2-prefab-source-edit | 86 | B | invoke_cost_tokens-budget-high |
| cocos2-prefab-workflows | 95 | A | description-trigger-weak |
| cocos2-project-bootstrap | 95 | A | description-trigger-weak |
| cocos2-project-development | 91 | B | description-trigger-weak, trigger_cost_tokens-budget-high |
| cocos2-project-extensions | 95 | A | description-trigger-weak |
| cocos2-project-search | 95 | A | description-trigger-weak |
| cocos2-project-workflows | 81 | C | description-trigger-weak, trigger_cost_tokens-budget-high |
| cocos2-rendering-diagnostics | 95 | A | description-trigger-weak |
| cocos2-resource-scene-pipeline | 91 | B | description-trigger-weak, trigger_cost_tokens-budget-high |
| cocos2-resource-workflows | 95 | A | description-trigger-weak |
| cocos2-runtime-observation | 95 | A | invoke_cost_tokens-budget-high |
| cocos2-runtime-performance | 95 | A | description-trigger-weak |
| cocos2-runtime-workflows | 95 | A | description-trigger-weak |
| cocos2-scene-composition | 81 | C | trigger_cost_tokens-budget-high, invoke_cost_tokens-budget-high |
| cocos2-scene-node-operations | 72 | C | trigger_cost_tokens-budget-high, invoke_cost_tokens-budget-high |
| cocos2-scene-workflows | 95 | A | description-trigger-weak |
| cocos2-script-development | 91 | B | trigger_cost_tokens-budget-high, invoke_cost_tokens-budget-high |
| cocos2-script-workflows | 95 | A | description-trigger-weak |
| cocos2-sprite-atlas | 91 | B | description-trigger-weak, trigger_cost_tokens-budget-high |
| cocos2-task-review-recovery | 81 | C | trigger_cost_tokens-budget-high, invoke_cost_tokens-budget-high |
| cocos2-texture-import-settings | 95 | A | description-trigger-weak |
| cocos2-tilemap | 95 | A | description-trigger-weak |
| cocos2-ui-component-properties | 91 | B | description-trigger-weak, invoke_cost_tokens-budget-high |
| cocos2-ui-event-binding | 91 | B | description-trigger-weak, invoke_cost_tokens-budget-high |
| cocos2-ui-layout | 91 | B | description-trigger-weak, invoke_cost_tokens-budget-high |
| cocos2-ui-script-wiring | 95 | A | description-trigger-weak |
| cocos2-ui-structure | 95 | A | description-trigger-weak |
| cocos2-ui-workflows | 81 | C | description-trigger-weak, trigger_cost_tokens-budget-high |
| cocos2-web-mobile-optimization | 95 | A | description-trigger-weak |

## Finding counts

- description-trigger-weak: 44
- invoke_cost_tokens-budget-high: 12
- trigger_cost_tokens-budget-high: 12

Project acceptance policy: description-trigger and token-cost findings are advisory, even if Plugin Eval reports a fail/error severity; they do not fail the static gate. Other Plugin Eval error-severity findings do fail the gate.

The `description-trigger-weak` check currently requires the literal phrase “Use when”. Treat it as a review cue, not a proven activation defect; inspect each description for a clear positive and negative trigger boundary before editing.
