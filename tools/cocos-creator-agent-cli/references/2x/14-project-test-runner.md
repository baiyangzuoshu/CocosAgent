# Creator project tests and continuous verification

The project runner unifies Node tests, project-installed Creator command providers, direct Creator Editor scripts and live preview suites under one manifest with JSON/JUnit reports, watch, rerun-failed, sharding and supported coverage. These remain distinct evidence sources. Creator 2.4.15 has no documented built-in Unity-style Edit Mode/Play Mode test CLI: Editor-context suites run through either an approved project Provider or a directly approved Editor script, while PlayMode-like suites run against the exact attached Web preview session.

## Manifest and discovery

Place `.cocos-agent/tests.json` in the authorized Creator 2.4.15 project. `creator test --project-root <absolute-path> --list` validates and lists the plan without executing suites. Run all suites with `creator test --project-root <path>`; repeat `--suite <id>` to select suites. Editor/preview suites require the exact `--instance <id>`; preview suites also require `--session <previewSessionId>`.

```json
{
  "schemaVersion": 1,
  "suites": [
    {
      "id": "game-logic",
      "adapter": "node",
      "files": ["tests/movement.test.cjs", "tests/collision.test.mjs"],
      "dependsOn": ["assets/Scripts/", "tests/"],
      "timeoutMs": 30000
    },
    {
      "id": "editor-assets",
      "adapter": "creator",
      "providerId": "project-tests",
      "commandId": "run-tests",
      "input": {}
    },
    {
      "id": "editor-script-tests",
      "adapter": "editor",
      "scriptPath": "packages/project-tests/editor-scripts/run-tests.js",
      "testIds": ["project-open", "assetdb-ready"],
      "input": {}
    },
    {
      "id": "runtime",
      "adapter": "preview",
      "dependsOn": ["assets/"],
      "input": { "actions": [{ "type": "key", "key": "Space" }], "assertions": [{ "type": "no-errors" }] }
    }
  ]
}
```

The plan permits 1–64 suites with unique IDs. Node suites explicitly list 1–64 `.js`, `.cjs` or `.mjs` files inside the project. Node's `node:test` runner executes them in child processes. These tests verify host-side JavaScript logic, not Creator globals, compilation or scene behavior. TypeScript needs prior project compilation or an editor test provider; the adapter does not silently transpile it. Tests execute project code with the current user's permissions and are not sandboxed. The protocol accepts no shell-command strings or downloaded test dependencies. Editor `testIds` are unique stable IDs, with up to 1000 declared per suite; each approved Editor run executes at most 64 selected cases.

`--shard <index>/<total>` keeps Node's test-case sharding and assigns each `creator` or `preview` suite as a whole to one deterministic shard based on its suite ID. An Editor suite with `testIds` is split by stable test ID; an Editor suite without `testIds` stays whole. Reports include selected/skipped suites and selected Editor case IDs. Creator Provider coverage is not inferred from its test count; direct Editor script coverage is unsupported.

`timeoutMs` applies only to Node suites (100–180000 ms, default 30000). Timeout/cancellation terminates the owned process group and fails the run. Missing tests, all-skipped suites, malformed output and nonzero process exits cannot yield a pass. Inherited Node preload flags and test-runner context are cleared in subprocesses.

## Creator Provider adapter

An editor test provider uses [the project command Provider contract](13-agent-command-providers.md). Its run command must be `control` with `approval: true`, including read-only test cases. CLI verifies the connected project's exact path and Creator version, discovers the provider live, and binds the invocation to its fingerprint. Creator's native approval remains required.

Return this data as the provider command's `result`:

```json
{
  "schemaVersion": 1,
  "tests": [
    { "id": "asset-identity", "name": "AssetDB identity", "status": "passed", "durationMs": 3 }
  ],
  "requiresManualReview": false
}
```

Case statuses are `passed`, `failed` or `skipped`; failures can include a bounded `message`. The optional CLI helper `testing/creator-test-harness.cjs` can be copied into a project-owned provider. It exports `runTests([{id, name, run}], {ids, timeoutMs})`; each `run` function uses the project's Creator APIs. The provider owns setup and cleanup, preferably in `finally`. The helper limits total execution to 25 seconds to fit the 30 second Provider IPC. Timed-out code may still execute inside Creator: the helper marks manual review and skips later cases; it cannot claim cancellation or automatic restoration.

