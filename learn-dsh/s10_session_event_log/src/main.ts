import { SessionLog } from './session-log.ts';

const log = new SessionLog();

console.log('--- reject a surface event without its marker ---');
try {
  log.append({
    type: 'user/message',
    data: { role: 'user', content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } },
  });
} catch (error) {
  console.log(`[append] ${error instanceof Error ? error.message : String(error)}; seq=${log.seq}`);
}

log.append({ type: 'turn/start', data: { turn: 1 } });
log.append({ type: 'step/start', data: { turn: 1, step: 1 } });
log.append({
  type: 'user/message',
  data: {
    role: 'user',
    id: 'message-user-1',
    content: [{ type: 'text', text: 'hello' }],
    source: { kind: 'user' },
  },
  surfaceOp: 'append',
});
log.append({
  type: 'assistant/message',
  data: {
    turn: 1,
    step: 1,
    message: {
      role: 'assistant',
      id: 'message-assistant-1',
      content: [{ type: 'text', text: 'hello from the fake model' }],
      source: { kind: 'model', provider: 'fake', model: 'fake-chat' },
    },
    stream: [{
      type: 'text-chunks',
      time0: 1_700_000_000_003,
      index: 0,
      dt: [],
      texts: ['hello from the fake model'],
    }],
  },
  surfaceOp: 'append',
});
log.append({ type: 'step/end', data: { turn: 1, step: 1 } });
log.append({ type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });

console.log(`--- committed log: seq=${log.seq} ---`);
console.log('--- read range [0, 3) ---');
for (const event of log.read(0, 3)) {
  console.log(`${event.seq}\t${event.type}\t${JSON.stringify(event.data)}`);
}

console.log('--- read range [3, seq) ---');
for (const event of log.read(3)) {
  console.log(`${event.seq}\t${event.type}\t${JSON.stringify(event.data)}`);
}
