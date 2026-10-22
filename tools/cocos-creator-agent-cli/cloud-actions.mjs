import { spawnSync } from 'node:child_process';

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2022-11-28';

function failure(code, detail) { return Object.assign(new Error(code), { code, detail }); }

function boundedString(value, max = 500) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

export function parseGitHubRepository(value) {
  if (typeof value !== 'string' || !value.trim()) throw failure('CLOUD_GITHUB_REPOSITORY_REQUIRED');
  const input = value.trim();
  let match = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (!match) {
    match = input.match(/^(?:https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i)
      || input.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i);
  }
  if (!match || match[1] === '.' || match[1] === '..' || match[2] === '.' || match[2] === '..')
    throw failure('CLOUD_GITHUB_REPOSITORY_INVALID');
  return `${match[1]}/${match[2]}`;
}

export function detectGitHubRepository(projectRoot = process.cwd(), { spawnSyncImpl = spawnSync } = {}) {
  if (typeof projectRoot !== 'string' || !projectRoot) throw failure('CLOUD_PROJECT_ROOT_INVALID');
  let result;
  try {
    result = spawnSyncImpl('git', ['-C', projectRoot, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8', timeout: 3000, maxBuffer: 4096, windowsHide: true,
    });
  } catch (error) {
    throw failure('CLOUD_GITHUB_REMOTE_UNAVAILABLE', error?.message || String(error));
  }
  if (result?.error || result?.status !== 0)
    throw failure('CLOUD_GITHUB_REMOTE_UNAVAILABLE', String(result?.stderr || 'origin remote is unavailable').slice(0, 1000));
  return parseGitHubRepository(String(result.stdout || '').trim());
}

function readGitHubToken({ env = process.env, spawnSyncImpl = spawnSync } = {}) {
  for (const source of ['GITHUB_TOKEN', 'GH_TOKEN']) {
    const configured = env[source];
    if (typeof configured === 'string' && configured.trim() && configured.trim().length <= 4096)
      return { token: configured.trim(), source };
  }
  let result;
  try {
    result = spawnSyncImpl('gh', ['auth', 'token', '--hostname', 'github.com'], {
      encoding: 'utf8', timeout: 1500, maxBuffer: 4096, windowsHide: true,
    });
  } catch (_) { return { token: null, source: null }; }
  const token = result?.status === 0 ? String(result.stdout || '').trim() : '';
  return token && token.length <= 4096 ? { token, source: 'gh-auth' } : { token: null, source: null };
}

function validatePage(page, perPage) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw failure('CLOUD_PAGE_INVALID');
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) throw failure('CLOUD_PER_PAGE_INVALID');
}

function normalizeWorkflow(workflow) {
  return {
    id: workflow.id,
    name: boundedString(workflow.name, 240),
    path: boundedString(workflow.path, 500),
    state: boundedString(workflow.state, 80),
    createdAt: boundedString(workflow.created_at, 80),
    updatedAt: boundedString(workflow.updated_at, 80),
    htmlUrl: boundedString(workflow.html_url, 1000),
    badgeUrl: boundedString(workflow.badge_url, 1000),
  };
}

function normalizeRun(run) {
  return {
    id: run.id,
    name: boundedString(run.name, 240),
    workflowId: run.workflow_id ?? null,
    runNumber: run.run_number ?? null,
    runAttempt: run.run_attempt ?? null,
    displayTitle: boundedString(run.display_title, 500),
    event: boundedString(run.event, 80),
    status: boundedString(run.status, 80),
    conclusion: boundedString(run.conclusion, 80),
    branch: boundedString(run.head_branch, 240),
    commit: boundedString(run.head_sha, 80),
    actor: boundedString(run.actor?.login, 120),
    createdAt: boundedString(run.created_at, 80),
    updatedAt: boundedString(run.updated_at, 80),
    htmlUrl: boundedString(run.html_url, 1000),
  };
}

function normalizeJob(job) {
  return {
    id: job.id,
    name: boundedString(job.name, 240),
    status: boundedString(job.status, 80),
    conclusion: boundedString(job.conclusion, 80),
    startedAt: boundedString(job.started_at, 80),
    completedAt: boundedString(job.completed_at, 80),
    runnerName: boundedString(job.runner_name, 240),
    runnerGroup: boundedString(job.runner_group_name, 240),
    htmlUrl: boundedString(job.html_url, 1000),
    steps: Array.isArray(job.steps) ? job.steps.slice(0, 100).map((step) => ({
      name: boundedString(step.name, 240),
      number: step.number ?? null,
      status: boundedString(step.status, 80),
      conclusion: boundedString(step.conclusion, 80),
      startedAt: boundedString(step.started_at, 80),
      completedAt: boundedString(step.completed_at, 80),
    })) : [],
  };
}