An invoked Provider call that fails or returns an uncertain result requires manual review. Watch then stops without repeating it. Reports preserve actual Provider receipts; mock adapter tests prove only response handling. Live Creator evidence is required for editor acceptance.

## Direct Editor script adapter

Use this adapter for a project-owned JavaScript test file under `packages/<package>/editor-scripts/`. The file must be at most 16 KiB and cannot be a symlink. The CLI first asks the connected 2.4.15 Editor to freeze the exact source and JSON input, checks the returned identity and SHA-256 against the local file, then requests the `creator.editor.eval-file.commit` operation. Creator displays its native approval dialog for every execution. The script runs with `Editor` privileges and is not sandboxed; its effects and persistence are not verified.

The file body runs inside an async function with `Editor`, `input`, and the built-in `CreatorTest` harness. To enable case-level sharding, list the script's stable case IDs in the suite's optional `testIds` array. `CreatorTest.run()` checks that every selected ID exists in the script, runs only assigned cases, captures thrown errors, and returns the required JSON report. The CLI verifies that every assigned case appears exactly once in the result.

```js
return CreatorTest.run([
  {
    id: 'project-open',
    name: 'Editor has an open project',
    run: () => CreatorTest.assert(Boolean(Editor.Project.path), 'No project is open.'),
  },
  {
    id: 'assetdb-ready',
    name: 'AssetDB is available',
    run: () => CreatorTest.assert(Boolean(Editor.assetdb), 'AssetDB is unavailable.'),
  },
]);
```

`CreatorTest.run` accepts up to 64 selected cases per execution, with a default 10-second per-case timeout and a 25-second total budget. A timeout marks the run for manual review and skips remaining cases because already-started Editor work cannot be cancelled. The Editor script runner also bounds source, input and result size. A commit timeout, malformed receipt or uncertain result is marked for manual review; watch stops and does not replay that script automatically. Mock adapter tests verify orchestration and receipt handling; live Creator 2.4.15 execution is required for Editor acceptance.

## Preview adapter

Preview suites forward declarative actions/assertions to `creator.preview.interact`. At least one action and assertion are required. Session identity is supplied with `--session` and cannot be replaced by manifest input. Watched changes refresh the same session before its preview suites; the bridge rechecks scene identity. With `--coverage`, the owned Chromium session collects V8 precise function/block-range counters during the same actions and assertions. Coverage is restricted to scripts served from the selected preview origin and reports source offsets, not line-level source coverage; external CDN scripts are excluded.

## Results and watch

Each executed plan writes JSON and JUnit XML into a new directory under `~/.cocos-creator-agent/test-results/<run-id>/`. `--report-dir <new-absolute-directory>` selects an output outside the project. Existing run directories are refused. JSON includes case/suite statuses, project identity, manifest SHA-256, Node source hashes, supported adapter coverage, shard assignment, timestamps, durations, receipts and the JUnit SHA-256. Failed or cancelled runs exit nonzero.

```sh
cocos-creator-agent creator watch --project-root /absolute/project \
  --paths '["tests","assets/Scripts"]' --affected \
  --instance <instance-id> --session <previewSessionId>
```

Watch accepts up to 32 files/directories and always includes the manifest. Directory watches detect additions, edits and deletions. They reject symlinks, exclude `.git`, Host configuration, dependency and Creator cache directories, and cap traversal at 4096 entries/512 files, 8 MiB per file and 32 MiB total. Select focused source/test directories rather than texture/build trees.

`--affected` selects suites whose `dependsOn` file or directory prefix matches a changed file, plus changes to their Node test files. Suites without dependencies rerun on any change. Manifest changes invalidate all selections. Unrelated changes emit a skip event. Every executed run has separate JSON/JUnit artifacts; validation failures emit errors. Progress is NDJSON. Ctrl+C/SIGTERM stops watch and cancels owned Node processes. An editor call already dispatched needs manual review rather than automatic replay.
