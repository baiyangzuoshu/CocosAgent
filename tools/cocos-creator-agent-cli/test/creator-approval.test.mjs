import assert from 'node:assert/strict';
import test from 'node:test';
import confirmDialog from '../creator-extension/approval.cjs';

test('Creator synchronous dialog return completes both cancellation and approval', async () => {
  assert.equal(await confirmDialog({ messageBox: () => 0 }, {}), false);
  assert.equal(await confirmDialog({ messageBox: () => 1 }, {}), true);
  assert.equal(await confirmDialog({ messageBox: () => ({ response: 0 }) }, {}), false);
});

test('Creator callback and Promise responses use only the explicit approve button', async () => {
  assert.equal(await confirmDialog({ messageBox: (_options, done) => { queueMicrotask(() => done(1)); } }, {}), true);
  assert.equal(await confirmDialog({ messageBox: async () => ({ response: 0 }) }, {}), false);
  assert.equal(await confirmDialog({ messageBox: async () => ({ unexpected: true }) }, {}), false);
  assert.equal(await confirmDialog({ messageBox: (_options, done) => { done(0); return Promise.resolve({ response: 1 }); } }, {}), false);
});

test('Creator dialog errors and expired responses never approve a write', async () => {
  await assert.rejects(confirmDialog({ messageBox: () => { throw new Error('native-error'); } }, {}), /CREATOR_APPROVAL_DIALOG_FAILED/);
  let lateReply;
  // Keep the process alive while the helper's unref timer verifies expiry.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(confirmDialog({ messageBox: (_options, done) => { lateReply = done; } }, {}, { timeoutMs: 10 }), /CREATOR_APPROVAL_TIMED_OUT/);
    lateReply(1);
  } finally { clearTimeout(keepAlive); }
});
