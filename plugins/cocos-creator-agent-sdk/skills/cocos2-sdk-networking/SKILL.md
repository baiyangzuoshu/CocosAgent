---
name: cocos2-sdk-networking
description: Integrate a user-selected networking or multiplayer SDK with a Creator 2.4.x project.
---

# Networking and multiplayer SDK integration

## Scope

Integrate a user-selected networking or multiplayer SDK with a Creator 2.4.x project.

## Workflow

1. Confirm the exact registered project and Creator patch, then verify that the requested vendor SDK is installed and compatible.
2. Confirm the provider, transport, topology, target platforms, backend contract, authentication flow, and project data model.
3. Inspect current official SDK docs and project-owned API contracts before writing networking code.
4. Specify connection, timeout, retry, disconnect, reconnect, and authority/error states before implementing.
5. Use test environments only; do not contact production endpoints unless the user explicitly requests it.

## Safety and acceptance

This optional Skill is provider-specific workflow guidance only after a concrete provider is selected. Use current official vendor documentation and the project’s actual dependency versions. Keep credentials out of source, traces, and chat. Require explicit authorization for network, store, payment, ad, account, or production-side effects. If the SDK/tooling or sandbox proof is missing, stop and state the exact gap.
