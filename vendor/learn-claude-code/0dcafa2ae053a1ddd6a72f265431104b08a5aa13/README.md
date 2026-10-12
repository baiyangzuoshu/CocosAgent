# learn-claude-code source baseline

- Upstream: https://github.com/shareAI-lab/learn-claude-code
- Fixed commit: 0dcafa2ae053a1ddd6a72f265431104b08a5aa13
- Snapshot contents: the original `code.py` for each root lesson `s01` through `s17`, plus the upstream MIT license.
- The source files are archived byte-for-byte for review and TypeScript porting. Verify them with `node tools/cocos-agent-runtime/scripts/verify-upstream-baseline.mjs`.
- These Python examples are reference material. They are not imported, executed, bundled, or required by the CocosAgent TypeScript runtime.
- The CocosAgent runtime currently has no line-by-line source translations. Its TypeScript implementation was written independently from the tutorial mechanisms. The per-chapter map records behavior to preserve, current correspondence, and Creator-specific changes.
- Do not edit this snapshot. A baseline change requires a new commit-addressed directory and a reviewed mapping update; do not overwrite this one.
