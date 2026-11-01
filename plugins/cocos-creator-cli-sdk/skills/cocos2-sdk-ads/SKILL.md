---
name: cocos2-sdk-ads
description: Integrate a user-selected advertising or rewarded-ad SDK with a Creator 2.4.x project.
---

# Advertising SDK integration

## Scope

Integrate a user-selected advertising or rewarded-ad SDK with a Creator 2.4.x project.

## Workflow

1. Confirm the exact registered project and Creator patch, then verify that the requested vendor SDK is installed and compatible.
2. Confirm vendor, SDK version, platform, ad unit type, privacy/consent requirements, and the project’s existing mediation layer.
3. Read the vendor’s current official integration and lifecycle docs; never guess class names, callbacks, or manifest edits.
4. Keep initialization, load/show callbacks, reward callback, failure/close cases, and consent gating as separate states.
5. Do not trigger real ads or claim revenue/reward acceptance without an explicitly approved test environment and runtime evidence.

## Safety and acceptance

This optional Skill is provider-specific workflow guidance only after a concrete provider is selected. Use current official vendor documentation and the project’s actual dependency versions. Keep credentials out of source, traces, and chat. Require explicit authorization for network, store, payment, ad, account, or production-side effects. If the SDK/tooling or sandbox proof is missing, stop and state the exact gap.