function normalizeArtifact(artifact) {
  const workflowRun = artifact.workflow_run && typeof artifact.workflow_run === 'object' ? artifact.workflow_run : {};
  return {
    id: artifact.id,
    name: boundedString(artifact.name, 240),
    sizeBytes: Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes >= 0 ? artifact.size_in_bytes : null,
    expired: artifact.expired === true,
    digest: boundedString(artifact.digest, 100),
    createdAt: boundedString(artifact.created_at, 80),
    updatedAt: boundedString(artifact.updated_at, 80),
    expiresAt: boundedString(artifact.expires_at, 80),
    workflowRun: Number.isSafeInteger(workflowRun.id) ? {
      id: workflowRun.id,
      branch: boundedString(workflowRun.head_branch, 240),
      commit: boundedString(workflowRun.head_sha, 80),
    } : null,
  };
}

function pageInfo(body, page, perPage, count) {
  const totalCount = Number.isSafeInteger(body?.total_count) && body.total_count >= 0 ? body.total_count : null;
  return { page, perPage, totalCount, returned: count, hasMore: totalCount === null ? count === perPage : page * perPage < totalCount };
}

export async function queryGitHubActions(kind, options = {}, {
  fetchImpl = globalThis.fetch, env = process.env, spawnSyncImpl = spawnSync,
} = {}) {
  if (!['workflows', 'runs', 'jobs', 'artifacts'].includes(kind)) throw failure('CLOUD_ACTIONS_QUERY_INVALID');
  const repository = options.repository ? parseGitHubRepository(options.repository)
    : detectGitHubRepository(options.projectRoot || process.cwd(), { spawnSyncImpl });
  const page = options.page ?? 1;
  const perPage = options.perPage ?? (kind === 'runs' ? 20 : 100);
  validatePage(page, perPage);
  if (['jobs', 'artifacts'].includes(kind) && (!Number.isSafeInteger(options.runId) || options.runId < 1))
    throw failure('CLOUD_ACTIONS_RUN_ID_INVALID');

  const query = new URLSearchParams({ per_page: String(perPage), page: String(page) });
  let endpoint;
  if (kind === 'workflows') endpoint = `/repos/${repository}/actions/workflows?${query}`;
  else if (kind === 'jobs') endpoint = `/repos/${repository}/actions/runs/${options.runId}/jobs?${query}`;
  else if (kind === 'artifacts') endpoint = `/repos/${repository}/actions/runs/${options.runId}/artifacts?${query}`;
  else {
    let runsPath = `/repos/${repository}/actions/runs`;
    if (options.workflow !== undefined) {
      if (typeof options.workflow !== 'string' && !Number.isSafeInteger(options.workflow)) throw failure('CLOUD_ACTIONS_WORKFLOW_INVALID');
      const workflow = String(options.workflow);
      if (!/^(?:[1-9][0-9]{0,19}|[A-Za-z0-9_.-]{1,200}\.ya?ml)$/i.test(workflow))
        throw failure('CLOUD_ACTIONS_WORKFLOW_INVALID');
      runsPath = `/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs`;
    }
    for (const [option, parameter, pattern] of [
      ['branch', 'branch', /^[A-Za-z0-9_./-]{1,240}$/],
      ['event', 'event', /^[A-Za-z0-9_-]{1,80}$/],
      ['status', 'status', /^(?:queued|in_progress|completed|requested|waiting|pending|action_required|cancelled|failure|neutral|skipped|stale|success|timed_out)$/],
    ]) {
      if (options[option] === undefined) continue;
      if (typeof options[option] !== 'string' || !pattern.test(options[option])) throw failure(`CLOUD_ACTIONS_${option.toUpperCase()}_INVALID`);
      query.set(parameter, options[option]);
    }
    endpoint = `${runsPath}?${query}`;
  }

  if (typeof fetchImpl !== 'function') throw failure('CLOUD_FETCH_UNAVAILABLE');
  const auth = readGitHubToken({ env, spawnSyncImpl });
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'cocos-creator-agent-cli' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  let response;
  try {
    response = await fetchImpl(`${API_ROOT}${endpoint}`, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw failure(timeout ? 'CLOUD_GITHUB_REQUEST_TIMEOUT' : 'CLOUD_GITHUB_NETWORK_ERROR', error?.message || String(error));
  }
  if (!response?.ok) {
    const status = Number(response?.status) || 0;
    if (status === 401) throw failure('CLOUD_GITHUB_AUTH_INVALID');
    if (status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0') throw failure('CLOUD_GITHUB_RATE_LIMITED');
    if (status === 404) throw failure('CLOUD_GITHUB_REPOSITORY_NOT_FOUND_OR_FORBIDDEN',
      auth.token ? 'Check repository access and Actions read permission.' : 'Set GH_TOKEN/GITHUB_TOKEN or sign in with gh for private repositories.');
    throw failure('CLOUD_GITHUB_HTTP_ERROR', `HTTP ${status}`);
  }
  let body;
  try { body = await response.json(); }
  catch (_) { throw failure('CLOUD_GITHUB_RESPONSE_INVALID'); }

  if (kind === 'workflows') {
    if (!Array.isArray(body?.workflows)) throw failure('CLOUD_GITHUB_RESPONSE_INVALID');
    return { provider: 'github-actions', kind, repository, authenticated: !!auth.token, authSource: auth.source,
      pagination: pageInfo(body, page, perPage, body.workflows.length), workflows: body.workflows.slice(0, perPage).map(normalizeWorkflow) };
  }
  if (kind === 'runs') {
    if (!Array.isArray(body?.workflow_runs)) throw failure('CLOUD_GITHUB_RESPONSE_INVALID');
    return { provider: 'github-actions', kind, repository, authenticated: !!auth.token, authSource: auth.source,
      pagination: pageInfo(body, page, perPage, body.workflow_runs.length), runs: body.workflow_runs.slice(0, perPage).map(normalizeRun) };
  }
  if (kind === 'jobs') {
    if (!Array.isArray(body?.jobs)) throw failure('CLOUD_GITHUB_RESPONSE_INVALID');
    return { provider: 'github-actions', kind, repository, runId: options.runId, authenticated: !!auth.token,
      authSource: auth.source, pagination: pageInfo(body, page, perPage, body.jobs.length), jobs: body.jobs.slice(0, perPage).map(normalizeJob) };
  }
  if (!Array.isArray(body?.artifacts)) throw failure('CLOUD_GITHUB_RESPONSE_INVALID');
  return { provider: 'github-actions', kind, repository, runId: options.runId, authenticated: !!auth.token,
    authSource: auth.source, pagination: pageInfo(body, page, perPage, body.artifacts.length),
    artifacts: body.artifacts.slice(0, perPage).map(normalizeArtifact) };
}

function validateWorkflow(value) {
  if (typeof value !== 'string' && !Number.isSafeInteger(value)) throw failure('CLOUD_ACTIONS_WORKFLOW_REQUIRED');
  const workflow = String(value);
  if (!/^(?:[1-9][0-9]{0,19}|[A-Za-z0-9_.-]{1,200}\.ya?ml)$/i.test(workflow))
    throw failure('CLOUD_ACTIONS_WORKFLOW_INVALID');
  return workflow;
}

function validateRef(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 255
    || !/^[A-Za-z0-9._/-]+$/.test(value) || value.startsWith('/') || value.endsWith('/')
    || value.includes('//') || value.includes('..') || value.endsWith('.') || value.endsWith('.lock'))
    throw failure(value === undefined ? 'CLOUD_ACTIONS_REF_REQUIRED' : 'CLOUD_ACTIONS_REF_INVALID');
  return value;
}

function validateDispatchInputs(inputs) {
  if (inputs === undefined) return undefined;
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)
    || (Object.getPrototypeOf(inputs) !== Object.prototype && Object.getPrototypeOf(inputs) !== null))
    throw failure('CLOUD_ACTIONS_INPUTS_INVALID');
  const entries = Object.entries(inputs);
  if (entries.length > 25) throw failure('CLOUD_ACTIONS_INPUTS_TOO_MANY');
  const result = {};
  for (const [key, value] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,99}$/.test(key)
      || !(typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
      || (typeof value === 'string' && Buffer.byteLength(value, 'utf8') > 2048))
      throw failure('CLOUD_ACTIONS_INPUTS_INVALID');
    result[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 16000) throw failure('CLOUD_ACTIONS_INPUTS_TOO_LARGE');
  return result;
}

