---
name: cocos2-content-build
description: Plan, run, and inspect a Creator 2.4.15 Web-Mobile build for an already selected CocosAgent content release.
---

# Creator 2.4 Web-Mobile content build

Use only for Cocos Creator **2.4.15** and `web-mobile`. Read the [build contract](../../content-build-web-0.1.md) and the official [2.4 command-line build manual](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-in-command-line.html) first. This skill does not cover Creator 3.8, native packages, Asset Bundles, remote publishing, or hot update.

Require the desired content release to be selected. Call `content.build.plan` with its exact `releaseId`, previously read `expectedFingerprint`, and a fresh `buildId`; inspect the derived release fingerprint, target, Creator path and isolated output path. Continue with `content.build.execute` only when the plan is ready. Read `content.build.get` after execution. If a Host restart left `state: running` or `needs-review`, use `content.build.reconcile` to inspect existing output without starting another build. Require `state: completed` plus `outcome: verified`; a Creator process exit code by itself does not establish that the textures reached the package.

The command never overwrites an existing output folder. If a build fails or stops in `needs-review`, retain the operation and partial output for inspection; retry with a new buildId after diagnosing the cause. Creator's command-line build requires a GUI environment. Do not claim live packaging, deployment, or runtime behavior from unit-test fixtures.

**Validation status:** contract and isolated tests pass. A real Creator 2.4.15 Web-Mobile output has not yet been inspected; until then, treat package-path assumptions as pending runtime validation.
