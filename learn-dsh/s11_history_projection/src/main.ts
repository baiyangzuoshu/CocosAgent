import { EventLog } from './events.ts';
import { deriveHistory } from './history.ts';

const log = new EventLog();

function showHistory(title: string): void {
  const history = deriveHistory(log.snapshot());
  console.log(`--- ${title} ---`);
  console.log(`active surface seqs: [${history.nodes.join(', ')}]`);
  for (const message of history.messages) {
    const text = message.content.map((block) => block.text).join('');
    console.log(`${message.role}: ${text}`);
  }
}

log.append({ type: 'turn/start', data: { turn: 1 } });
log.append({
  type: 'user/message',
  data: {
    role: 'user', id: 'user-1', content: [{ type: 'text', text: '需求：离线运行，并保留对话记录。' }],
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
      role: 'assistant', id: 'assistant-1',
      content: [{ type: 'text', text: '我会记录两点：支持离线运行；保存对话记录。' }],
      source: { kind: 'model', provider: 'fake', model: 'fake-chat' },
    },
    stream: [{ type: 'text-chunks', time0: 1_700_000_000_002, index: 0, dt: [], texts: ['我会记录两点：支持离线运行；保存对话记录。'] }],
  },
  surfaceOp: 'append',
});
log.append({ type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });

showHistory('compaction 前的模型历史');

const start = log.append({ type: 'compaction/start', data: { compactionId: 'compact-1', range: { start: 1, end: 2 } } });
const summary = log.append({
  type: 'compaction/summary',
  data: { compactionId: 'compact-1', summary: '用户要求支持离线运行，并保存对话记录。', shadowedRange: { start: 1, end: 2 } },
});
log.append({
  type: 'user/message',
  data: {
    role: 'user', id: 'checkpoint-1',
    content: [
      { type: 'text', text: 'This is a compacted checkpoint. Continue from this established context.\n\n<compacted-summary>' },
      { type: 'text', text: '用户要求支持离线运行，并保存对话记录。' },
      { type: 'text', text: '</compacted-summary>' },
    ],
    source: { kind: 'compact-checkpoint', compactionId: 'compact-1' },
  },
  surfaceOp: { op: 'replace', startSeq: 1, endSeq: 2 },
  sourceEventSeqs: [start.seq, summary.seq, 1, 2],
});
log.append({ type: 'compaction/end', data: { compactionId: 'compact-1', outcome: 'completed' } });

showHistory('compaction 后的模型历史');

log.append({ type: 'turn/start', data: { turn: 2 } });
log.append({
  type: 'user/message',
  data: { role: 'user', id: 'user-2', content: [{ type: 'text', text: '先实现离线模式。' }], source: { kind: 'user' } },
  surfaceOp: 'append',
});
log.append({
  type: 'assistant/message',
  data: {
    turn: 2,
    step: 1,
    message: {
      role: 'assistant', id: 'assistant-2', content: [{ type: 'text', text: '好的，先实现离线模式。' }],
      source: { kind: 'model', provider: 'fake', model: 'fake-chat' },
    },
    stream: [{ type: 'text-chunks', time0: 1_700_000_000_010, index: 0, dt: [], texts: ['好的，先实现离线模式。'] }],
  },
  surfaceOp: 'append',
});
log.append({ type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } });

showHistory('后续 Turn 的模型历史');
console.log(`raw event count: ${log.seq}; original messages remain in the log`);
