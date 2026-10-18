---
name: cocos2-sdk-purchases
description: Integrate a user-selected in-app purchase SDK with a Creator 2.4.x project.
---

# In-app purchase SDK integration

## Scope

Integrate a user-selected in-app purchase SDK with a Creator 2.4.x project.

## Workflow

1. Confirm the exact registered project and Creator patch, then verify that the requested vendor SDK is installed and compatible.
2. Confirm store, SDK/provider, product model, target platform, receipt validation owner, and sandbox/test account availability.
3. Use current vendor/store documentation; treat purchase initiation, transaction completion, server validation, and entitlement delivery as separate steps.
4. Never fabricate a receipt, mark a purchase successful from a client callback alone, or execute a real purchase without explicit user authorization.
5. Verify only with the provider’s sandbox flow and report which server-side checks remain unverified.

## Safety and acceptance

This optional Skill is provider-specific workflow guidance only after a concrete provider is selected. Use current official vendor documentation and the project’s actual dependency versions. Keep credentials out of source, traces, and chat. Require explicit authorization for network, store, payment, ad, account, or production-side effects. If the SDK/tooling or sandbox proof is missing, stop and state the exact gap.
