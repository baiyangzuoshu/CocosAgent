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
      "testIds": ["asset-identity", "asset-import-ready"],
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
      "testCases": [
        { "id": "player-jump", "actions": [{ "type": "key", "key": "Space" }], "assertions": [{ "type": "node-property", "path": "Player", "property": "y", "expected": 1 }] },
        { "id": "startup-clean", "actions": [{ "type": "key", "key": "Space" }], "assertions": [{ "type": "no-errors" }] }
      ]
    }
  ]
}
```

The plan permits 1–64 suites with unique IDs. Node suites explicitly list 1–64 `.js`, `.cjs` or `.mjs` files inside the project. Node's `node:test` runner executes them in child processes. These tests verify host-side JavaScript logic, not Creator globals, compilation or scene behavior. TypeScript needs prior project compilation or an editor test provider; the adapter does not silently transpile it. Tests execute project code with the current user's permissions and are not sandboxed. The protocol accepts no shell-command strings or downloaded test dependencies. Editor `testIds` are unique stable IDs, with up to 1000 declared per suite; each approved Editor run executes at most 64 selected cases. Creator Provider suites may declare up to 64 `testIds`; their command input schema must expose a string-array `testIds` property, and the CLI sends only the cases assigned to that shard. Provider suite input reserves `coverage`; use the CLI flag to request it.

`--shard <index>/<total>` keeps Node's test-case sharding. Creator Provider and direct Editor suites with `testIds`, preview script suites with `testIds`, and declarative preview suites with `testCases`, split by stable case ID; suites without case IDs stay whole on one deterministic shard. The CLI verifies that every selected case appears exactly once in its result. Preview cases run sequentially against the same attached session; they are not automatically reset between cases, so make each case establish the state it needs. Reports include selected/skipped suites and selected case IDs.

`timeoutMs` applies to Node suites (100–180000 ms, default 30000) and Preview script suites (100–25000 ms, default 25000). A Preview script timeout closes the Agent-owned browser and requires manual review because JavaScript already running in the page cannot be cancelled safely. Timeout/cancellation terminates the owned Node process group and fails the run. Missing tests, all-skipped suites, malformed output and nonzero process exits cannot yield a pass. Inherited Node preload flags and test-runner context are cleared in subprocesses.

## Creator Provider adapter

An editor test provider uses [the project command Provider contract](13-agent-command-providers.md). Its run command must be `control` with `approval: true`, including read-only test cases. To shard cases, declare an optional `testIds` array of strings in the command input schema and call the helper with those IDs: `runTests(cases, { ids: input.testIds })`. To support `creator test --coverage`, also declare an optional boolean `coverage` property. The CLI sets it to `true`; the provider owns instrumentation and must return per-file counters bound to source hashes. The CLI verifies the connected project's exact path and Creator version, discovers the provider live, binds the invocation to its fingerprint, and checks the selected result IDs. Creator's native approval remains required.

Return this data as the provider command's `result`:

```json
{
  "schemaVersion": 1,
  "tests": [
    { "id": "asset-identity", "name": "AssetDB identity", "status": "passed", "durationMs": 3 }
  ],
  "coverage": {
    "schemaVersion": 1,
    "files": [{
      "path": "assets/Scripts/Inventory.js",
      "sha256": "<sha256-of-current-project-source>",
      "metrics": {
        "lines": { "covered": 18, "total": 20 },
        "branches": { "covered": 3, "total": 4 },
        "functions": { "covered": 5, "total": 6 }
      }
    }]
  },
  "requiresManualReview": false
}
```

Case statuses are `passed`, `failed` or `skipped`; failures can include a bounded `message`. Coverage files must be unique project-relative `.js`, `.cjs`, `.mjs`, `.ts` or `.tsx` paths. Each file includes its lowercase SHA-256 and one or more `lines`, `statements`, `branches` or `functions` counters, each with nonnegative integer `covered` and `total` values where covered does not exceed total. The CLI rejects unsafe/missing files, stale hashes and malformed counters; it aggregates totals and percentages in the saved report. This checks that reported counters name the current source, but the provider remains responsible for measuring the code it actually executed. The coverage payload is limited to 256 KiB and 512 files.

The optional CLI helper `testing/creator-test-harness.cjs` can be copied into a project-owned provider. It exports `runTests([{id, name, run}], {ids, timeoutMs, coverage})`; `coverage` is an optional provider-produced report passed through for CLI validation, not an instrumentation engine. Each `run` function uses the project's Creator APIs. The provider owns setup and cleanup, preferably in `finally`. The helper limits total execution to 25 seconds to fit the 30 second Provider IPC. Timed-out code may still execute inside Creator: the helper marks manual review and skips later cases; it cannot claim cancellation or automatic restoration.

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

`CreatorTest.run` accepts up to 64 selected cases per execution, with a default 10-second per-case timeout and a 25-second total budget. A timeout marks the run for manual review and skips remaining cases because already-started Editor work cannot be cancelled. With `--coverage`, the CLI adds `coverage: true` to the reserved `input.__cocosAgentTest` object; the script must return its own instrumentation counters in the same `coverage` shape described for Creator Providers. The CLI validates current-source hashes and aggregates the results. The complete Editor response is limited to 64 KiB, so its coverage object is limited to 48 KiB. A commit timeout, malformed receipt or uncertain result is marked for manual review; watch stops and does not replay that script automatically. Mock adapter tests verify orchestration and receipt handling; live Creator 2.4.15 execution is required for Editor acceptance.

For example, after running the cases the script can return the test result with its measured counters:

```js
const report = await CreatorTest.run(cases);
return { ...report, coverage: { schemaVersion: 1, files: measuredCoverageFiles } };
```

## Preview adapter

Preview suites forward declarative actions/assertions to `creator.preview.interact`. A legacy suite uses `input.actions` and `input.assertions`; a case suite uses 1–64 `testCases`, each with a unique stable `id`, optional `name`, and its own `actions`, `assertions`, and optional `settleMs`. Each case requires at least one action and assertion. Session identity is supplied with `--session` and cannot be replaced by manifest input. Watched changes refresh the same session before its preview suites; the bridge rechecks scene identity. With `--coverage`, the owned Chromium session collects V8 precise function/block-range counters during the same actions and assertions. Case-level coverage in a shard is merged by script URL and matching function/range offsets. Coverage is restricted to scripts served from the selected preview origin and reports source offsets, not line-level source coverage; external CDN scripts are excluded.

For PlayMode-like tests that need to call `cc` directly, declare a Preview script suite with a project-local file under `.cocos-agent/preview-tests/`, stable `testIds`, optional JSON `input`, and an optional 100–25000 ms `timeoutMs`:

```json
{
  "id": "runtime-script",
  "adapter": "preview",
  "scriptPath": ".cocos-agent/preview-tests/runtime.js",
  "testIds": ["scene-loaded", "player-present"],
  "input": { "expectedScene": "Main" },
  "timeoutMs": 15000,
  "dependsOn": ["assets/Scripts/"]
}
```

The file runs inside the exact attached Preview page with `cc`, `input`, and `CreatorTest`. It must return the report from `CreatorTest.run()`; each `run` callback receives `{ cc, input }`. The CLI and bridge bind the execution to the exact project, current script SHA-256, Preview session, and scene identity. Scripts are limited to 16 KiB, input and results to 16 KiB and 64 KiB, and each invocation runs at most 64 selected cases. `CreatorTest.run` defaults to a 5-second per-case limit and uses the suite timeout as its total budget. With `--coverage`, the same Chromium V8 capture includes project code exercised by the script, subject to the Preview-origin rule above. This executes project JavaScript in the live game page and is not sandboxed; use it only for tests whose runtime side effects are understood. A timed-out, malformed, or identity-changing execution closes the Agent-owned browser, requires manual review, and is never replayed automatically. Shard merging validates the test script's current source hash.

```js
return CreatorTest.run([
  {
    id: 'scene-loaded',
    name: 'Expected scene is active',
    run: ({ cc, input }) => {
      const scene = cc.director.getScene();
      CreatorTest.assert(scene && scene.name === input.expectedScene, 'Expected scene is not active.');
    },
  },
  {
    id: 'player-present',
    run: ({ cc }) => CreatorTest.assert(Boolean(cc.find('Player')), 'Player node was not found.'),
  },
]);
```

## Results and watch

Each executed plan writes JSON and JUnit XML into a new directory under `~/.cocos-creator-agent/test-results/<run-id>/`. `--report-dir <new-absolute-directory>` selects an output outside the project. Existing run directories are refused. JSON includes case/suite statuses, project identity, manifest SHA-256, Node source hashes, supported adapter coverage, shard assignment, timestamps, durations, receipts and the JUnit SHA-256. Failed or cancelled runs exit nonzero.

After all workers finish, merge the exact shard set into a fresh aggregate report:

```sh
cocos-creator-agent creator test merge \
  --reports '["/tmp/shard-1/results.json","/tmp/shard-2/results.json"]' \
  --report-dir /tmp/merged-test-results