async function mutateGitHubActions(action, repository, endpoint, body, {
  fetchImpl = globalThis.fetch, env = process.env, spawnSyncImpl = spawnSync,
} = {}) {
  if (typeof fetchImpl !== 'function') throw failure('CLOUD_FETCH_UNAVAILABLE');
  const auth = readGitHubToken({ env, spawnSyncImpl });
  if (!auth.token) throw failure('CLOUD_GITHUB_AUTH_REQUIRED', 'Set GH_TOKEN or GITHUB_TOKEN, or sign in with gh. The token needs Actions write permission.');
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'cocos-creator-agent-cli', Authorization: `Bearer ${auth.token}` };
  let response;
  try {
    response = await fetchImpl(`${API_ROOT}${endpoint}`, {
      method: 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000), redirect: 'error',
    });
  } catch {
    throw failure(`CLOUD_ACTIONS_${action.toUpperCase()}_UNCERTAIN`,
      'GitHub did not return a response; the request outcome may be unknown. Check workflow run history before retrying.');
  }
  if (response?.ok) return { response, auth };
  const status = Number(response?.status) || 0;
  if (status === 401) throw failure('CLOUD_GITHUB_AUTH_INVALID');
  if (status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0') throw failure('CLOUD_GITHUB_RATE_LIMITED');
  if (status === 403) throw failure('CLOUD_GITHUB_PERMISSION_DENIED', 'The token needs Actions write permission for this repository.');
  if (status === 404) throw failure('CLOUD_GITHUB_REPOSITORY_NOT_FOUND_OR_FORBIDDEN',
    'Check repository access, workflow identity, and Actions write permission.');
  if (status === 409 && action === 'cancel') throw failure('CLOUD_ACTIONS_CANCEL_CONFLICT', 'GitHub could not cancel this workflow run in its current state.');
  if (status === 422 && action === 'dispatch') throw failure('CLOUD_ACTIONS_DISPATCH_REJECTED',
    'Check that the workflow is enabled and declares workflow_dispatch, and that the ref and inputs are valid.');
  throw failure('CLOUD_GITHUB_HTTP_ERROR', `GitHub Actions ${action} failed with HTTP ${status}.`);
}

