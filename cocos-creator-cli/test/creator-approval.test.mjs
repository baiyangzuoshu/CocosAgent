import assert from 'node:assert/strict';
import test from 'node:test';
import authorizeCommit from '../creator-extension/commit-authorization.cjs';

test('explicit commit invocation is authorized without opening a Creator dialog', async () => {
  let dialogCalls = 0;
  const dialog = { messageBox() { dialogCalls += 1; return 0; } };
  assert.equal(await authorizeCommit(dialog), true);
  assert.equal(await authorizeCommit(null), true);
  assert.equal(dialogCalls, 0);
});
