import assert from 'node:assert/strict';
import test from 'node:test';
import { detectGitHubRepository, parseGitHubRepository, queryGitHubActions } from '../cloud-actions.mjs';

function response(body, status = 200, headers = {}) {
  return { ok: status >= 200 && status < 300, status,
    headers: { get(name) { return headers[name.toLowerCase()] ?? null; } },
    async json() { return body; } };
}

test('GitHub repository identity accepts supported remotes and reads origin without mutation', () => {
  assert.equal(parseGitHubRepository('acme/game.git'), 'acme/game');
  assert.equal(parseGitHubRepository('https://github.com/acme/game/'), 'acme/game');
  assert.equal(parseGitHubRepository('git@github.com:acme/game.git'), 'acme/game');
  assert.equal(parseGitHubRepository('ssh://git@github.com/acme/game.git'), 'acme/game');
  let invocation;
  assert.equal(detectGitHubRepository('/projects/game', { spawnSyncImpl(command, args, options) {
    invocation = { command, args, options };
    return { status: 0, stdout: 'git@github.com:acme/game.git\n' };
  } }), 'acme/game');
  assert.deepEqual(invocation.args, ['-C', '/projects/game', 'remote', 'get-url', 'origin']);
  assert.equal(invocation.options.timeout, 3000);
  assert.throws(() => parseGitHubRepository('https://example.com/acme/game.git'), { code: 'CLOUD_GITHUB_REPOSITORY_INVALID' });
});

test('cloud workflow inventory reports bounded workflow targets and never returns the token', async () => {
  let request;
  const result = await queryGitHubActions('workflows', { repository: 'acme/game', page: 2, perPage: 20 }, {
    env: { GH_TOKEN: 'secret-token' }, spawnSyncImpl() { throw new Error('gh must not run'); },
    async fetchImpl(url, options) {
      request = { url, options };
      return response({ total_count: 1, workflows: [{ id: 123, name: 'Build', path: '.github/workflows/build.yml',
        state: 'active', html_url: 'https://github.com/acme/game/actions/workflows/build.yml', created_at: '2026-01-01T00:00:00Z' }] });
    },
  });
  assert.equal(request.url, 'https://api.github.com/repos/acme/game/actions/workflows?per_page=20&page=2');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-token');
  assert.equal(request.options.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.equal(result.provider, 'github-actions');
  assert.equal(result.authSource, 'GH_TOKEN');
  assert.equal(result.workflows[0].path, '.github/workflows/build.yml');
  assert.deepEqual(result.pagination, { page: 2, perPage: 20, totalCount: 1, returned: 1, hasMore: false });
  assert.doesNotMatch(JSON.stringify(result), /secret-token/);
});

test('cloud runs query a workflow target with validated filters and normalized build records', async () => {
  let requestedUrl;
  const result = await queryGitHubActions('runs', { repository: 'acme/game', workflow: 'build.yml',
    branch: 'main', event: 'push', status: 'completed', perPage: 10 }, {
    env: {}, spawnSyncImpl() { return { status: 1, stderr: 'not signed in' }; },
    async fetchImpl(url) {
      requestedUrl = new URL(url);
      return response({ total_count: 1, workflow_runs: [{ id: 99, name: 'Build Game', workflow_id: 7, run_number: 11,
        run_attempt: 2, event: 'push', status: 'completed', conclusion: 'success', head_branch: 'main',
        head_sha: 'a'.repeat(40), actor: { login: 'builder' }, created_at: '2026-02-01T00:00:00Z',
        html_url: 'https://github.com/acme/game/actions/runs/99' }] });
    },
  });
  assert.equal(requestedUrl.pathname, '/repos/acme/game/actions/workflows/build.yml/runs');
  assert.equal(requestedUrl.searchParams.get('branch'), 'main');
  assert.equal(requestedUrl.searchParams.get('event'), 'push');
  assert.equal(requestedUrl.searchParams.get('status'), 'completed');
  assert.equal(result.authenticated, false);
  assert.equal(result.runs[0].conclusion, 'success');
  assert.equal(result.runs[0].runAttempt, 2);
  assert.equal(result.runs[0].actor, 'builder');
});

test('cloud jobs expose job and step status for a selected run', async () => {
  let requestedUrl;
  const result = await queryGitHubActions('jobs', { repository: 'acme/game', runId: 42 }, {
    env: { GITHUB_TOKEN: 'token' }, spawnSyncImpl() {},
    async fetchImpl(url) {
      requestedUrl = url;
      return response({ total_count: 1, jobs: [{ id: 43, name: 'build-web', status: 'completed', conclusion: 'success',
        runner_name: 'ubuntu-latest', steps: [{ name: 'Build', number: 1, status: 'completed', conclusion: 'success' }] }] });
    },
  });
  assert.equal(requestedUrl, 'https://api.github.com/repos/acme/game/actions/runs/42/jobs?per_page=100&page=1');
  assert.equal(result.runId, 42);
  assert.equal(result.jobs[0].runnerName, 'ubuntu-latest');
  assert.equal(result.jobs[0].steps[0].name, 'Build');
});

test('cloud query rejects unsafe identifiers, invalid filters, and unbounded pagination before network access', async () => {
  let fetchCalls = 0;
  const deps = { env: {}, spawnSyncImpl() { return { status: 1 }; }, async fetchImpl() { fetchCalls += 1; return response({}); } };
  await assert.rejects(queryGitHubActions('jobs', { repository: 'acme/game' }, deps), { code: 'CLOUD_ACTIONS_RUN_ID_INVALID' });
  await assert.rejects(queryGitHubActions('runs', { repository: 'acme/game', workflow: '../secret.yml' }, deps), { code: 'CLOUD_ACTIONS_WORKFLOW_INVALID' });
  await assert.rejects(queryGitHubActions('runs', { repository: 'acme/game', branch: 'main;curl x' }, deps), { code: 'CLOUD_ACTIONS_BRANCH_INVALID' });
  await assert.rejects(queryGitHubActions('runs', { repository: 'acme/game', page: 1001 }, deps), { code: 'CLOUD_PAGE_INVALID' });
  assert.equal(fetchCalls, 0);
});

test('GitHub access errors are actionable and do not include bearer credentials', async () => {
  const result = await queryGitHubActions('workflows', { repository: 'acme/private' }, {
    env: { GITHUB_TOKEN: 'must-not-leak' }, spawnSyncImpl() {},
    async fetchImpl() { return response({}, 404); },
  }).catch((error) => error);
  assert.equal(result.code, 'CLOUD_GITHUB_REPOSITORY_NOT_FOUND_OR_FORBIDDEN');
  assert.match(result.detail, /Actions read permission/);
  assert.doesNotMatch(`${result.message} ${result.detail}`, /must-not-leak/);
});