export async function dispatchGitHubActions(options = {}, dependencies = {}) {
  const repository = options.repository ? parseGitHubRepository(options.repository)
    : detectGitHubRepository(options.projectRoot || process.cwd(), { spawnSyncImpl: dependencies.spawnSyncImpl });
  const workflow = validateWorkflow(options.workflow);
  const ref = validateRef(options.ref);
  const inputs = validateDispatchInputs(options.inputs);
  const body = { ref, ...(inputs === undefined ? {} : { inputs }) };
  const { response, auth } = await mutateGitHubActions('dispatch', repository,
    `/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, body, dependencies);
  let receipt = {};
  if (response.status !== 204) {
    try {
      const data = await response.json();
      if (Number.isSafeInteger(data?.workflow_run_id) && data.workflow_run_id > 0) receipt.runId = data.workflow_run_id;
      if (typeof data?.html_url === 'string' && data.html_url.startsWith('https://github.com/')) receipt.htmlUrl = data.html_url.slice(0, 1000);
    } catch (_) { /* Some API versions return an empty success response. */ }
  }
  return { provider: 'github-actions', action: 'dispatch', state: 'accepted', repository, workflow, ref,
    authenticated: true, authSource: auth.source, acceptedAt: new Date().toISOString(), ...receipt };
}

export async function cancelGitHubActionsRun(options = {}, dependencies = {}) {
  const repository = options.repository ? parseGitHubRepository(options.repository)
    : detectGitHubRepository(options.projectRoot || process.cwd(), { spawnSyncImpl: dependencies.spawnSyncImpl });
  const runId = options.runId;
  if (!Number.isSafeInteger(runId) || runId < 1) throw failure('CLOUD_ACTIONS_RUN_ID_INVALID');
  const { auth } = await mutateGitHubActions('cancel', repository,
    `/repos/${repository}/actions/runs/${runId}/cancel`, undefined, dependencies);
  return { provider: 'github-actions', action: 'cancel', state: 'accepted', repository, runId,
    authenticated: true, authSource: auth.source, acceptedAt: new Date().toISOString() };
}
