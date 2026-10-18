---
name: cocos2-sdk-voice
description: Integrate a user-selected voice/chat SDK with a Creator 2.4.x project.
---

# Voice SDK integration

## Scope

Integrate a user-selected voice/chat SDK with a Creator 2.4.x project.

## Workflow

1. Confirm the exact registered project and Creator patch, then verify that the requested vendor SDK is installed and compatible.
2. Confirm provider, supported platforms, room/channel model, permissions, privacy requirements, and audio focus behavior.
3. Read current vendor docs for permission APIs and lifecycle hooks on each target platform.
4. Handle permission denial, mute, reconnect, background/foreground, and teardown explicitly.
5. Verify with test accounts/devices; do not claim microphone or remote voice behavior from compile evidence alone.

## Safety and acceptance

This optional Skill is provider-specific workflow guidance only after a concrete provider is selected. Use current official vendor documentation and the project’s actual dependency versions. Keep credentials out of source, traces, and chat. Require explicit authorization for network, store, payment, ad, account, or production-side effects. If the SDK/tooling or sandbox proof is missing, stop and state the exact gap.