```

The merger requires one successful-to-completion report for every index from `1/N` through `N/N`, with matching project path, Creator version, test manifest, selected suites, coverage setting and sharding strategy. A report with failed test cases is mergeable and the aggregate remains failed; cancelled or manual-review reports are refused. The merger validates stable case assignments, rejects duplicate results, and checks Node, Editor script and Preview script sources against the saved SHA-256 values and current project files. The output has a new JSON/JUnit pair and keeps adapter coverage under `coverageByShard`, because per-shard file totals can overlap and cannot safely be summed into a unique project-wide coverage percentage. Output directories must be new and outside the project.

```sh
cocos-creator-agent creator watch --project-root /absolute/project \
  --paths '["tests","assets/Scripts"]' --affected \
  --instance <instance-id> --session <previewSessionId>
```

Watch accepts up to 32 files/directories and always includes the manifest. Directory watches detect additions, edits and deletions. They reject symlinks, exclude `.git`, Host configuration, dependency and Creator cache directories, and cap traversal at 4096 entries/512 files, 8 MiB per file and 32 MiB total. Select focused source/test directories rather than texture/build trees.

`--affected` selects suites whose `dependsOn` file or directory prefix matches a changed file, plus changes to their Node test files. Suites without dependencies rerun on any change. Manifest changes invalidate all selections. Unrelated changes emit a skip event. Every executed run has separate JSON/JUnit artifacts; validation failures emit errors. Progress is NDJSON. Ctrl+C/SIGTERM stops watch and cancels owned Node processes. An editor call already dispatched needs manual review rather than automatic replay.
