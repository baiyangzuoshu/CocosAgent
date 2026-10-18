---
name: cocos2-sdk-integrations
description: Routes optional Cocos Creator 2.4.x vendor SDK requests after the user identifies provider, product, and target platform.
---

# SDK integration router

Use only when the user asks for an SDK/vendor integration. First identify the exact SDK provider, product, version, and platform. Do not load SDK skills for generic Creator questions.

## Route

- Ads or rewarded ads → `cocos2-sdk-ads`.
- In-app purchases → `cocos2-sdk-purchases`.
- Networking/multiplayer services → `cocos2-sdk-networking`.
- Voice chat and microphone permissions → `cocos2-sdk-voice`.

SDK Skills are optional and separate from the core Creator skill package. If this package or the named SDK is not installed, report that and do not imitate its API.
